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

## Shared traces and website

Seven traces execute on both designs with equal capacity, block size, write
policy, memory delay, and initial contents. Every returned byte, hit/miss,
and cycle count matches an independent Python model using ordered lists.

The actual JavaScript Cache class matches all 902 saved RTL responses across
14 runs. Its hidden self-test checks the brief's exact seven-workload results
and rejects a deliberately changed input trace. Animated phases account for
all service cycles and three delay ticks per memory fetch/write.

Browser checks verified timeline seeking, rewind, conflict results of 0/14
hits and 112/42 cycles, custom FFFF writes/readbacks of 2A, controller details,
and mobile cache switching. At 390px the document width equals the viewport
width. These checks are not exhaustive formal verification, accessibility
certification, or device-wide performance profiling.

## Reproduce

Run `./run.sh all`. Executables, logs, and gate netlists are regenerated locally
and intentionally excluded from Git. Source inputs, per-request event CSVs,
compact aggregate results, synthesis JSON, and two short demo waveforms are
included. See ../report.md for interpretation and limitations.
