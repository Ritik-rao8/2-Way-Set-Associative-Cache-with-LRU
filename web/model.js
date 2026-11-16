// Shared by the browser and the RTL comparison test.
function decodeAddress(address, setCount) {
  const block = Math.floor(address / 4);
  return {
    block,
    index: block % setCount,
    tag: Math.floor(block / setCount),
    offset: address % 4
  };
}

class Cache {
  constructor(ways) {
    this.ways = ways;
    this.setCount = 16 / ways;
    this.sets = Array.from({length: this.setCount}, () =>
      Array.from({length: ways}, () => ({valid: false, tag: 0, bytes: [0, 0, 0, 0]})));
    this.lru = Array(this.setCount).fill(0);
    this.memory = Uint8Array.from({length: 65536}, (_, a) => (a ^ (a >> 8)) & 255);
    this.requests = 0;
    this.hits = 0;
    this.cycles = 0;
    this.last = null;
  }

  access(request) {
    const {address, data, write} = request;
    if (!Number.isInteger(address) || address < 0 || address > 65535 ||
        !Number.isInteger(data) || data < 0 || data > 255 || typeof write !== 'boolean') {
      throw new Error('Invalid memory request');
    }
    const {block, index, tag, offset} = decodeAddress(address, this.setCount);
    const set = this.sets[index];
    let way = set.findIndex(line => line.valid && line.tag === tag);
    const hit = way !== -1;
    let evicted = null;
    if (!hit) {
      way = set.findIndex(line => !line.valid);
      if (way === -1) way = this.lru[index];
      const line = set[way];
      if (line.valid) evicted = (line.tag * this.setCount + index) * 4;
      line.valid = true;
      line.tag = tag;
      line.bytes = Array.from(this.memory.slice(block * 4, block * 4 + 4));
    }
    const line = set[way];
    if (write) {
      line.bytes[offset] = data;
      this.memory[address] = data;
    }
    if (this.ways === 2) this.lru[index] = 1 - way;
    // Match the verified RTL: 2 base cycles plus 5 per memory transaction.
    const cycles = 2 + 5 * (Number(!hit) + Number(write));
    this.requests++;
    if (hit) this.hits++;
    this.cycles += cycles;
    this.last = {address, write, data, index, tag, offset, way, hit, evicted,
      result: line.bytes[offset], cycles};
    return this.last;
  }
}

// The RTL uses two base cycles and five per memory operation at latency 3.
function cycleBreakdown({hit, write}) {
  const steps = [{label: 'Check tags', cycles: 1}];
  if (!hit) steps.push({label: 'Fetch the block', cycles: 5});
  if (write) steps.push({label: 'Write to memory', cycles: 5});
  steps.push({label: 'Reply to CPU', cycles: 1});
  return steps;
}

if (typeof module !== 'undefined') module.exports = {Cache, decodeAddress, cycleBreakdown};
