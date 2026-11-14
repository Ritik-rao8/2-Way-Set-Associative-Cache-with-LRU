# Phase I Prototype Verification Metrics

**Author / Analyst**: Ansh Tomar  
**Scope**: 6-Read Directed Prototype Sequence ($A \to B \to A \to C \to A \to B$)  
**Simulated Memory Latency**: 3 Clock Cycles  
**Cache Clock Period**: 10 ns (100 MHz)

---

## 1. Executive Summary

The prototype evaluation compares a baseline direct-mapped cache against a two-way set-associative cache with Least Recently Used (LRU) replacement under identical capacity (64 bytes) and block size (4 bytes).

| Metric | Direct-Mapped Baseline | Two-Way LRU Prototype | Delta / Benefit |
| :--- | :---: | :---: | :---: |
| **Total Requests** | 6 | 6 | — |
| **Hits** | 0 | 2 | **+2 hits** |
| **Misses** | 6 | 4 | **-2 misses** |
| **Hit Rate** | 0.0% | 33.3% | **+33.3%** |
| **Total Service Cycles** | 42 cycles | 32 cycles | **-10 cycles (23.8% speedup)** |
| **Total Execution Time** | 420 ns | 320 ns | **-100 ns** |
| **Average Cycles / Access** | 7.00 | 5.33 | **1.67 cycles faster** |

---

## 2. Step-by-Step Access Analysis

Addresses $A$ (`0x0000`), $B$ (`0x0040`), and $C$ (`0x0080`) all map to Set `0` (bits $[4:2] = 000$) in the two-way cache and Line `0` (bits $[5:2] = 0000$) in the direct-mapped cache.

### Access 1: Read $A$ (`0x0000`)
- **Direct-Mapped**: Miss. Fetches block `0x0000` into Line 0 (7 cycles).
- **Two-Way LRU**: Miss. Way 0 is empty, installs $A$ in Way 0. LRU bit points to Way 1 as next victim (7 cycles).

### Access 2: Read $B$ (`0x0040`)
- **Direct-Mapped**: Conflict Miss. Overwrites $A$ in Line 0 (7 cycles).
- **Two-Way LRU**: Miss. Way 1 is empty, installs $B$ in Way 1. Set 0 is now full. Way 0 ($A$) is older, so LRU bit points to Way 0 (7 cycles).

### Access 3: Read $A$ (`0x0000`) — **Key Architectural Divergence**
- **Direct-Mapped**: Conflict Miss. Line 0 held $B$, so $A$ must be fetched from memory again, evicting $B$ (7 cycles).
- **Two-Way LRU**: **HIT**. $A$ is resident in Way 0. Controller completes access in 2 clock cycles. Accessing Way 0 marks it Most Recently Used (MRU), shifting the LRU victim bit to point to **Way 1 ($B$)**.

### Access 4: Read $C$ (`0x0080`) — **Eviction Verification**
- **Direct-Mapped**: Conflict Miss. Evicts $A$ from Line 0 and installs $C$ (7 cycles).
- **Two-Way LRU**: Miss. Set 0 is full. The LRU bit selects **Way 1 ($B$)** for eviction. $C$ replaces $B$ in Way 1. Way 0 ($A$) remains untouched! (7 cycles).

### Access 5: Read $A$ (`0x0000`)
- **Direct-Mapped**: Conflict Miss. Evicts $C$ from Line 0 (7 cycles).
- **Two-Way LRU**: **HIT**. Confirms $A$ survived the eviction of step 4! Completes in 2 clock cycles.

### Access 6: Read $B$ (`0x0040`)
- **Direct-Mapped**: Conflict Miss (7 cycles).
- **Two-Way LRU**: Miss. Confirms $B$ was indeed the evicted block in step 4. Replaces Way 1 ($C$) with $B$ (7 cycles).

---

## 3. Latency & Cycle Accounting

- **Hit Service Time**:
  $$\text{Latency}_{\text{hit}} = \text{Lookup} + \text{Response} = 2 \text{ clock cycles} = 20\text{ ns}$$
- **Miss Service Time** (with memory latency $L = 3$):
  $$\text{Latency}_{\text{miss}} = \text{Lookup} + \text{Refill Wait } (L + 1) + \text{Install} + \text{Response} = 1 + 4 + 1 + 1 = 7 \text{ clock cycles} = 70\text{ ns}$$
