`timescale 1ns/1ps
// 64-byte direct-mapped cache: 16 lines, four bytes per line.
// Write-through + write-allocate; one CPU request at a time.
module cache_direct (
    input clk, input reset,
    input cpu_req, input cpu_write,
    input [15:0] cpu_addr, input [7:0] cpu_wdata,
    output cpu_busy, output reg cpu_done,
    output reg [7:0] cpu_rdata, output reg cpu_hit,
    output mem_req, output mem_write,
    output [15:0] mem_addr, output [7:0] mem_wdata,
    input mem_done, input [31:0] mem_rdata
);
    reg [31:0] data [0:15];
    reg [9:0] tag [0:15];
    reg valid [0:15];

    localparam IDLE=0, LOOKUP=1, REFILL_REQUEST=2, REFILL_WAIT=3,
               WRITE_REQUEST=4, WRITE_WAIT=5, RESPONSE=6;
    reg [2:0] state;
    reg [15:0] saved_addr;
    reg [7:0] saved_wdata;
    reg saved_write;
    integer i;

    assign cpu_busy = state != IDLE;

    always @(posedge clk) begin
        if (reset) begin
            state <= IDLE;
            cpu_done <= 0;
            cpu_hit <= 0;
            cpu_rdata <= 0;
            saved_addr <= 0;
            saved_wdata <= 0;
            saved_write <= 0;
            for (i=0; i<16; i=i+1) valid[i] <= 0;
        end else begin
            cpu_done <= 0;
            case (state)
                IDLE: begin
                    if (cpu_req) begin
                        saved_addr <= cpu_addr;
                        saved_wdata <= cpu_wdata;
                        saved_write <= cpu_write;
                        state <= LOOKUP;
                    end
                end
                RESPONSE: begin
                    cpu_done <= 1;
                    state <= IDLE;
                end
                default: state <= IDLE;
            endcase
        end
    end
endmodule
