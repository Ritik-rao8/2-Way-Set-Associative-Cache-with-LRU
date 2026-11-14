# Measured RTL comparison

Memory latency: 3 cycles. Both caches have 64 data bytes and four-byte blocks.

| Trace | Cache | Requests | Hits | Misses | Hit rate | Service cycles | Cycles/access |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| capacity | direct | 64 | 0 | 64 | 0.000% | 448 | 7.000 |
| capacity | 2way | 64 | 0 | 64 | 0.000% | 448 | 7.000 |
| conflict | direct | 16 | 0 | 16 | 0.000% | 112 | 7.000 |
| conflict | 2way | 16 | 14 | 2 | 87.500% | 42 | 2.625 |
| lru | direct | 7 | 0 | 7 | 0.000% | 49 | 7.000 |
| lru | 2way | 7 | 3 | 4 | 42.857% | 34 | 4.857 |
| mixed | direct | 196 | 127 | 69 | 64.796% | 1077 | 5.495 |
| mixed | 2way | 196 | 119 | 77 | 60.714% | 1117 | 5.699 |
| repeated | direct | 16 | 15 | 1 | 93.750% | 37 | 2.312 |
| repeated | 2way | 16 | 15 | 1 | 93.750% | 37 | 2.312 |
| sequential | direct | 128 | 112 | 16 | 87.500% | 336 | 2.625 |
| sequential | 2way | 128 | 112 | 16 | 87.500% | 336 | 2.625 |
| three_blocks | direct | 24 | 7 | 17 | 29.167% | 133 | 5.542 |
| three_blocks | 2way | 24 | 0 | 24 | 0.000% | 168 | 7.000 |

Service cycles count rising-edge intervals from CPU request acceptance to completion.
They exclude idle gaps between requests. A read hit costs 2 cycles. Each memory transaction
adds LATENCY + 2 cycles for request/acknowledgment handling. A write miss performs two
memory transactions: block fetch and byte write. These are simulation cycles, not MHz.

Every event, hit count, returned byte, and cycle total was also checked by a separate
Python model using lists ordered by recency. Values above come from Verilog simulation.
