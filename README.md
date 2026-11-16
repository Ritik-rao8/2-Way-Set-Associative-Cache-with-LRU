# Two-Way Set-Associative Cache with LRU — Phase I Prototype

This repository contains the **Phase I Prototype** for the MCA Computer Architecture project. The project implements and demonstrates a synthesizable Verilog prototype of a two-way set-associative cache with Least Recently Used (LRU) replacement, evaluated against an equivalent direct-mapped baseline.

Both cache controllers share the same 64-byte data capacity and 4-byte block size. The prototype demonstrates how set associativity and LRU replacement eliminate conflict misses and optimize memory access cycles.

---

## Phase I Deliverables

| Deliverable | Description | Link |
| :--- | :--- | :--- |
| **IEEE Project Report** | Complete Phase I project report in IEEE format | [📄 `reports/phase-i.pdf`](reports/phase-i.pdf) |
| **Prototype Demonstration Video** | Video demonstration ($\le$ 5 minutes) introducing all 5 members, the project idea, and prototype working | [🎥 Google Drive Demonstration Video](https://drive.google.com/drive/folders/1-RtKQ4K5GRMhLtljZ2GdunmmJXNhfXVl?usp=sharing) |
| **Two-Way LRU Prototype RTL** | Synthesizable Verilog controller with 8 sets, 2 ways/set, and LRU eviction | [`verilog/rtl/cache_2way.v`](verilog/rtl/cache_2way.v) |
| **Baseline Direct-Mapped RTL** | Baseline Verilog controller with 16 lines for conflict comparison | [`verilog/rtl/cache_direct.v`](verilog/rtl/cache_direct.v) |
| **Verification Testbench** | Shared testbench and memory model verifying both controllers | [`verilog/sim/cache_tb.v`](verilog/sim/cache_tb.v) |
| **Prototype Waveforms** | VCD simulation waveforms for both caches | [`results/waveforms/`](results/waveforms/) |
| **Interactive Visualizer** | Step-by-step browser tool to visualize cache block placement & eviction | [🌐 Cache Explorer (`web/index.html`)](web/index.html) |

---

## Team Members & Phase I Individual Contributions

All 5 group members have contributed meaningfully to the conception, design, verification, and documentation of the Phase I prototype:

| Team Member | GitHub Username | Phase I Role & Key Contributions |
| :--- | :--- | :--- |
| **Ritik** | `Ritik-rao8` | Developed the two-way Verilog cache controller (`cache_2way.v`) and the 1-bit LRU replacement logic per set. |
| **Aman** | `Aman739-code` | Developed the direct-mapped baseline controller (`cache_direct.v`) and documented address bit decoding. |
| **Dipanshu Chaudhary** | `Deepanshu-Nst` | Developed the shared testbench (`cache_tb.v`), memory model, and verified signal timing across clock cycles. |
| **Sarabjit Singh** | `SarabjeetSingh1508` | Assembled the IEEE Phase I project report, maintained repository documentation, and coordinated the prototype demo video. |
| **Ansh Tomar** | `anshtomarrr` | Analyzed prototype metrics, calculated hit counts/service cycles for the 6-read sequence, and verified waveform timing. |

---

## Prototype Architecture & Working

Both controllers use 16-bit byte addresses, 8-bit CPU data, and 4-byte block refills with write-through and write-allocate policies:

| Geometry Parameter | Direct-Mapped Baseline | Two-Way LRU Prototype |
| :--- | :---: | :---: |
| **Total Data Capacity** | 64 Bytes | 64 Bytes |
| **Block Size** | 4 Bytes | 4 Bytes |
| **Geometry** | 16 lines $\times$ 1 way | 8 sets $\times$ 2 ways |
| **Tag Bits** | $[15:6]$ (10 bits) | $[15:5]$ (11 bits) |
| **Index Bits** | $[5:2]$ (4 bits) | $[4:2]$ (3 bits) |
| **Byte Offset Bits** | $[1:0]$ (2 bits) | $[1:0]$ (2 bits) |

### Demonstration Sequence: $A \to B \to A \to C \to A \to B$

Addresses $A$ (`0x0000`), $B$ (`0x0040`), and $C$ (`0x0080`) all share Index `0` in both controllers:
1. **Direct-Mapped**: Every new address overwrites line `0`. Each access misses, resulting in **0 hits** and **42 service cycles**.
2. **Two-Way LRU**: Set `0` holds two ways. The second access to $A$ hits and marks $B$ as Least Recently Used. When $C$ arrives, it evicts $B$, keeping $A$ resident. The sequence achieves **2 hits** and completes in **32 service cycles** (a 24% cycle reduction).

---

## How to Run the Phase I Prototype

### Prerequisites
- [Icarus Verilog](http://iverilog.icarus.com/) (`iverilog` and `vvp`)
- [GTKWave](http://gtkwave.sourceforge.net/) (optional, for viewing `.vcd` waveform traces)

On macOS via Homebrew:
```bash
brew install icarus-verilog gtkwave
```

### 1. Run the Prototype Demo
Executes the 6-read sequence on both controllers, printing each address, hit/miss decision, returned byte, and cycle counts:
```bash
./run.sh demo
```

### 2. Run the Verification Regression
Verifies both controllers against the shared testbench across memory latencies of 1, 3, and 7 cycles:
```bash
./run.sh test
```

### 3. Inspect Waveforms
Simulation waveforms are generated in `results/waveforms/`:
- `results/waveforms/2way_demo.vcd`: Two-way LRU prototype trace.
- `results/waveforms/direct_demo.vcd`: Baseline direct-mapped trace.

Open in GTKWave:
```bash
gtkwave results/waveforms/2way_demo.vcd
```
Key signals to observe: `clk`, `cpu_req`, `cpu_addr`, `cpu_hit`, `cpu_done`, `mem_req`, `mem_done`. A hit completes in **2 clock cycles**; a miss refilling from memory completes in **7 clock cycles** (at memory latency 3).

---

## Interactive Browser Visualizer

An optional interactive simulator is available in `web/`:
- Open `web/index.html` directly in any web browser.
- Select the interactive lessons: **"Two blocks, one slot"**, **"Which block leaves?"**, and **"Fetch the neighbours"** to visually trace block placement, LRU eviction, and hit/miss updates.

---

## Phase I Repository Structure

```text
.
├── README.md                      # Phase I project overview, video link & member roles
├── run.sh                         # Shell script to compile and run prototype demo & tests
├── verilog/
│   ├── rtl/
│   │   ├── cache_2way.v           # Two-way set-associative LRU controller (Prototype)
│   │   └── cache_direct.v         # Direct-mapped cache controller (Baseline)
│   └── sim/
│       ├── cache_tb.v             # Verification testbench and assertion scoreboard
│       └── memory_model.v         # Synchronous main memory behavioral model
├── results/
│   └── waveforms/
│       ├── 2way_demo.vcd          # GTKWave trace of 2-way LRU prototype demo
│       └── direct_demo.vcd        # GTKWave trace of baseline direct-mapped demo
├── reports/
│   ├── README.md                  # Instructions to compile IEEE reports
│   ├── phase-i.pdf                # Primary Phase I Deliverable (IEEE Format Report)
│   ├── phase-i.tex                # LaTeX source for Phase I report
│   ├── authors.tex                # 5-member author details
│   ├── preamble.tex               # IEEEtran configuration
│   └── references.tex             # Citations (Smith, Hill, etc.)
├── docs/
│   ├── evaluation.md              # Address mapping reference and waveform inspection guide
│   └── demo-checklist.md          # Prototype demo rehearsal walkthrough
└── web/                           # Interactive Cache Explorer visualizer
    ├── index.html
    ├── script.js
    └── style.css
```

---

## Upcoming Phase II Scope

The following milestones are planned for **Phase II (Final Evaluation - 70% weightage)**:
1. **Trace-Driven Workload Simulation**: Comprehensive evaluation across 7 distinct workload patterns (spatial locality, alternating conflicts, cyclic overflow, capacity stress, and mixed read/write workloads).
2. **Hardware Synthesis**: Gate-level cell count and area estimation using Yosys open-source synthesis suite.
3. **Final IEEE Project Report**: Expanded report including Results & Discussion, Synthesis trade-offs, and Conclusion.
4. **Project Viva / Evaluation Interview**: Individual assessment of implementation details and architectural trade-offs.
