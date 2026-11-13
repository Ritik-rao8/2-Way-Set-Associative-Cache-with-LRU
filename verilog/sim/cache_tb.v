`timescale 1ns/1ps
// One testbench is compiled for each cache, so both receive identical tests.
module cache_tb;
    parameter LATENCY=3;
    reg clk=0;
    always #5 clk=~clk;
    reg reset=1, memory_reset=1;
    reg cpu_req=0, cpu_write=0;
    reg [15:0] cpu_addr=0;
    reg [7:0] cpu_wdata=0;
    wire cpu_busy, cpu_done, cpu_hit;
    wire [7:0] cpu_rdata;
    wire mem_req, mem_write, mem_done;
    wire [15:0] mem_addr;
    wire [7:0] mem_wdata;
    wire [31:0] mem_rdata;
`ifdef TWO_WAY
    localparam WAYS=2, SETS=8;
    cache_2way dut (
`else
    localparam WAYS=1, SETS=16;
    cache_direct dut (
`endif
        .clk(clk), .reset(reset), .cpu_req(cpu_req), .cpu_write(cpu_write),
        .cpu_addr(cpu_addr), .cpu_wdata(cpu_wdata), .cpu_busy(cpu_busy),
        .cpu_done(cpu_done), .cpu_rdata(cpu_rdata), .cpu_hit(cpu_hit),
        .mem_req(mem_req), .mem_write(mem_write), .mem_addr(mem_addr),
        .mem_wdata(mem_wdata), .mem_done(mem_done), .mem_rdata(mem_rdata)
    );
    memory #(.LATENCY(LATENCY)) ram (
        .clk(clk), .reset(memory_reset), .mem_req(mem_req), .mem_write(mem_write),
        .mem_addr(mem_addr), .mem_wdata(mem_wdata),
        .mem_done(mem_done), .mem_rdata(mem_rdata)
    );

    // Independent reference: full byte memory and block numbers with timestamps.
    // It has no FSM and does not use the DUT's LRU bit or internal arrays.
    reg [7:0] expected [0:65535];
    integer model_block [0:15];
    integer last_used [0:15];
    integer requests, hits, total_cycles;
    integer tested=0;
    reg initialized=0;
    integer i, j, stage;
    reg demo;
    integer csv_file, event_file, trace_file, scan;
    integer op, address, value;
    reg [1023:0] trace_path, csv_path, event_path, wave_path;
    reg [31:0] random_state;

    task fail;
        input [511:0] message;
        begin
            $display("FAIL ways=%0d latency=%0d request=%0d: %0s", WAYS, LATENCY, requests, message);
            $finish_and_return(1);
        end
    endtask

    task clear_model;
        begin
            for (j=0; j<16; j=j+1) begin
                model_block[j]=-1;
                last_used[j]=0;
            end
        end
    endtask

    task check_memory;
        integer location;
        begin
            for (location=0;location<65536;location=location+1)
                if (ram.bytes[location] !== expected[location])
                    fail("full-memory comparison failed");
        end
    endtask

    task fresh_start;
        begin
            if (initialized) check_memory;
            @(negedge clk);
            reset=1; memory_reset=1; cpu_req=0;
            repeat (2) @(negedge clk);
            reset=0; memory_reset=0;
            initialized=1;
            requests=0; hits=0; total_cycles=0;
            clear_model;
            for (j=0; j<65536; j=j+1) expected[j]=(j ^ (j >> 8)) & 255;
        end
    endtask

    task access;
        input write_request;
        input [15:0] addr;
        input [7:0] data_in;
        input expected_hit; // Explicit expectation, or x to use only the model.
        integer block_number, set_number, slot, found, victim;
        integer cycles, old_reads, old_writes;
        reg predicted_hit;
        begin
            block_number=addr/4;
            set_number=block_number%SETS;
            found=-1;
            victim=set_number*WAYS;
            // Timestamp-based replacement, deliberately different from hardware LRU.
            for (slot=set_number*WAYS; slot<(set_number+1)*WAYS; slot=slot+1) begin
                if (model_block[slot]==block_number) found=slot;
                if (last_used[slot]<last_used[victim]) victim=slot;
            end
            predicted_hit=(found!=-1);
            if ((expected_hit !== 1'bx) && predicted_hit !== expected_hit)
                fail("directed test expectation disagrees with reference model");
            old_reads=ram.reads;
            old_writes=ram.writes;
            @(negedge clk);
            if (cpu_busy !== 0) fail("cache not idle before request");
            cpu_req=1; cpu_write=write_request; cpu_addr=addr; cpu_wdata=data_in;
            @(posedge clk); #1;
            if (cpu_busy !== 1 || cpu_done !== 0) fail("request was not accepted cleanly");
            @(negedge clk);
            // Change all inputs after acceptance: the cache must use its saved values.
            cpu_req=0; cpu_addr=16'hdead; cpu_wdata=8'hac; cpu_write=~write_request;
            cycles=0;
            while (cpu_done !== 1) begin
                @(posedge clk); #1;
                cycles=cycles+1;
                if (cycles>200) fail("request timed out");
                if (cpu_done !== 1 && cpu_busy !== 1) fail("busy dropped before completion");
                if (mem_req === 1'b1 && mem_write === 1'b0 && mem_addr !== {addr[15:2], 2'b00})
                    fail("block fetch used the wrong aligned address");
                if (mem_req === 1'b1 && mem_write === 1'b1 &&
                    (mem_addr !== addr || mem_wdata !== data_in))
                    fail("write-through used the wrong byte address or data");
            end
            if (cpu_busy !== 0) fail("busy still high at completion");
            if (cpu_hit !== predicted_hit) fail("wrong hit/miss result");
            if (!write_request && cpu_rdata !== expected[addr]) begin
                $display("address=%h expected=%h actual=%h",addr,expected[addr],cpu_rdata);
                fail("read data mismatch");
            end
            if (write_request) expected[addr]=data_in;
            if (ram.bytes[addr] !== expected[addr]) fail("write-through memory mismatch");
            if (ram.reads-old_reads != !predicted_hit) fail("wrong number of block fetches");
            if (ram.writes-old_writes != write_request) fail("wrong number of byte writes");
            // Each block fetch or byte write adds LATENCY+2 handshake cycles.
            if (cycles != 2+(LATENCY+2)*(!predicted_hit+write_request))
                fail("unexpected request service time");
            tested=tested+1;
            requests=requests+1;
            if (predicted_hit) begin
                hits=hits+1;
                victim=found;
            end
            model_block[victim]=block_number;
            last_used[victim]=requests;
            total_cycles=total_cycles+cycles;
            if (demo) begin
                $display("%4d  0x%04h   %s  0x%02h  %6d",
                         requests, addr, cpu_hit ? "HIT " : "MISS", cpu_rdata, cycles);
            end
            if (event_file)
                $fdisplay(event_file,"%0d,%0d,%04h,%02h,%0d,%02h,%0d",requests,write_request,addr,data_in,cpu_hit,write_request ? data_in : cpu_rdata,cycles);
        end
    endtask

    initial begin
        csv_file=0; event_file=0;
        demo=0;
        stage=2;
        scan=$value$plusargs("stage=%d",stage);
        fresh_start;
        // Baseline checks with exact service-cycle and memory transaction checks.
        access(0,16'h0000,0,0);
        for (i=0;i<4;i=i+1) access(0,i,0,1);
        for (i=0;i<4;i=i+1) begin
            access(1,i,8'ha0+i,1);
            for (j=0;j<4;j=j+1) access(0,j,0,1);
        end
        access(1,16'h0042,8'hef,0);
        access(0,16'h0042,0,1);
        access(0,16'h0000,0,WAYS==2);
        access(0,16'hffff,0,0);
        access(1,16'hfffe,8'h77,1);
        access(0,16'hfffe,0,1);
        check_memory;
        $display("TOTAL VERIFIED REQUESTS: %0d",tested);
        $display("PASS ways=%0d latency=%0d cycles=%0d",WAYS,LATENCY,total_cycles);
        $finish;
    end
endmodule
