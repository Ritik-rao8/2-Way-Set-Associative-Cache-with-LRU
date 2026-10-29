# Shared access traces

Each line is `operation address data`: operation is decimal 0 (read) or 1
(write); address and data are hexadecimal. Read data inputs are ignored.
No headers or comments appear in .txt files so Verilog can read them easily.

Both caches start empty with identical memory for each file. Initial byte at
address A is `(A XOR (A >> 8)) AND 255`. Comparison uses memory latency 3.

- repeated: 16 reads of address 0000; one compulsory miss.
- sequential: two passes over bytes 0000 through 003f; spatial and temporal locality.
- conflict: alternate 0000 and 0040 eight times; direct-mapped conflict misses.
- lru: 0000,0040,0000,0080,0000,0080,0040; explicitly exercise LRU replacement.
- capacity: two passes over 32 blocks (128 bytes), larger than either cache.
- three_blocks: repeat 0000,0020,0040 eight times. All share one two-way set;
  direct mapping retains 0020 in another line. Two-way is not always better.
- mixed: 128 deterministic reads/writes in a 128-byte region; every write is
  followed by a readback. Generated with xorshift32 seed 2468ace1.

The event CSV for each run records the response to every request, including
hit status, returned/read-back byte, and service cycles. These files can be
used later to check the browser demonstration against actual RTL behavior.
