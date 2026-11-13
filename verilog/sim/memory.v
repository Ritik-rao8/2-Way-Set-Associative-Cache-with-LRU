`timescale 1ns/1ps
// Simulation-only main memory: 65536 bytes, block reads, byte writes.
// LATENCY is the number of rising edges after acceptance before mem_done.
module memory #(parameter LATENCY=3) (
    input clk, input reset,
    input mem_req, input mem_write,
    input [15:0] mem_addr, input [7:0] mem_wdata,
    output reg mem_done, output reg [31:0] mem_rdata
);
    reg [7:0] bytes [0:65535];
    reg busy;
    reg saved_write;
    reg [15:0] saved_addr;
    reg [7:0] saved_data;
    integer remaining;
    integer base;
    integer i;
    integer reads, writes;

    initial begin
        if (LATENCY < 1) begin
            $display("FAIL: memory LATENCY must be at least 1");
            $finish_and_return(1);
        end
    end

    always @(posedge clk) begin
        if (reset) begin
            busy <= 0;
            mem_done <= 0;
            mem_rdata <= 0;
            remaining <= 0;
            reads <= 0;
            writes <= 0;
            saved_addr <= 0;
            saved_data <= 0;
            saved_write <= 0;
            // Known, nonconstant data helps catch address/offset mistakes.
            for (i=0; i<65536; i=i+1) bytes[i] = (i ^ (i >> 8)) & 255;
        end else begin
            mem_done <= 0;
            if (mem_req) begin
                if (busy) begin
                    $display("FAIL: overlapping memory requests");
                    $finish_and_return(1);
                end
                saved_addr <= mem_addr;
                saved_data <= mem_wdata;
                saved_write <= mem_write;
                remaining <= LATENCY;
                busy <= 1;
            end else if (busy) begin
                if (remaining == 1) begin
                    if (saved_write) begin
                        bytes[saved_addr] <= saved_data;
                        writes <= writes + 1;
                    end else begin
                        base = {saved_addr[15:2], 2'b00};
                        mem_rdata <= {bytes[base+3], bytes[base+2], bytes[base+1], bytes[base]};
                        reads <= reads + 1;
                    end
                    busy <= 0;
                    mem_done <= 1;
                end else remaining <= remaining - 1;
            end
        end
    end
endmodule
