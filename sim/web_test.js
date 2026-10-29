// Test the actual browser Cache class against every saved RTL response.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {Cache, selfTest, cyclePhases} = require('../web/script.js');
const root = path.resolve(__dirname, '..');
const data = vm.runInNewContext(fs.readFileSync(path.join(root, 'web/data.js'), 'utf8') + '\nPROJECT_DATA;');
function csv(file) {
  const [header, ...lines] = fs.readFileSync(path.join(root, file), 'utf8').trim().split(/\r?\n/);
  return lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [header.split(',')[i], v])));
}
let checked = 0;
for (const [name, trace] of Object.entries(data.traces)) {
  const source = fs.readFileSync(path.join(root, `traces/${name}.txt`), 'utf8').trim().split('\n');
  assert.equal(trace.length, source.length);
  for (const [kind, ways] of [['direct', 1], ['2way', 2]]) {
    const cache = new Cache(ways);
    const events = csv(`results/${name}_${kind}_events.csv`);
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
    const measured = csv(`results/${name}_${kind}.csv`)[0];
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

assert.equal(selfTest(data).passed, true, 'Built-in acceptance test');
const changed = JSON.parse(JSON.stringify(data));
changed.traces.conflict.pop();
assert.equal(selfTest(changed).passed, false, 'Self-test detects an altered trace');
for (const write of [false,true]) {
  const cache = new Cache(2);
  for(let i=0;i<2;i++) {
    const result=cache.access({write,address:0,data:42});
    assert.equal(cyclePhases(result).length,result.cycles);
    const waits=cyclePhases(result).filter(p=>p.tick);
    assert.equal(waits.length,3*(Number(!result.hit)+Number(write)));
  }
}
console.log('PASS: exact seven-workload self-test, failure detection, and animated memory-cycle accounting.');
