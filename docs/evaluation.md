# Verilog demo and waveforms

## Run the demo

Run `./run.sh demo` from the project root. The testbench issues the same six
reads to each controller and prints each address, hit or miss, returned byte,
and service time.

The direct-mapped cache has zero hits and takes 42 cycles. The two-way cache
has two hits and takes 32 cycles. Read 3 hits A, read 4 brings in C and evicts
B, and the final two reads confirm that A stayed and B was evicted.
See the [testbench](../verilog/sim/cache_tb.v) for the checked sequence.

## Read the Verilog in this order

The walkthrough follows [the two-way controller](../verilog/rtl/cache_2way.v).

1. **Storage.** `data0` and `data1` store blocks for the two ways.
   `tag0` and `tag1` identify which blocks are stored. `valid0` and
   `valid1` mark populated ways.
2. **Address split.** For `0x0043`, bits `[4:2]` select set 0,
   bits `[15:5]` give tag 2, and bits `[1:0]` give byte offset 3.
3. **Lookup.** `hit0` and `hit1` compare the saved tag with both valid
   ways. A read hit returns the chosen byte and goes to `RESPONSE`.
4. **Miss.** `fill_way` remembers which slot will receive the aligned
   four-byte block. `REFILL_WAIT` installs the block when memory replies.
5. **Write.** A write miss fetches the block first. Both write paths update
   the selected byte and send that byte to memory.
6. **Finish.** `cpu_done` tells the testbench the request completed.

## Compare where the same address goes

The direct-mapped cache uses bits `[5:2]` for the line and `[15:6]` for
the tag. The two-way cache uses bits `[4:2]` for the set and `[15:5]` for
the tag. Both take the byte offset from bits `[1:0]`.

| Byte address | Aligned block | Byte offset | Direct line and tag | Two-way set and tag |
| --- | --- | ---: | --- | --- |
| `0x0003` | `0x0000` | 3 | line 0, tag 0 | set 0, tag 0 |
| `0x0023` | `0x0020` | 3 | line 8, tag 0 | set 0, tag 1 |
| `0x0043` | `0x0040` | 3 | line 0, tag 1 | set 0, tag 2 |

Read `0x0003 → 0x0023 → 0x0043` from an empty cache. Direct mapping
replaces the block at `0x0000` in line 0 and keeps `0x0020` in line 8.
Two-way mapping fills both ways in set 0, then replaces `0x0000`, the
least recently used block. Reading `0x0003` again misses in both caches.
In direct mapping, that refill leaves `0x0020` untouched. In the two-way
cache, it evicts `0x0020`, so the following read of `0x0023` misses.

## Inspect the simulator waveform

Open [2way_demo.vcd](../results/waveforms/2way_demo.vcd) in GTKWave or another
VCD viewer. Add `clk`, `cpu_req`, `cpu_addr`, `cpu_hit`, `mem_req`,
`mem_done`, and `cpu_done` from the **cache_tb** scope. The testbench changes
the live address after acceptance to check that the controller latched it.
Inspect the DUT signal `saved_addr` to follow the address while it is busy.

Read 3 completes in two cycles. Read 4 completes in seven cycles, with
`mem_req` and `mem_done` visible during the refill.
See the waveform figure in the [Phase I report](../reports/phase-i.pdf).

## Phase II: Netlist Regression

After Yosys synthesis, each gate-level netlist was tested through the full
3,259-request verification suite at latency 3. Both netlists produced identical
hit/miss decisions and service-cycle counts as the RTL, confirming functional
equivalence between synthesised netlist and source Verilog.

Run ./run.sh synth to reproduce the synthesis and netlist tests.
