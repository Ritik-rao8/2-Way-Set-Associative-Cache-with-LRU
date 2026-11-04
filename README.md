# Two-Way Set-Associative Cache with LRU — Phase I Prototype

This repository implements and compares a 64-byte **Direct-Mapped Cache** baseline against a 64-byte **Two-Way Set-Associative Cache with LRU replacement** in Verilog.

## Team Members
- **Ritik** (`Ritik-rao8`) — Two-way set-associative cache RTL & LRU logic
- **Aman** (`Aman739-code`) — Direct-mapped baseline RTL & address decoding
- **Dipanshu Chaudhary** (`Deepanshu-Nst`) — Shared testbench, memory model & verification
- **Ansh Tomar** (`anshtomarrr`) — Prototype metrics, cycle analysis & waveforms
- **Sarabjit Singh** (`SarabjeetSingh1508`) — IEEE report, documentation & video coordination

## Planned Repository Structure
- `verilog/rtl/` — Synthesizable cache controllers (`cache_direct.v`, `cache_2way.v`)
- `verilog/sim/` — Testbench and behavioral memory model
- `results/` — Simulation outputs and waveforms
- `reports/` — IEEE format Phase I report
