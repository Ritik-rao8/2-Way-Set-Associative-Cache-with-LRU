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

    wire [3:0] line_index = saved_addr[5:2];
    wire [9:0] request_tag = saved_addr[15:6];
    wire [1:0] byte_offset = saved_addr[1:0];
    wire hit = valid[line_index] && tag[line_index] == request_tag;

    assign cpu_busy = state != IDLE;
    assign mem_req = state == REFILL_REQUEST || state == WRITE_REQUEST;
    assign mem_write = state == WRITE_REQUEST;
    assign mem_addr = mem_write ? saved_addr : {saved_addr[15:2], 2'b00};
    assign mem_wdata = saved_wdata;

    // Replace one byte while keeping the other three unchanged.
    function [31:0] replace_byte;
        input [31:0] block_data;
        input [1:0] offset;
        input [7:0] new_byte;
        begin
            replace_byte = block_data;
            case (offset)
                0: replace_byte[7:0] = new_byte;
                1: replace_byte[15:8] = new_byte;
                2: replace_byte[23:16] = new_byte;
                3: replace_byte[31:24] = new_byte;
            endcase
        end
    endfunction

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
                LOOKUP: begin
                    // Record the original lookup once; a refill is still a miss.
                    cpu_hit <= hit;
                    if (hit) begin
                        if (saved_write) begin
                            data[line_index] <= replace_byte(data[line_index], byte_offset, saved_wdata);
                            state <= WRITE_REQUEST;
                        end else begin
                            // +: selects eight consecutive bits starting at offset*8.
                            cpu_rdata <= data[line_index][byte_offset*8 +: 8];
                            state <= RESPONSE;
                        end
                    end else state <= REFILL_REQUEST;
                end
                REFILL_REQUEST: state <= REFILL_WAIT;
                REFILL_WAIT: begin
                    if (mem_done) begin
                        tag[line_index] <= request_tag;
                        valid[line_index] <= 1;
                        if (saved_write) begin
                            data[line_index] <= replace_byte(mem_rdata, byte_offset, saved_wdata);
                            state <= WRITE_REQUEST;
                        end else begin
                            data[line_index] <= mem_rdata;
                            cpu_rdata <= mem_rdata[byte_offset*8 +: 8];
                            state <= RESPONSE;
                        end
                    end
                end
                WRITE_REQUEST: state <= WRITE_WAIT;
                WRITE_WAIT: if (mem_done) state <= RESPONSE;
                RESPONSE: begin
                    cpu_done <= 1;
                    state <= IDLE;
                end
                default: state <= IDLE;
            endcase
        end
    end
endmodule
