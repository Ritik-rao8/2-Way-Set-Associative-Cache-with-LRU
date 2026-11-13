"""Combine measured Verilog CSV files and check them against a simple model."""
import csv
from pathlib import Path

MEMORY_LATENCY = 3

rows = []
for trace in sorted(Path('verilog/traces').glob('*.txt')):
    accesses = [tuple(int(x, 10 if i == 0 else 16) for i, x in enumerate(line.split()))
                for line in trace.read_text().splitlines()]
    for cache, ways in [('direct', 1), ('2way', 2)]:
        with Path(f'results/runs/{trace.stem}_{cache}.csv').open() as file:
            measured = next(csv.DictReader(file))
        with Path(f'results/runs/{trace.stem}_{cache}_events.csv').open() as file:
            events = list(csv.DictReader(file))
        # A list ordered from oldest to newest models each set, independently
        # of both the RTL's LRU bit and the testbench's timestamp method.
        sets = [[] for _ in range(16 // ways)]
        memory = [(a ^ (a >> 8)) & 255 for a in range(65536)]
        hits = cycles = 0
        assert len(events) == len(accesses), 'Wrong event count'
        for request, ((write, address, data), event) in enumerate(zip(accesses, events), start=1):
            event_request = (int(event['request']), int(event['write']),
                             int(event['address_hex'], 16), int(event['input_hex'], 16))
            assert event_request == (request, write, address, data), (trace, cache, request, event)
            block = address // 4
            entries = sets[block % len(sets)]
            hit = block in entries
            if hit:
                entries.remove(block)
            elif len(entries) == ways:
                entries.pop(0)
            entries.append(block)
            if write:
                memory[address] = data
            cost = 2 + (MEMORY_LATENCY + 2) * ((not hit) + write)
            assert int(event['hit']) == hit, (trace, cache, event)
            assert int(event['result_hex'], 16) == memory[address], (trace, cache, event)
            assert int(event['cycles']) == cost, (trace, cache, event)
            hits += hit
            cycles += cost
        assert int(measured['ways']) == ways, (trace, cache, measured)
        assert int(measured['latency']) == MEMORY_LATENCY, (trace, cache, measured)
        assert int(measured['requests']) == len(accesses)
        assert int(measured['hits']) == hits
        assert int(measured['misses']) == len(accesses) - hits
        assert int(measured['total_service_cycles']) == cycles
        assert abs(float(measured['hit_rate_percent']) - 100 * hits / len(accesses)) < .001
        assert abs(float(measured['average_cycles']) - cycles / len(accesses)) < .001
        rows.append({'trace': trace.stem, 'cache': cache, **measured})

with Path('results/comparison.csv').open('w', newline='') as file:
    writer = csv.DictWriter(file, fieldnames=rows[0].keys(), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
lines = ['# Measured RTL comparison', '',
         f'Memory latency: {MEMORY_LATENCY} cycles. Both caches have 64 data bytes and four-byte blocks.', '',
         '| Trace | Cache | Requests | Hits | Misses | Hit rate | Service cycles | Cycles/access |',
         '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for row in rows:
    lines.append(f"| {row['trace']} | {row['cache']} | {row['requests']} | {row['hits']} | "
                 f"{row['misses']} | {row['hit_rate_percent']}% | {row['total_service_cycles']} | "
                 f"{row['average_cycles']} |")
lines += ['', 'Service cycles count rising-edge intervals from CPU request acceptance to completion.',
          'They exclude idle gaps between requests. A read hit costs 2 cycles. Each memory transaction',
          'adds LATENCY + 2 cycles for request/acknowledgment handling. A write miss performs two',
          'memory transactions: block fetch and byte write. These are simulation cycles, not MHz.', '',
          'Every event, hit count, returned byte, and cycle total was also checked by a separate',
          'Python model using lists ordered by recency. Values above come from Verilog simulation.', '']
Path('results/comparison.md').write_text('\n'.join(lines))

print(f'PASS: All {len(rows)} runs match the independent Python model.\n')
print(f"{'Workload':<16} {'Requests':>8} {'Direct hit %':>13} {'Two-way hit %':>14} "
      f"{'Direct cycles':>14} {'Two-way cycles':>15}")
for direct, two_way in zip(rows[::2], rows[1::2]):
    print(f"{direct['trace']:<16} {direct['requests']:>8} "
          f"{direct['hit_rate_percent']:>13} {two_way['hit_rate_percent']:>14} "
          f"{direct['total_service_cycles']:>14} {two_way['total_service_cycles']:>15}")
print('\nCycles measure request acceptance to completion.')
print('Summary: results/comparison.md and results/comparison.csv')
print('Per-request CSVs: results/runs/')
