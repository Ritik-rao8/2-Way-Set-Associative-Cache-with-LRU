"""Refresh the buildless website's inputs from the checked-in RTL evidence."""
import csv
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
traces = {}
for path in sorted((root / 'traces').glob('*.txt')):
    traces[path.stem] = []
    for line in path.read_text().splitlines():
        operation, address, data = line.split()
        traces[path.stem].append({'write': bool(int(operation)),
                                 'address': int(address, 16), 'data': int(data, 16)})
with (root / 'results/comparison.csv').open() as file:
    results = list(csv.DictReader(file))
(root / 'web/data.js').write_text(
    '// Generated from traces/ and results/comparison.csv by sim/prepare_web.py.\n'
    'const PROJECT_DATA = ' + json.dumps({'traces': traces, 'results': results}, indent=2) + ';\n')
print('Updated web/data.js with seven traces and 14 measured results.')
