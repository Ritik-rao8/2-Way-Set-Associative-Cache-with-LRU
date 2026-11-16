// Test the actual browser Cache class against every saved RTL response.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {Cache, decodeAddress, cycleBreakdown} = require('../model.js');
const root = path.resolve(__dirname, '../..');
const data = vm.runInNewContext(fs.readFileSync(path.join(root, 'web/data.js'), 'utf8') + '\nPROJECT_DATA;');
function csv(file) {
  const [header, ...lines] = fs.readFileSync(path.join(root, file), 'utf8').trim().split(/\r?\n/);
  return lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [header.split(',')[i], v])));
}
let checked = 0;
for (const [name, trace] of Object.entries(data.traces)) {
  const source = fs.readFileSync(path.join(root, `verilog/traces/${name}.txt`), 'utf8').trim().split('\n');
  assert.equal(trace.length, source.length);
  for (const [kind, ways] of [['direct', 1], ['2way', 2]]) {
    const cache = new Cache(ways);
    const events = csv(`results/runs/${name}_${kind}_events.csv`);
    assert.equal(events.length, trace.length);
    trace.forEach((request, i) => {
      const [write, address, value] = source[i].split(' ');
      assert.equal(request.write, write === '1');
      assert.equal(request.address, parseInt(address, 16));
      assert.equal(request.data, parseInt(value, 16));
      const result = cache.access(request);
      assert.equal(Number(result.hit), Number(events[i].hit), `${name}/${kind}/${i} hit`);
      assert.equal(result.result, parseInt(events[i].result_hex, 16), `${name}/${kind}/${i} data`);
      assert.equal(result.cycles, Number(events[i].cycles), `${name}/${kind}/${i} cycles`);
      checked++;
    });
    const measured = csv(`results/runs/${name}_${kind}.csv`)[0];
    const bundled = data.results.find(r => r.trace === name && r.cache === kind);
    for (const key of Object.keys(measured)) assert.equal(bundled[key], measured[key]);
    assert.equal(cache.requests, Number(measured.requests));
    assert.equal(cache.hits, Number(measured.hits));
    assert.equal(cache.cycles, Number(measured.total_service_cycles));
  }
}
// Boundary, invalid-input, and neighboring-byte tests beyond the preset traces.
for (const ways of [1, 2]) {
  const cache = new Cache(ways);
  const before = Array.from(cache.memory.slice(65532));
  cache.access({write:true, address:65535, data:42});
  assert.equal(cache.access({write:false, address:65535, data:0}).result, 42);
  assert.deepEqual(Array.from(cache.memory.slice(65532,65535)), before.slice(0,3));
  assert.throws(() => cache.access({write:true, address:65536, data:0}));
  assert.throws(() => cache.access({write:true, address:0, data:256}));
  assert.equal(new Cache(ways).requests, 0);
}
console.log(`PASS: browser model matches ${checked} RTL events across all 14 runs; data bundle, boundaries, writes and validation checked.`);

assert.deepEqual(decodeAddress(0x0043, 8), {block: 16, index: 0, tag: 2, offset: 3});
assert.equal(data.csv, fs.readFileSync(path.join(root, 'results/comparison.csv'), 'utf8'));
const demo = new Cache(2);
const steps = data.traces.lru.slice(0, 4).map(request => demo.access(request));
assert.deepEqual(Array.from(steps, step => step.hit), [false, false, true, false]);
assert.equal(steps.at(-1).evicted, 0x0040);
for (const write of [false, true]) {
  const cache = new Cache(2);
  for (let i = 0; i < 2; i++) {
    const result = cache.access({write, address: 0, data: 42});
    const illustratedCycles = cycleBreakdown(result).reduce((sum, step) => sum + step.cycles, 0);
    assert.equal(illustratedCycles, result.cycles);
  }
}
console.log('PASS: guided eviction, address fields, downloadable CSV, and cycle breakdown.');
