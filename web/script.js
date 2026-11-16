const byId = id => document.getElementById(id);
const hex = (value, width = 4) => value.toString(16).toUpperCase().padStart(width, '0');
const addressText = value => '0x' + hex(value);
const operationName = request => request.write ? 'Write' : 'Read';
const cacheNames = ['Direct-mapped', 'Two-way LRU'];
const traceLabels = {
  conflict: 'Alternating conflict',
  lru: 'LRU replacement',
  repeated: 'Repeated address',
  sequential: 'Sequential bytes',
  capacity: 'Capacity overflow',
  three_blocks: 'Three colliding blocks',
  mixed: 'Mixed reads and writes'
};
const scenarios = {
  ...PROJECT_DATA.traces,
  lru_demo: [...PROJECT_DATA.traces.lru.slice(0, 5), PROJECT_DATA.traces.lru[6]],
  conflict_demo: PROJECT_DATA.traces.conflict.slice(0, 4),
  locality_demo: PROJECT_DATA.traces.sequential.slice(0, 4),
  write_demo: [
    {write: true, address: 0x0043, data: 0x2A},
    {write: false, address: 0x0043, data: 0},
    {write: false, address: 0x0042, data: 0}
  ],
  custom: []
};
const intro = {
  lru_demo: 'Use A again before C arrives. Watch which block leaves.',
  conflict_demo: 'A and B share a location. Can both stay?',
  locality_demo: 'One fetch brings in four bytes. The next three reads can use them.',
  write_demo: 'Write 0x2A to offset 3, read it back, then read the neighboring byte at offset 2.'
};
const lruStory = [
  'A arrives and fills the first slot.',
  'Two slots can hold A and B together.',
  'Use A again. B is now the least recently used block.',
  'C arrives. B was used less recently, so B leaves.',
  'A hits again. It stayed in the cache.',
  'B misses. Fetch it again from memory.'
];
const lruBlocks = {0x0000: 'A', 0x0040: 'B', 0x0080: 'C'};
const blockName = address => lruBlocks[address - address % 4] || addressText(address - address % 4);
const blockColor = address => ['blue', 'amber', 'rose'][Math.floor(address / 64) % 3];
const lessonTitles = {
  conflict_demo: 'Two blocks, one slot',
  lru_demo: 'Which block leaves?',
  locality_demo: 'Fetch the neighbours'
};

let scenario = 'conflict_demo';
let caches;
let position = 0;
let timer = null;

function renderQueue() {
  const trace = scenarios[scenario];
  const queue = byId('queue');
  queue.replaceChildren();
  byId('seek-row').hidden = trace.length <= 8;
  byId('seek').max = trace.length;
  if (trace.length > 8) return;
  if (!trace.length) {
    const message = document.createElement('span');
    message.textContent = 'Add an address using the custom trace form.';
    queue.append(message);
  }
  trace.forEach((request, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    const block = blockName(request.address);
    button.innerHTML = `<b class="queue-block ${blockColor(request.address)}">${block}</b><small>${operationName(request)} ${addressText(request.address)}</small>`;
    button.setAttribute('aria-label', `Request ${index + 1}, ${operationName(request)} ${addressText(request.address)}`);
    button.addEventListener('click', () => {
      pause();
      goTo(index + 1);
    });
    queue.append(button);
  });
}

function showLine(cache, index, way, result, label) {
  const line = cache.sets[index][way];
  const active = result && result.index === index && result.way === way;
  const block = addressText((line.tag * cache.setCount + index) * 4);
  const fullSet = cache.ways === 2 && cache.sets[index].every(slot => slot.valid);
  const recency = fullSet ? (cache.lru[index] === way ? 'Next victim' : 'Most recent') : '';
  return `<div class="line${active ? ' active' : ''}">
    <div class="line-label"><span>${label}</span><small>${recency}</small></div>
    <strong class="block">${line.valid ? block : 'Empty'}</strong>
    <div class="bytes">${line.bytes.map((byte, offset) =>
      `<span${active && offset === result.offset ? ' class="selected"' : ''}>${line.valid ? hex(byte, 2) : '··'}</span>`
    ).join('')}</div>
  </div>`;
}

function slotCard(cache, index, line, way, result, before) {
  const address = (line.tag * cache.setCount + index) * 4;
  const selected = !before && result?.way === way;
  const evicted = before && result?.evicted === address && line.valid;
  const recent = !before && cache.ways === 2 && line.valid && cache.last;
  const label = evicted ? 'Leaves' : recent
    ? (cache.lru[index] === way ? (cache.sets[index].every(slot => slot.valid) ? 'Next to leave' : '') : 'Just used') : '';
  return `<div class="visual-slot ${line.valid ? blockColor(address) : 'empty'} ${selected ? (result.hit ? 'hit-slot' : 'arrived') : ''} ${evicted ? 'evicted' : ''}">
    <span class="slot-way">${cache.ways === 2 ? 'Way ' + way : 'Line ' + index}</span>
    <strong>${line.valid ? blockName(address) : '—'}</strong>
    <small>${line.valid ? addressText(address) : 'Empty'}</small>
    <span class="recency">${label}</span>
  </div>`;
}

function renderCache(cache, name, index) {
  const result = cache.last;
  const target = result?.index ?? index;
  const state = result ? (result.hit ? 'Hit' : 'Miss') : 'Ready';
  const before = cache.before?.[target] || cache.sets[target];
  const route = !result ? 'Ready for the first read' : result.hit
    ? (result.write ? 'CPU → cache → memory' : 'CPU ← cache')
    : (result.write ? 'Fetch block → write cache & memory' : 'Memory → cache → CPU');
  const action = !result ? 'Press Next access to begin.' : result.evicted !== null
    ? `${blockName(result.evicted)} leaves → ${blockName(result.address)} takes its slot`
    : result.hit ? `${blockName(result.address)} is already here`
    : `${blockName(result.address)} fills an empty slot`;
  const bytes = scenario === 'locality_demo' ? `<div class="locality-bytes">${cache.sets[target][result?.way ?? 0].bytes.map((byte, offset) =>
    `<span class="${result?.offset === offset ? 'selected' : ''}">Byte ${offset}<b>${result ? hex(byte, 2) : '··'}</b></span>`).join('')}</div>` : '';
  return `<article class="cache">
    <div class="cache-header"><div><h3>${name}</h3><p>${cache.ways === 2 ? 'Two slots in each set' : 'One slot per line'}</p></div>
      <span class="result ${state.toLowerCase()}">${state}</span>
    </div>
    <p class="location">${cache.ways === 2 ? 'Set' : 'Line'} ${target} · ${cache.setCount} ${cache.ways === 2 ? 'sets' : 'lines'} in total</p>
    <div class="slot-stage"><span class="stage-label">Before</span><div class="slots">${before.map((line, way) => slotCard(cache, target, line, way, result, true)).join('')}</div></div>
    <div class="flow-arrow" aria-hidden="true">↓</div>
    <div class="slot-stage"><span class="stage-label">After</span><div class="slots">${cache.sets[target].map((line, way) => slotCard(cache, target, line, way, result, false)).join('')}</div></div>
    ${bytes}
    <div class="request-stages" aria-label="Request stages">${result ? cycleBreakdown(result).map((step, i) =>
      `<span style="--stage:${i}"><b>${step.label}</b><small>${step.cycles} ${step.cycles === 1 ? 'cycle' : 'cycles'}</small></span>`).join('<i aria-hidden="true">→</i>') : '<span>Check cache → fetch if needed → reply</span>'}</div>
    <p class="action">${action}${result?.write ? ` · write 0x${hex(result.data, 2)}` : ''}</p>
    <div class="access-path ${state.toLowerCase()}">${route}${result ? `<strong>${result.cycles} cycles</strong>` : ''}</div>
    <div class="summary-row"><span>${cache.hits} / ${cache.requests} hits</span><span>${cache.cycles} total cycles</span></div>
  </article>`;
}

function renderDetails(request) {
  byId('details-content').innerHTML = caches.map((cache, i) => {
    const address = request?.address ?? 0;
    const {index, tag, offset} = decodeAddress(address, cache.setCount);
    const indexBits = cache.ways === 2 ? 3 : 4;
    const parts = [
      ['Tag', tag, 14 - indexBits],
      [cache.ways === 2 ? 'Set' : 'Line', index, indexBits],
      ['Offset', offset, 2]
    ];
    const timing = cache.last
      ? cycleBreakdown(cache.last).map(step => `${step.label} (${step.cycles})`).join(' → ')
      : 'Step once to see the cycle breakdown.';
    return `<article><h3>${cacheNames[i]} · ${addressText(address)}</h3><div class="field-list">${parts.map(
      ([label, value, width]) => `<span>${label} ${value}<b>${value.toString(2).padStart(width, '0')}</b></span>`
    ).join('')}</div><p>${timing}</p></article>`;
  }).join('');
}

function renderAllLines() {
  byId('all-lines-content').innerHTML = caches.map((cache, i) =>
    `<article><h3>${cacheNames[i]}</h3>${cache.sets.map((set, index) =>
      `<div class="detail-set"><p>${cache.ways === 2 ? 'Set' : 'Line'} ${index}</p><div class="lines">${set.map((_, way) =>
        showLine(cache, index, way, cache.last, cache.ways === 2 ? `Way ${way}` : `Line ${index}`)
      ).join('')}</div></div>`
    ).join('')}</article>`
  ).join('');
}

function renderLessonResult() {
  const panel = byId('lesson-result');
  panel.hidden = !position || position !== scenarios[scenario].length;
  if (panel.hidden) return;
  const largest = Math.max(...caches.map(cache => cache.cycles));
  panel.innerHTML = `<h3>Same requests. Compare the results.</h3><div class="result-columns">${caches.map((cache, i) =>
    `<div><h4>${cacheNames[i]}</h4><div class="access-dots" aria-label="Hit and miss sequence">${cache.history.map((result, index) =>
      `<span class="${result.hit ? 'hit' : 'miss'}" title="Request ${index + 1}: ${result.hit ? 'hit' : 'miss'}">${result.hit ? 'H' : 'M'}</span>`).join('')}</div>
      <p>${cache.hits} hits · ${cache.requests - cache.hits} misses</p>
      <div class="cycle-bar" role="img" aria-label="${cache.cycles} total cycles"><span style="width:${100 * cache.cycles / largest}%"></span></div>
      <strong>${cache.cycles} total cycles</strong></div>`).join('')}</div>`;
}

function animateAccess() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.cache').forEach((panel, i) => {
    const result = caches[i].last;
    if (!result) return;
    const target = panel.querySelector('.arrived');
    if (target) {
      const token = document.createElement('div');
      token.className = `moving-block ${blockColor(result.address)}`;
      token.textContent = blockName(result.address);
      token.setAttribute('aria-hidden', 'true');
      panel.append(token);
      const card = target.getBoundingClientRect();
      const parent = panel.getBoundingClientRect();
      token.style.left = `${card.left - parent.left + card.width / 2 - 22}px`;
      token.style.top = `${card.top - parent.top + 25}px`;
      const motion = token.animate([
        {transform: 'translateY(-100px)', opacity: 0},
        {transform: 'translateY(-65px)', opacity: 1, offset: .25},
        {transform: 'translateY(0)', opacity: 1, offset: .85},
        {transform: 'translateY(0)', opacity: 0}
      ], {duration: 1100, easing: 'ease-in-out'});
      motion.onfinish = () => token.remove();
    }
    panel.querySelector('.evicted strong')?.animate([
      {transform: 'translateX(0)', opacity: 1},
      {transform: 'translateX(35px)', opacity: .25},
      {transform: 'translateX(0)', opacity: 1}
    ], {duration: 900});
    panel.querySelector('.hit-slot')?.animate([
      {boxShadow: '0 0 0 0px #21996a'},
      {boxShadow: '0 0 0 5px #21996a'},
      {boxShadow: '0 0 0 2px #21996a'}
    ], {duration: 900});
  });
}

function render() {
  const trace = scenarios[scenario];
  const request = trace[position ? position - 1 : 0];
  byId('progress').textContent = `${position} / ${trace.length} completed`;
  byId('seek').value = position;
  byId('previous').disabled = position === 0;
  byId('next').disabled = position === trace.length;
  byId('reset').disabled = position === 0;
  byId('play').disabled = !trace.length || position === trace.length;
  byId('request-label').textContent = !request ? 'Waiting for a request'
    : position ? operationName(request) + ' request' : 'First request';
  byId('request-address').textContent = request
    ? blockName(request.address) + ' · ' + addressText(request.address) + (request.write ? ' ← 0x' + hex(request.data, 2) : '') : '—';

  document.querySelectorAll('[data-lesson]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.lesson === scenario)));
  byId('sim-title').textContent = lessonTitles[scenario] || traceLabels[scenario] || (scenario === 'custom' ? 'Try your own addresses' : 'Write a byte, read it back');
  const [direct, twoWay] = caches.map(cache => cache.last);
  const summary = twoWay && (direct.hit === twoWay.hit
    ? `Both caches ${twoWay.hit ? 'hit' : 'miss'} on this request.`
    : `${direct.hit ? 'Direct mapping hits and two-way misses.' : 'Direct mapping misses and two-way hits.'}`);
  byId('narration').textContent = position
    ? ((scenario === 'lru_demo' || (scenario === 'lru' && position <= 4)) && lruStory[position - 1]) || summary
    : intro[scenario] || (trace.length ? 'Both caches are empty. Select Next access to send the first request.' : 'Add a read or write to begin.');
  byId('caches').innerHTML = caches.map((cache, i) =>
    renderCache(cache, cacheNames[i], decodeAddress(request?.address ?? 0, cache.setCount).index)
  ).join('');
  [...byId('queue').children].forEach((button, i) => {
    button.classList.toggle('past', i < position);
    button.classList.toggle('next', i === position);
    if (i + 1 === position) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  renderLessonResult();
  if (byId('details').open) renderDetails(request);
  if (byId('all-lines').open) renderAllLines();
}

function goTo(step) {
  const trace = scenarios[scenario];
  const advancing = step === position + 1;
  // Replay from reset when stepping backward so memory writes rewind too.
  if (step < position || !caches) {
    caches = [new Cache(1), new Cache(2)];
    for (const cache of caches) cache.history = [];
    position = 0;
  }
  while (position < step) {
    for (const cache of caches) {
      cache.before = cache.sets.map(set => set.map(line => ({...line, bytes: [...line.bytes]})));
      cache.access(trace[position]);
      cache.history.push({...cache.last});
    }
    position += 1;
  }
  if (position === trace.length) pause();
  render();
  if (advancing) animateAccess();
}

function pause() {
  clearInterval(timer);
  timer = null;
  byId('play').textContent = 'Play';
  byId('play').setAttribute('aria-pressed', 'false');
}

function selectScenario(name) {
  pause();
  scenario = name;
  byId('scenario').value = name;
  byId('custom').open = name === 'custom';
  caches = null;
  renderQueue();
  goTo(0);
}

document.querySelectorAll('[data-lesson]').forEach(button =>
  button.addEventListener('click', () => selectScenario(button.dataset.lesson)));
byId('scenario').addEventListener('change', event => selectScenario(event.target.value));
byId('reset').addEventListener('click', () => { pause(); goTo(0); });
byId('previous').addEventListener('click', () => { pause(); goTo(position - 1); });
byId('next').addEventListener('click', () => { pause(); goTo(position + 1); });
byId('play').addEventListener('click', () => {
  if (timer !== null) {
    pause();
    return;
  }
  byId('play').textContent = 'Pause';
  byId('play').setAttribute('aria-pressed', 'true');
  timer = setInterval(() => goTo(position + 1), 950);
});
byId('seek').addEventListener('input', event => { pause(); goTo(Number(event.target.value)); });
byId('operation').addEventListener('change', event => { byId('byte').disabled = event.target.value !== 'write'; });
byId('details').addEventListener('toggle', () => {
  if (byId('details').open) renderDetails(scenarios[scenario][Math.max(0, position - 1)]);
});
byId('all-lines').addEventListener('toggle', () => { if (byId('all-lines').open) renderAllLines(); });

function inputHex(id, maxDigits) {
  const value = byId(id).value.trim().replace(/^0x/i, '');
  const valid = /^[0-9a-f]+$/i.test(value) && value.length <= maxDigits;
  return valid ? Number.parseInt(value, 16) : NaN;
}

byId('custom-form').addEventListener('submit', event => {
  event.preventDefault();
  const write = byId('operation').value === 'write';
  const address = inputHex('address', 4);
  const data = write ? inputHex('byte', 2) : 0;
  if (Number.isNaN(address) || Number.isNaN(data)) {
    byId('form-error').textContent = 'Enter a hex address from 0000 to FFFF and, for writes, a hex byte from 00 to FF.';
    return;
  }
  byId('form-error').textContent = '';
  scenarios.custom.push({write, address, data});
  if (scenario === 'custom') {
    pause();
    renderQueue();
    render();
  } else selectScenario('custom');
});

byId('clear-custom').addEventListener('click', () => {
  scenarios.custom.length = 0;
  byId('form-error').textContent = '';
  if (scenario === 'custom') selectScenario('custom');
});

for (const [key, label] of Object.entries(traceLabels)) {
  const direct = PROJECT_DATA.results.find(row => row.trace === key && row.cache === 'direct');
  const twoWay = PROJECT_DATA.results.find(row => row.trace === key && row.cache === '2way');
  const row = document.createElement('tr');
  const cells = [[direct, twoWay], [twoWay, direct]].map(([result, other]) => {
    const hitClass = Number(result.hit_rate_percent) > Number(other.hit_rate_percent) ? 'better' : '';
    const cycleClass = Number(result.total_service_cycles) < Number(other.total_service_cycles) ? 'better' : '';
    return `<td><span class="${hitClass}">${result.hit_rate_percent}% hits</span>
      <span class="${cycleClass}">${result.total_service_cycles} cycles</span></td>`;
  });
  row.innerHTML = `<th scope="row"><button type="button">${label}</button></th>${cells.join('')}`;
  row.querySelector('button').addEventListener('click', () => {
    selectScenario(key);
    const scenarioSelect = byId('scenario');
    const scenarioDetails = scenarioSelect.closest('details');
    if (scenarioDetails) scenarioDetails.open = true;
    scenarioSelect.focus({preventScroll: true});
    byId('simulator').scrollIntoView();
  });
  byId('results').append(row);
}

byId('download').addEventListener('click', () => {
  const objectUrl = URL.createObjectURL(new Blob([PROJECT_DATA.csv], {type: 'text/csv'}));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = 'comparison.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
});

selectScenario('conflict_demo');
