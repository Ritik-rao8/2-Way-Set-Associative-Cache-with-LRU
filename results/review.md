# Verification record

## Hardware

Both caches pass 3,259 completed, checked requests at each memory latency of
1, 3, and 7 cycles: 19,554 completed RTL requests. Checks cover all sets and
byte offsets, hits and misses, LRU eviction, read-after-write, neighbor-byte
preservation, address boundaries, latched CPU inputs, cache-only invalidation,
and joint reset after memory accepts a refill request. A scoreboard verifies
full memory before resets and at completion. Timeouts detect hangs.

Hit/miss checks use block numbers and timestamps, independently of the RTL's
LRU bit. Service-cycle and memory-transaction checks protect performance
measurements from accidental double-counting.

Both synthesized netlists pass the full 3,259-request regression at latency 3.
Yosys structural checks report zero problems; final cell reports have no
latches. The synthesis flow maps storage to generic registers and logic, not
device-specific block RAM. Counts depend on the tool version; the recorded
results use Icarus Verilog 13.0 and Yosys 0.70+post.

## Shared traces

Seven traces execute on both designs with equal capacity, block size, write
policy, memory delay, and initial contents. Every returned byte, hit/miss,
and cycle count matches an independent Python model using ordered lists.

## Reproduce

From the project root, run `./run.sh test` for the RTL regression and demo
waveforms, `./run.sh compare` for the workload measurements, and
`./run.sh synth` for the netlist checks. Executables, logs, and gate netlists
are generated in `build/`. This directory holds [the comparison
summary](comparison.md), `runs/` with per-request CSVs, `synthesis/` with
generic cell reports, and `waveforms/` with the demo captures.
See the [technical report](../docs/technical-report.md) for interpretation.

## Phase II Coverage

Seven shared traces (alternating conflict, repeated, sequential, LRU replacement,
capacity overflow, three colliding blocks, and mixed reads/writes) run on both
designs. Each trace starts with an empty cache and identically initialised memory.
All 14 runs (7 traces x 2 caches) match the independent Python reference model on
returned bytes, hit/miss decisions, and service cycle counts.

Run ./run.sh compare to reproduce all measurements.
