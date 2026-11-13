`timescale 1ns/1ps
// A tiny setup check: the simulator must execute four rising clock edges.
module smoke_tb;
    reg clk = 0;
    integer edges = 0;
    always #5 clk = ~clk;
    always @(posedge clk) edges = edges + 1;
    initial begin
        #40;
        if (edges != 4) begin
            $display("FAIL: simulator clock check");
            $finish_and_return(1);
        end
        $display("PASS: simulator setup (four rising edges)");
        $finish;
    end
endmodule
