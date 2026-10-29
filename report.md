# Cache implementation and comparison report

Implementation and simulation results recorded on 29 October 2026.
The interactive website is included in web/.

## Objective and implementation

Implement a two-way set-associative cache with LRU and compare it fairly with
a direct-mapped cache. Both designs use 16-bit byte addresses, 8-bit CPU data,
four-byte blocks, 64 bytes of data storage, and write-through/write-allocate.
The two-way design has eight sets; the baseline has sixteen lines. The full
address fields, signal contract, and FSM are documented in README.md.

Both use the same seven-state controller structure. A read hit takes two
cycles from acceptance to completion. A miss fetches a 32-bit aligned block.
Writes update just the selected byte and wait for the main-memory acknowledgment.
Each two-way set stores two tags, two valid bits, and one LRU victim bit.
Invalid entries are selected first. Hits and fills make the accessed way most
recently used. No dirty bit or write-back state is required.

The implementation is intentionally fixed to this small configuration. Memory
latency is configurable in the testbench. Cache size is not advertised as a
parameter: changing it requires coordinated changes to arrays and address fields.

## Verification

The same Verilog testbench runs against each cache. It compares data with an
independent 64KB byte-memory scoreboard and hit/miss decisions with a model
that uses block numbers and timestamps instead of the hardware's LRU bits.
It verifies transaction counts and checks that service cycles match the
interface timing. Inputs are changed immediately after acceptance to verify
that the cache latches them.

Each cache passes 3,259 completed, checked requests at memory latencies 1, 3,
and 7: 19,554 checked RTL requests across the six runs. These include all byte
offsets, both ways, all sets, write misses, neighbor-byte preservation, highest
addresses, LRU eviction, cache-only reset, joint reset during an outstanding
refill, and 2,000 deterministic mixed requests plus immediate write readbacks.
The pending request canceled by reset is not counted as a completed request.
Full memory is compared before test resets and at completion.

Short directed VCD waveforms are saved. The seven comparison workloads produce
14 further RTL runs; every event is checked by an independent Python model
using ordered lists for LRU. Both synthesized netlists additionally pass the
same 3,259-request test at latency 3. These tests provide broad simulation
coverage, not a formal proof for every possible input sequence.

## Comparison methodology

Each trace starts with empty caches and identically initialized memory. Capacity,
block size, write policy, clock model, and memory delay are held constant.
A request is counted once, even when it triggers a refill and a write-through.
Hit rate is hits divided by requests. Service cycles are edge intervals from
request acceptance to response, summed without the testbench's idle gaps.
This is not processor IPC, wall-clock execution time, or a hardware MHz result.

At memory latency L:

- Read hit: 2 cycles.
- Read miss: 2 + (L + 2) cycles.
- Write hit: 2 + (L + 2) cycles.
- Write miss: 2 + 2 × (L + 2) cycles.

The extra two cycles per memory operation are request/acknowledgment handling.
Comparison uses L=3. Complete measurements are in results/comparison.md and
results/comparison.csv; the source inputs are in traces/.

## What the measurements show

| Trace | Direct hit rate | Two-way hit rate | Meaning |
| --- | ---: | ---: | --- |
| Repeated address | 93.750% | 93.750% | Both miss once and then hit |
| Sequential bytes | 87.500% | 87.500% | Both benefit from four-byte blocks |
| Alternating conflict | 0.000% | 87.500% | Two ways retain both conflicting blocks |
| LRU exercise | 0.000% | 42.857% | Recency determines which block remains |
| Capacity overflow | 0.000% | 0.000% | Neither cache holds the 128-byte working set |
| Three colliding blocks | 29.167% | 0.000% | Mapping can favor the direct-mapped cache |
| Deterministic mixed | 64.796% | 60.714% | This workload also slightly favors direct mapping |

For the conflict trace, total service cycles fall from 112 to 42, a 62.5%
reduction for this particular workload and timing model. This is not a general
speedup claim. In the three-block trace, addresses 0000,0020,0040 all share one
two-way set, exceeding its two slots. Direct mapping places 0020 in a different
line, so that block survives. Increasing associativity at fixed capacity also
reduces the number of sets; it does not guarantee a better result on every trace.

## Resource measurements

Both designs were synthesized with identical Yosys generic synthesis settings,
including ABC logic mapping. Simulation memory and testbench are excluded.
Tool: Icarus Verilog 13.0; Yosys 0.70+post, revision
0c11ea098be065e585a90a06e7b7da49936cf231.

| Measure | Direct-mapped | Two-way |
| --- | ---: | ---: |
| Data storage in design | 512 bits | 512 bits |
| Tag storage in design | 160 bits | 176 bits |
| Valid storage in design | 16 bits | 16 bits |
| LRU storage in design | 0 bits | 8 bits |
| Total generic mapped cells | 1,782 | 1,996 |
| Mapped flip-flop cells, including controls | 730 | 754 |
| Other mapped logic cells | 1,052 | 1,242 |

The two-way version uses 214 more generic cells (about 12.0%) in this flow.
Generic cell counts are not physical area or FPGA LUT counts: cell types have
different costs. The arrays are implemented as flip-flops and multiplexers in
this mapping; zero remaining memory primitives does not mean zero storage.
Target-specific synthesis, placement, and timing constraints would be needed
to report FPGA resources or maximum clock frequency. No such claims are made.

Yosys structural checks report zero problems. ABC emits messages that the logic
networks it receives are combinational; the sequential flip-flops remain in
the synthesized design, as the cell counts and netlist simulations confirm.
No inferred latch cells appear in either final cell report.

## Limitations and next steps

This is a blocking cache with one outstanding request, byte accesses, a simple
block-read memory interface, and no coherence, prefetching, byte masks, or CPU
pipeline. Those additions are outside the supplied project objective. Reset
can cancel a transaction only when cache and memory are reset together; a
cache-only invalidation is supported while idle. Behavioral simulation memory
reinitializes its contents on joint reset.

The static website visualizes this behavior. Its actual JavaScript
model matches all 902 saved RTL events across the 14 comparison runs.
Public hosting can be configured separately.

## Reference

The provided 2-way-Set-Associative-Cache-Controller-master repository by Prasad
Pandit and Radhika Mandlekar was used as a learning reference for cache
organization. Its implementation, tests, and results are not submitted as ours.
Our modules, interface, write policy, verification, and results were developed
in the mca project folder for the supplied assignment.
