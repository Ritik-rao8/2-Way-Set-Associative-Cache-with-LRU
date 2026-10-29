/* Beginner-friendly behavioral model. No framework or live Verilog server.
   The same Cache class is used by the page and sim/web_test.js. */
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
    const block = Math.floor(address / 4);
    const index = block % this.setCount;
    const tag = Math.floor(block / this.setCount);
    const offset = address % 4;
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


// One entry per service cycle, matching the seven-state Verilog controller.
// The three wait entries are the memory's configured delay, not extra CPU accesses.
function cyclePhases(result) {
  const phases = [{state: 'LOOKUP', text: result.hit ? 'Tag match' : 'Tag mismatch'}];
  if (!result.hit) {
    phases.push({state: 'REFILL_REQUEST', text: 'Request block'});
    for (let tick = 1; tick <= 3; tick++) phases.push({state: 'REFILL_WAIT', text: `Memory ${tick}/3`, tick});
    phases.push({state: 'REFILL_WAIT', text: 'Fill block', install: true});
  }
  if (result.write) {
    phases.push({state: 'WRITE_REQUEST', text: 'Write through'});
    for (let tick = 1; tick <= 3; tick++) phases.push({state: 'WRITE_WAIT', text: `Write ${tick}/3`, tick});
    phases.push({state: 'WRITE_WAIT', text: 'Memory acknowledges'});
  }
  phases.push({state: 'RESPONSE', text: `${result.write ? 'Wrote' : 'Read'} ${hex(result.result, 2)}`});
  return phases;
}
const hex = (n, width = 4) => n.toString(16).toUpperCase().padStart(width, '0');
const LABELS = {conflict: 'Alternating conflict', repeated: 'Repeated address',
  sequential: 'Sequential bytes', lru: 'LRU replacement', capacity: 'Capacity overflow',
  three_blocks: 'Three colliding blocks', mixed: 'Mixed reads & writes'};
const NOTES = {conflict: '0000 and 0040 map to the same line. Watch it thrash.',
  repeated: 'One address. One compulsory miss. Then it stays put.',
  sequential: 'Read the neighbors. They came along with the block.',
  lru: 'A, B, A, C. B is older now. That’s the one I replace.',
  capacity: '128 bytes of working set. Only 64 bytes of room.',
  three_blocks: 'Three blocks, two slots. This time direct mapping wins.',
  mixed: 'Reads, writes, readbacks. Real traces don’t always favor two ways.',
  custom: 'Your addresses. Both caches start empty. Nothing is scripted.'};

// Independent acceptance constants from the project brief. Never used to drive animation.
const EXPECTED = {
  conflict: [0, 14, 112, 42, '0.000', '87.500'],
  repeated: [15, 15, 37, 37, '93.750', '93.750'],
  sequential: [112, 112, 336, 336, '87.500', '87.500'],
  lru: [0, 3, 49, 34, '0.000', '42.857'],
  capacity: [0, 0, 448, 448, '0.000', '0.000'],
  three_blocks: [7, 0, 133, 168, '29.167', '0.000'],
  mixed: [127, 119, 1077, 1117, '64.796', '60.714']
};
function selfTest(project) {
  const errors = [];
  for (const [name, expected] of Object.entries(EXPECTED)) {
    const caches = [new Cache(1), new Cache(2)];
    if (!project.traces[name]) { errors.push(`Missing ${name}`); continue; }
    for (const request of project.traces[name]) {
      for (const cache of caches) {
        const result = cache.access(request);
        if (cyclePhases(result).length !== result.cycles) errors.push(`${name}: visual timing mismatch`);
      }
    }
    const actual = [caches[0].hits, caches[1].hits, caches[0].cycles, caches[1].cycles,
      ...caches.map(c => (100 * c.hits / c.requests).toFixed(3))];
    if (actual.some((v, i) => v !== expected[i])) errors.push(`${name}: expected ${expected}, got ${actual}`);
    for (const [i, type] of ['direct', '2way'].entries()) {
      const row = project.results.find(r => r.trace === name && r.cache === type);
      if (!row || Number(row.hits) !== actual[i] || Number(row.total_service_cycles) !== actual[i + 2] ||
          row.hit_rate_percent !== actual[i + 4]) errors.push(`${name}/${type}: evidence bundle differs`);
    }
  }
  return {passed: errors.length === 0, errors};
}
if (typeof module !== 'undefined') module.exports = {Cache, cyclePhases, selfTest};
if (typeof document !== 'undefined') initLab();

function initLab() {
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let caches = [new Cache(1), new Cache(2)];
  let queue = [], custom = [], name = 'conflict', position = 0;
  let histories = [[], []], playing = false, busy = false, generation = 0, mobileView = 0;
  let builderAddress = 64, evidencePlaying = false, playGeneration = 0;
  const check = selfTest(PROJECT_DATA);
  document.documentElement.dataset.selfTest = check.passed ? 'passed' : 'failed';
  if (!check.passed) {
    $('self-test-warning').hidden = false;
    $('self-test-warning').textContent = 'Verification failed: ' + check.errors.join('; ');
    console.error(check.errors);
  }

  // Animation helper: only transform/opacity change over time. Layout stays still.
  function animate(element, frames, duration = 450) {
    if (element && !reduced.matches) element.animate(frames, {duration, easing: 'cubic-bezier(.16,1,.3,1)'});
  }
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const snapshot = cache => ({ways: cache.ways, setCount: cache.setCount, requests: cache.requests,
    hits: cache.hits, cycles: cache.cycles, last: cache.last,
    sets: cache.sets.map(set => set.map(line => ({...line, bytes: [...line.bytes]}))), lru: [...cache.lru]});

  function cellHTML(cache, index, way) {
    const line = cache.sets[index][way], r = cache.last;
    const active = r && r.index === index && r.way === way;
    const older = cache.ways === 2 && line.valid && cache.sets[index].every(l => l.valid) && cache.lru[index] === way;
    const label = `${cache.ways === 2 ? 'Set' : 'Line'} ${index}${cache.ways === 2 ? ` way ${way}` : ''}`;
    const blockAddress = (line.tag * cache.setCount + index) * 4;
    const tooltip = `${label}<br>Valid: ${Number(line.valid)} · Tag: ${line.valid ? hex(line.tag, 3) : '—'}<br>Bytes: ${line.valid ? line.bytes.map(v => hex(v, 2)).join(' ') : 'uninitialized'}${cache.ways === 2 ? `<br>${!line.valid ? 'Empty; fill before eviction' : older ? 'Older; next replacement' : 'Most recently used'}` : ''}`;
    return `<button class="memory-cell ${line.valid ? 'valid' : ''} ${active ? (r.hit ? 'active-hit' : 'active-miss') : ''}" data-cell="${index}-${way}" aria-label="${label}, ${line.valid ? `valid, block ${hex(blockAddress)}, bytes ${line.bytes.map(v => hex(v, 2)).join(' ')}` : 'empty'}${older ? ', older' : ''}"><span class="cell-top"><span>${cache.ways === 1 ? 'L' : 'S'}${String(index).padStart(2,'0')}${cache.ways === 2 ? ' / W'+way : ''}</span><span>V${Number(line.valid)}</span></span><span class="cell-tag">${line.valid ? hex(blockAddress) : '····'}</span><span class="cell-bytes">${line.bytes.map((v, offset) => `<i class="${active && offset === r.offset ? 'selected-byte' : ''}">${line.valid ? hex(v, 2) : '··'}</i>`).join('')}</span>${older ? '<span class="older">older ←</span>' : ''}<span class="cell-tooltip" aria-hidden="true">${tooltip}</span></button>`;
  }
  function gridHTML(cache) {
    return cache.sets.map((set, index) => cache.ways === 1 ? cellHTML(cache,index,0) :
      `<div class="set-pair">${cellHTML(cache,index,0)}${cellHTML(cache,index,1)}</div>`).join('');
  }
  function statsHTML(cache, i) {
    const rate = cache.requests ? 100 * cache.hits / cache.requests : 0;
    const points = histories[i].map((v,k,arr) => `${arr.length < 2 ? 0 : k/(arr.length-1)*76},${28-v*.26}`).join(' ');
    return `<div><strong>${cache.hits}</strong><small>hits</small></div><div><strong>${cache.requests-cache.hits}</strong><small>misses</small></div><div><strong>${rate.toFixed(1)}%</strong><small>hit rate</small></div><div><strong>${cache.cycles}</strong><small>cycles</small></div><svg class="spark" viewBox="0 0 78 30" role="img" aria-label="Hit rate history, now ${rate.toFixed(1)} percent"><polyline points="${points}"/></svg>`;
  }
  function fieldsHTML(cache, address) {
    const bits = address.toString(2).padStart(16,'0'), split = cache.ways === 1 ? 10 : 11;
    return `<div class="field tag"><small>TAG / ${split} BITS</small><code>${bits.slice(0,split)}</code></div><div class="field index"><small>${cache.ways === 1 ? 'LINE / 4' : 'SET / 3'} BITS</small><code>${bits.slice(split,14)}</code></div><div class="field offset"><small>BYTE / 2 BITS</small><code>${bits.slice(14)}</code></div>`;
  }
  function renderMachines(display = caches) {
    $('machines').innerHTML = display.map((cache,i) => {
      const r=cache.last, request=queue[position ? position-1 : 0];
      return `<article class="machine ${mobileView === i ? 'mobile-active' : ''}" id="machine-${i}" aria-label="${i === 0 ? 'Direct-mapped cache' : 'Two-way LRU cache'}"><div class="machine-title"><div><h3>${i === 0 ? 'Direct-mapped' : 'Two-way LRU'}</h3><small>${i === 0 ? '16 lines × 1 way' : '8 sets × 2 ways'} / 64 bytes</small></div><span id="status-${i}" class="machine-status ${r ? (r.hit ? 'hit' : 'miss') : ''}">${r ? (r.hit ? 'HIT' : 'MISS') : 'EMPTY'}</span></div><div class="decoder" id="decoder-${i}">${fieldsHTML(cache,request ? request.address : 0)}</div><div class="bus"><span class="packet"></span><span id="compare-${i}">${r ? `Tag ${hex(r.tag,3)} ${r.hit ? 'matched' : 'missed'} · ${i === 0 ? 'line' : 'set'} ${r.index}` : 'Waiting for an address'}</span></div><div class="memory-grid ${i === 1 ? 'two-way' : ''}" id="grid-${i}">${gridHTML(cache)}</div><div class="memory-channel" id="memory-${i}"><span id="mem-label-${i}">MAIN MEMORY</span><span class="wire"></span><span class="cycle-lights"><i></i><i></i><i></i></span><span id="mem-state-${i}">${r ? r.write ? 'WRITE ACK' : 'READY' : '3-CYCLE DELAY'}</span></div><div id="stats-${i}" class="machine-stats">${statsHTML(cache,i)}</div></article>`;
    }).join('');
  }
  function renderTimeline() {
    $('timeline').innerHTML = queue.map((r,i) => `<button class="trace-access ${i < position ? 'past' : ''} ${i === position-1 ? 'current' : ''} ${i === position ? 'next' : ''}" data-access="${i+1}" aria-label="Go to access ${i+1}, ${r.write ? 'write' : 'read'} ${hex(r.address)}" ${i === position-1 ? 'aria-current="step"' : ''}>${r.write ? 'W' : 'R'} ${hex(r.address)}</button>`).join('');
    $('scrub').max = queue.length;
    $('scrub').value = position;
    $('scrub').setAttribute('aria-valuetext', `${position} of ${queue.length} accesses completed`);
    $('progress').textContent = `${position} / ${queue.length}`;
    $('pattern-note').textContent = NOTES[name];
    const active = $('timeline').querySelector('.current');
    if (active) $('timeline').scrollLeft = Math.max(0, active.offsetLeft - $('timeline').offsetLeft - $('timeline').clientWidth / 2);
  }
  function controls() {
    $('back').disabled = position === 0;
    $('step').disabled = busy || position === queue.length;
    $('play').disabled = !queue.length || (position === queue.length && !busy);
    $('play').innerHTML = playing ? 'Pause Ⅱ' : 'Play ▷';
    $('play').setAttribute('aria-pressed', String(playing));
    $('run-state').textContent = busy ? 'IN FLIGHT' : position === queue.length && queue.length ? 'TRACE COMPLETE' : 'IDLE';
  }
  function renderHood() {
    $('hood-content').innerHTML = caches.map((c,i) => {
      const r=c.last;
      if (!r) return `<div><h4>${i ? 'Two-way LRU' : 'Direct-mapped'}</h4><p>No request yet.</p></div>`;
      const base=Math.floor(r.address/4)*4;
      const split=c.ways===1?10:11,bits=r.address.toString(2).padStart(16,'0');
      const path=cyclePhases(r).map(p=>p.state).filter((s,k,a)=>k===0||s!==a[k-1]);
      return `<div><h4>${i ? 'Two-way LRU' : 'Direct-mapped'}</h4><p>Tag | index | offset<br><code>${bits.slice(0,split)} | ${bits.slice(split,14)} | ${bits.slice(14)}</code></p><p>Memory block ${hex(base)}<br><code>${Array.from(c.memory.slice(base,base+4)).map(v=>hex(v,2)).join(' ')}</code></p><p>Controller path<br><code>IDLE → ${path.join(' → ')}</code></p><p>${r.cycles} service cycles for this request. ${(c.cycles/c.requests).toFixed(3)} average.<br>Write-through + write-allocate. Memory delay = 3 cycles.</p></div>`;
    }).join('');
  }
  function narrate() {
    if (!position) { $('narration').textContent='Both caches are empty. Send the first address.'; return; }
    const [a,b]=caches.map(c=>c.last);
    let text=a.hit===b.hit ? (a.hit ? 'Both hit. The byte was already here.' : 'Both miss. I fetch a four-byte block for each cache.') : b.hit ? 'Direct throws the block out again. Two-way kept it. Same address, different outcome.' : 'Direct kept this block in another line. The two-way set ran out of room. Direct wins this access.';
    if (b.evicted!==null) text+=` Two-way evicts ${hex(b.evicted)} from set ${b.index}, way ${b.way}.`;
    if (b.write) text+=` I write ${hex(b.data,2)} to the cache and to main memory.`;
    $('narration').textContent=text;
  }
  function updateRequest() {
    const r=queue[position ? position-1 : 0];
    $('request-label').textContent=r ? (r.write ? 'WRITE' : 'READ') : 'EMPTY TRACE';
    $('request-address').textContent=r ? '0x'+hex(r.address) : '0x····';
  }
  function stop() { playing=false; playGeneration++; controls(); }
  function seek(target) {
    generation++; playGeneration++; playing=false; busy=false;
    caches=[new Cache(1),new Cache(2)]; histories=[[],[]];
    position=Math.max(0,Math.min(queue.length,target));
    for (let j=0;j<position;j++) caches.forEach((cache,i)=>{cache.access(queue[j]);histories[i].push(100*cache.hits/cache.requests);});
    renderMachines(); renderTimeline(); updateRequest(); renderHood(); narrate(); controls();
  }
  function choose(next, replay=false) {
    name=next; queue=(next==='custom' ? custom : PROJECT_DATA.traces[next]).map(r=>({...r}));
    document.querySelectorAll('.pattern').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.pattern===next)));
    seek(0);
    if(replay && queue.length) { playing=true; controls(); playLoop(); }
  }

  async function step() {
    if(busy || position>=queue.length) return;
    const token=++generation, previous=caches.map(snapshot), request=queue[position];
    const results=caches.map(c=>c.access(request)), phases=results.map(cyclePhases);
    position++;busy=true;
    updateRequest();renderTimeline();controls();
    // Keep the old cells visible until the hit/fill cycle installs the new state.
    renderMachines(previous);
    results.forEach((r,i)=>{
      $('decoder-'+i).innerHTML=fieldsHTML(caches[i],request.address);
      document.querySelectorAll(`#decoder-${i} .field`).forEach((field,k)=>animate(field,[{transform:'translateY(-12px)',opacity:0},{transform:'translateY(0)',opacity:1}],320+k*90));
      const packet=document.querySelector(`#machine-${i} .packet`);
      const destination=$('grid-'+i).querySelector(`[data-cell="${r.index}-${r.way}"]`);
      const from=packet.getBoundingClientRect(),to=destination.getBoundingClientRect();
      const dx=to.left+to.width/2-from.left,dy=to.top+to.height/2-from.top;
      animate(packet,[{opacity:1,transform:'translate(0,-18px)'},{opacity:1,transform:`translate(${dx}px,${dy}px)`},{opacity:0,transform:`translate(${dx}px,${dy}px)`}],600);
    });
    const longest=Math.max(...phases.map(p=>p.length));
    for(let cycle=0;cycle<longest;cycle++) {
      if(token!==generation) return;
      results.forEach((r,i)=>{
        const phase=phases[i][cycle];
        if(!phase) return;
        const status=$('status-'+i), bus=$('compare-'+i), channel=$('memory-'+i);
        status.textContent=r.hit ? 'HIT' : 'MISS';status.className='machine-status '+(r.hit?'hit':'miss');
        bus.textContent=`${phase.text} · ${cycle+1}/${r.cycles}`;
        channel.classList.toggle('waiting',!!phase.tick);
        $('mem-label-'+i).textContent=phase.state.startsWith('WRITE') ? `WRITE ${hex(r.data,2)} → MEMORY` : 'MAIN MEMORY';
        $('mem-state-'+i).textContent=phase.tick ? `${phase.tick} / 3 CYCLES` : phase.state==='RESPONSE' ? 'ACKNOWLEDGED' : phase.state;
        channel.querySelectorAll('.cycle-lights i').forEach((light,k)=>light.classList.toggle('on',!!phase.tick && k<phase.tick));
        if((r.hit && cycle===0)||phase.install) {
          $('grid-'+i).innerHTML=gridHTML(caches[i]);
          const cell=$('grid-'+i).querySelector(`[data-cell="${r.index}-${r.way}"]`);
          animate(cell,[{opacity:.3,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],400);
          if(r.evicted!==null && phase.install) {
            const eject=document.createElement('span');eject.className='ejected';eject.textContent=hex(r.evicted)+' OUT';cell.append(eject);
            animate(eject,[{transform:'translate(0,0)',opacity:1},{transform:'translate(0,-45px)',opacity:0}],600);
            setTimeout(()=>eject.remove(),600);
          }
          cell.querySelectorAll('.older').forEach(label=>animate(label,[{transform:'translateX(-8px)',opacity:0},{transform:'translateX(0)',opacity:1}],400));
        }
        if(phase.state==='RESPONSE') {
          histories[i].push(100*caches[i].hits/caches[i].requests);
          $('stats-'+i).innerHTML=statsHTML(caches[i],i);
        }
      });
      // Reduced motion skips visual travel and waits; computed cycle counts stay identical.
      if(!reduced.matches) await sleep(Number($('speed').value));
    }
    if(token!==generation) return;
    busy=false;renderHood();narrate();controls();
    if(evidencePlaying) $('evidence-preview').textContent=`Replaying ${LABELS[name] || 'custom'}: ${position}/${queue.length}. Hits ${caches[0].hits} / ${caches[1].hits}. Cycles ${caches[0].cycles} / ${caches[1].cycles}.`;
  }
  async function playLoop() {
    const playToken=++playGeneration;
    while(playing && playToken===playGeneration && position<queue.length) {
      await step();
      if(playing) await sleep(reduced.matches ? 80 : 160);
    }
    if(playToken===playGeneration && position===queue.length) stop();
  }
  function togglePlay() {
    if(playing) {stop();return;}
    if(position>=queue.length) seek(0);
    playing=true;controls();playLoop();
  }

  // Miniature trace plots make each workload recognizable before selecting it.
  $('patterns').innerHTML=Object.keys(LABELS).map(key=>{
    const trace=PROJECT_DATA.traces[key].slice(0,16);
    const points=trace.map((r,i)=>`${i*6},${20-(r.address%128)/128*18}`).join(' ');
    return `<button class="pattern" data-pattern="${key}" aria-pressed="${key===name}"><svg viewBox="0 0 96 24" aria-hidden="true"><polyline points="${points}"/></svg>${LABELS[key]}</button>`;
  }).join('');
  $('patterns').addEventListener('click',event=>{const b=event.target.closest('[data-pattern]');if(b)choose(b.dataset.pattern);});
  $('step').addEventListener('click',()=>{stop();step();});
  $('back').addEventListener('click',()=>seek(position-1));
  $('reset').addEventListener('click',()=>seek(0));
  $('play').addEventListener('click',togglePlay);
  $('scrub').addEventListener('input',event=>seek(Number(event.target.value)));
  $('timeline').addEventListener('click',event=>{const b=event.target.closest('[data-access]');if(b)seek(Number(b.dataset.access));});
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    mobileView=Number(button.dataset.view);
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    document.querySelectorAll('.machine').forEach((machine,i)=>machine.classList.toggle('mobile-active',i===mobileView));
  }));
  document.addEventListener('keydown',event=>{
    if(event.target.closest('input,select,textarea,button,a,summary,[contenteditable]')||event.altKey||event.ctrlKey||event.metaKey)return;
    const rect=$('bench').getBoundingClientRect();
    if(rect.bottom<0||rect.top>innerHeight)return;
    if(event.code==='Space'){event.preventDefault();togglePlay();}
    if(event.key==='ArrowLeft'){event.preventDefault();seek(position-1);}
    if(event.key==='ArrowRight'){event.preventDefault();stop();step();}
  });

  function renderBuilder() {
    $('bit-flipper').innerHTML=Array.from({length:16},(_,i)=>{
      const bit=15-i,value=(builderAddress>>bit)&1;
      return `<button type="button" data-bit="${bit}" aria-label="Bit ${bit}" aria-pressed="${!!value}">${value}</button>`;
    }).join('');
    $('address').value=hex(builderAddress);
    const direct=Math.floor(builderAddress/4)%16,two=Math.floor(builderAddress/4)%8;
    // Show a real conflicting address: toggle bit 6, which leaves both indices unchanged.
    const conflict=builderAddress^64;
    $('mapping').innerHTML=`<strong>0x${hex(builderAddress)}</strong> maps here.<svg viewBox="0 0 360 100" role="img" aria-label="${hex(builderAddress)} and ${hex(conflict)} both map to direct line ${direct}, two-way set ${two}"><text x="5" y="18">${hex(builderAddress)}</text><text x="5" y="83">${hex(conflict)}</text><path d="M60 14H100V45H185M60 80H100V45M185 45H220V20H240M220 45V80H240"/><text x="245" y="24">LINE ${direct}</text><text x="245" y="84">SET ${two}</text></svg><p>Flip bit 6: 0x${hex(conflict)} conflicts with this address.<br>Direct tag ${hex(builderAddress>>6,3)} · two-way tag ${hex(builderAddress>>5,3)} · byte ${builderAddress%4}.</p>`;
    $('custom-count').textContent=`${custom.length} custom ${custom.length===1?'access':'accesses'}`;
  }
  $('bit-flipper').addEventListener('click',event=>{
    const b=event.target.closest('[data-bit]');if(!b)return;
    builderAddress^=1<<Number(b.dataset.bit);renderBuilder();
    $('bit-flipper').querySelector(`[data-bit="${b.dataset.bit}"]`).focus();
    $('form-error').textContent='';
  });
  $('address').addEventListener('input',event=>{
    const text=event.target.value.trim().replace(/^0x/i,'');
    if(/^[0-9a-f]{1,4}$/i.test(text)){
      builderAddress=parseInt(text,16);
      const selection=event.target.selectionStart, original=event.target.value;
      renderBuilder();event.target.value=original;event.target.setSelectionRange(selection,selection);
      $('form-error').textContent='';
    }
  });
  $('operation').addEventListener('change',()=>{$('byte').disabled=$('operation').value==='0';});
  $('custom-form').addEventListener('submit',event=>{
    event.preventDefault();
    const a=$('address').value.trim().replace(/^0x/i,''),d=$('byte').value.trim().replace(/^0x/i,''),write=$('operation').value==='1';
    if(!/^[0-9a-f]{1,4}$/i.test(a)||(write&&!/^[0-9a-f]{1,2}$/i.test(d))){$('form-error').textContent='Address: 0000–FFFF. Write byte: 00–FF. Hex only.';return;}
    custom.push({address:parseInt(a,16),write,data:write?parseInt(d,16):0});
    $('form-error').textContent='';renderBuilder();choose('custom');
  });
  $('new-trace').addEventListener('click',()=>{custom=[];renderBuilder();choose('custom');});
  $('run-custom').addEventListener('click',()=>{if(!custom.length){$('form-error').textContent='Add an access first.';return;}choose('custom',true);});

  // Measured data stays independent of the live model and uses exact CSV precision.
  $('comparison').innerHTML=Object.keys(LABELS).map(key=>{
    const a=PROJECT_DATA.results.find(r=>r.trace===key&&r.cache==='direct');
    const b=PROJECT_DATA.results.find(r=>r.trace===key&&r.cache==='2way');
    return `<button class="workload ${key==='three_blocks'||key==='mixed'?'surprise':''}" data-replay="${key}" aria-label="Replay ${LABELS[key]}"><span class="workload-title">${LABELS[key]}<small>${a.total_service_cycles} / ${b.total_service_cycles} cycles</small></span><div class="paired-bar"><div class="bar-track"><div class="bar-fill" style="transform:scaleX(${Number(a.hit_rate_percent)/100})"></div></div><span>${a.hit_rate_percent}%</span></div><div class="paired-bar"><div class="bar-track"><div class="bar-fill two" style="transform:scaleX(${Number(b.hit_rate_percent)/100})"></div></div><span>${b.hit_rate_percent}%</span></div></button>`;
  }).join('');
  $('data-table').innerHTML='<table><caption class="sr-only">Measured Verilog results</caption><thead><tr><th>Workload</th><th>Direct hit %</th><th>Two-way hit %</th><th>Direct cycles</th><th>Two-way cycles</th></tr></thead><tbody>'+Object.keys(LABELS).map(key=>{
    const a=PROJECT_DATA.results.find(r=>r.trace===key&&r.cache==='direct'),b=PROJECT_DATA.results.find(r=>r.trace===key&&r.cache==='2way');
    return `<tr><th scope="row">${LABELS[key]}</th><td>${a.hit_rate_percent}</td><td>${b.hit_rate_percent}</td><td>${a.total_service_cycles}</td><td>${b.total_service_cycles}</td></tr>`;
  }).join('')+'</tbody></table>';
  $('table-toggle').addEventListener('click',()=>{
    const show=$('data-table').hidden;$('data-table').hidden=!show;$('comparison').hidden=show;
    $('table-toggle').textContent=show?'View as chart':'View as table';$('table-toggle').setAttribute('aria-expanded',String(show));
  });
  document.querySelectorAll('[data-replay]').forEach(button=>{
    button.addEventListener('pointerenter',()=>{if(matchMedia('(hover:hover)').matches){evidencePlaying=true;choose(button.dataset.replay,true);}});
    button.addEventListener('pointerleave',()=>{if(evidencePlaying){stop();evidencePlaying=false;}});
    button.addEventListener('click',()=>{evidencePlaying=false;choose(button.dataset.replay,true);$('bench').scrollIntoView({behavior:reduced.matches?'instant':'smooth'});});
  });
  $('twist-replay').addEventListener('click',()=>{choose('three_blocks',true);$('bench').scrollIntoView({behavior:reduced.matches?'instant':'smooth'});});

  // Scroll-driven walkthrough: observe the text, update the pinned hardware drawing.
  const walkMessages=['Index bits 000 select set 0.','Valid + tag 002: way 1 matches.','Offset 11 selects byte 3 → 43.','Way 1 was used. Way 0 is older.'];
  const walkObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      entry.target.classList.toggle('in-view',entry.isIntersecting);
      if(entry.isIntersecting){
        const stage=Number(entry.target.dataset.stage);
        $('walk-diagram').dataset.stage=stage;$('walk-status').textContent=walkMessages[stage];
        animate($('walk-diagram'),[{opacity:.55,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],500);
      }
    });
  },{rootMargin:'-30% 0px -30% 0px',threshold:0});
  document.querySelectorAll('.walk-steps article').forEach(article=>walkObserver.observe(article));

  // Ambient preview also runs the real model. It only ticks while visible.
  let ambient=[new Cache(1),new Cache(2)], ambientIndex=0,ambientTimer=null,ambientPaused=reduced.matches,heroVisible=false;
  function ambientTick(){
    const address=ambientIndex++%2?64:0;
    $('ambient-address').textContent='0x'+hex(address);
    ambient.forEach((cache,i)=>{
      const result=cache.access({address,data:0,write:false});
      const id=i?'ambient-two':'ambient-direct',status=$(id+'-status');
      status.textContent=result.hit?'HIT':'MISS';status.className=result.hit?'hit':'';
      $(id).innerHTML=cache.sets.flatMap((set,index)=>set.map((line,way)=>`<span class="${line.valid?(i?'lit':'thrash'):''}">${line.valid?hex((line.tag*cache.setCount+index)*4):'·'}</span>`)).join('');
      animate($(id).children[i?result.way:0],[{opacity:.35,transform:'scale(.9)'},{opacity:1,transform:'scale(1)'}],600);
    });
    if(ambientIndex>40){ambient=[new Cache(1),new Cache(2)];ambientIndex=0;}
  }
  function ambientControl(){
    clearInterval(ambientTimer);ambientTimer=null;
    if(heroVisible&&!ambientPaused&&!document.hidden)ambientTimer=setInterval(ambientTick,1600);
    $('ambient-toggle').textContent=ambientPaused?'▷':'Ⅱ';
    $('ambient-toggle').setAttribute('aria-label',`${ambientPaused?'Play':'Pause'} ambient demonstration`);
  }
  const heroObserver=new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;ambientControl();},{threshold:.1});
  heroObserver.observe(document.querySelector('.hero'));
  $('ambient-toggle').addEventListener('click',()=>{ambientPaused=!ambientPaused;ambientControl();});
  document.addEventListener('visibilitychange',()=>{ambientControl();if(document.hidden)stop();});
  reduced.addEventListener('change',()=>{ambientPaused=reduced.matches;ambientControl();});
  ambientTick();renderBuilder();choose('conflict');
}
