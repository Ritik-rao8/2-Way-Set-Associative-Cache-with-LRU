`timescale 1ns/1ps
// 64-byte two-way cache: eight sets, two ways, four bytes per block.
// Same interface and write policy as cache_direct; one LRU bit per set.
module cache_2way (
    input clk, input reset,
    input cpu_req, input cpu_write,
    input [15:0] cpu_addr, input [7:0] cpu_wdata,
    output cpu_busy, output reg cpu_done,
    output reg [7:0] cpu_rdata, output reg cpu_hit,
    output mem_req, output mem_write,
    output [15:0] mem_addr, output [7:0] mem_wdata,
    input mem_done, input [31:0] mem_rdata
);
    reg [31:0] data0 [0:7];
    reg [31:0] data1 [0:7];
    reg [10:0] tag0 [0:7];
    reg [10:0] tag1 [0:7];
    reg valid0 [0:7];
    reg valid1 [0:7];
    reg lru [0:7]; // 0: replace way 0 next; 1: replace way 1 next.

    localparam IDLE=0, LOOKUP=1, REFILL_REQUEST=2, REFILL_WAIT=3,
               WRITE_REQUEST=4, WRITE_WAIT=5, RESPONSE=6;
    reg [2:0] state;
    reg [15:0] saved_addr;
    reg [7:0] saved_wdata;
    reg saved_write;
    reg fill_way; // Remember the selected victim while memory is responding.
    integer i;

    wire [2:0] set_index = saved_addr[4:2];
    wire [10:0] request_tag = saved_addr[15:5];
    wire [1:0] byte_offset = saved_addr[1:0];
    // Both comparisons happen in parallel.
    wire hit0 = valid0[set_index] && tag0[set_index] == request_tag;
    wire hit1 = valid1[set_index] && tag1[set_index] == request_tag;

    assign cpu_busy = state != IDLE;
    assign mem_req = state == REFILL_REQUEST || state == WRITE_REQUEST;
    assign mem_write = state == WRITE_REQUEST;
    assign mem_addr = mem_write ? saved_addr : {saved_addr[15:2], 2'b00};
    assign mem_wdata = saved_wdata;

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
            fill_way <= 0;
            for (i=0; i<8; i=i+1) begin
                valid0[i] <= 0;
                valid1[i] <= 0;
                lru[i] <= 0;
            end
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
                    cpu_hit <= hit0 || hit1;
                    if (hit0) begin
                        lru[set_index] <= 1;
                        if (saved_write) begin
                            data0[set_index] <= replace_byte(data0[set_index], byte_offset, saved_wdata);
                            state <= WRITE_REQUEST;
                        end else begin
                            cpu_rdata <= data0[set_index][byte_offset*8 +: 8];
                            state <= RESPONSE;
                        end
                    end else if (hit1) begin
                        lru[set_index] <= 0;
                        if (saved_write) begin
                            data1[set_index] <= replace_byte(data1[set_index], byte_offset, saved_wdata);
                            state <= WRITE_REQUEST;
                        end else begin
                            cpu_rdata <= data1[set_index][byte_offset*8 +: 8];
                            state <= RESPONSE;
                        end
                    end else begin
                        // Empty space takes priority over replacing valid data.
                        if (!valid0[set_index]) fill_way <= 0;
                        else if (!valid1[set_index]) fill_way <= 1;
                        else fill_way <= lru[set_index];
                        state <= REFILL_REQUEST;
                    end
                end
                REFILL_REQUEST: state <= REFILL_WAIT;
                REFILL_WAIT: begin
                    if (mem_done) begin
                        if (fill_way == 0) begin
                            tag0[set_index] <= request_tag;
                            valid0[set_index] <= 1;
                            lru[set_index] <= 1;
                            if (saved_write)
                                data0[set_index] <= replace_byte(mem_rdata, byte_offset, saved_wdata);
                            else data0[set_index] <= mem_rdata;
                        end else begin
                            tag1[set_index] <= request_tag;
                            valid1[set_index] <= 1;
                            lru[set_index] <= 0;
                            if (saved_write)
                                data1[set_index] <= replace_byte(mem_rdata, byte_offset, saved_wdata);
                            else data1[set_index] <= mem_rdata;
                        end
                        if (saved_write) state <= WRITE_REQUEST;
                        else begin
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
