# Simulation Waveform Inspection Guide

**Author**: Deepanshu Chaudhary  
**Directory Scope**: Phase I Prototype VCD Captures

This folder contains Value Change Dump (`.vcd`) waveform captures generated from the Phase I Verilog prototype simulation.

---

## Files

- **`2way_demo.vcd`**: Simulation waveform trace of the Two-Way LRU Cache Prototype across the 6-read directed sequence.
- **`direct_demo.vcd`**: Simulation waveform trace of the Baseline Direct-Mapped Cache across the 6-read directed sequence.

---

## Viewing Waveforms in GTKWave

Open either waveform file using GTKWave:
```bash
gtkwave results/waveforms/2way_demo.vcd
```

### Essential Signals to Add
From the `cache_tb` scope, drag the following signals into the waveform display:
1. `clk` — 100 MHz clock signal (10 ns period).
2. `rst_n` — Active-low synchronous reset.
3. `cpu_req` — Request trigger pulsed by the testbench.
4. `cpu_addr[15:0]` — Requested 16-bit byte address.
5. `cpu_hit` — Status bit asserted if the access hit in the cache.
6. `cpu_done` — Pulse signaling CPU transaction completion.
7. `mem_req` — Refill request line asserted to the main memory model on a cache miss.
8. `mem_done` — Acknowledgment line asserted by the memory model when the 4-byte block is ready.

---

## Timing Checkpoints (Two-Way LRU)

| Access | Address | Status | Start Time | Done Time | Duration | Key Behavior Visible |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Read 3** | `0x0000` | **HIT** | 205 ns | 225 ns | **2 cycles (20 ns)** | `cpu_hit` asserts high; `mem_req` stays low. No memory access required. |
| **Read 4** | `0x0080` | **MISS** | 235 ns | 305 ns | **7 cycles (70 ns)** | `mem_req` pulses high; memory responds after 3-cycle delay; updates Way 1. |
