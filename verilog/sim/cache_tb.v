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

    initial begin
        fresh_start;
        $display("Testbench initialized: WAYS=%0d SETS=%0d LATENCY=%0d", WAYS, SETS, LATENCY);
        $finish;
    end
endmodule
