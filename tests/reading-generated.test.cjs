const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const R = require('../reading.js');
const G = require('../reading-generated.js');
const { PASSAGES, ADVANCED_PASSAGES } = require('../reading-passages.js');

// ---- fixtures: passages of an exact length, with phrases that appear exactly once ----
function sentence(n, seed) {
  return Array.from({ length: n - 1 }, (_, i) => `word${seed}x${i}`).concat('end.').join(' ');
}
function makePassage(tier, { words } = {}) {
  const total = words ?? (tier === 'advanced' ? 250 : 180);
  const each = Math.floor(total / 3);
  const paragraphs = [sentence(each, 'a'), sentence(each, 'b'), sentence(total - 2 * each, 'c')];
  paragraphs[0] = `In 1960 Peter Wason ran a puzzle. ${paragraphs[0]}`.split(' ').slice(0, each).join(' ');
  const kinds = G.KINDS[tier];
  const raw = {
    title: 'A test passage',
    paragraphs,
    questions: kinds.map((kind, i) => ({ kind, q: `Question number ${i + 1} here?`, options: [`one ${i}`, `two ${i}`, `three ${i}`, `four ${i}`], answer: i % 4 })),
  };
  if (tier === 'advanced') raw.scans = [{ q: 'In what year was the puzzle?', find: '1960' }, { q: 'Who ran the puzzle?', find: 'Peter Wason' }, { q: 'What is the first filler word?', find: 'worda' + 'x1' }];
  return raw;
}
const reject = (raw, tier, pattern) => {
  const r = G.validatePassage(raw, tier, {});
  assert.equal(r.ok, false, 'should have been rejected');
  if (pattern) assert.match(r.reason, pattern);
};

test('a well-formed basic and advanced passage is accepted with only the fields we keep', () => {
  const basic = G.validatePassage({ ...makePassage('basic'), id: 'evil', extra: '<b>' }, 'basic', {});
  assert.equal(basic.ok, true);
  assert.deepEqual(Object.keys(basic.passage).sort(), ['id', 'paragraphs', 'questions', 'title']);
  assert.match(basic.passage.id, /^gen-[a-z0-9-]+$/);
  assert.notEqual(basic.passage.id, 'evil', 'the model never chooses the id');
  const adv = G.validatePassage(makePassage('advanced'), 'advanced', {});
  assert.equal(adv.ok, true, adv.reason);
  assert.equal(adv.passage.scans.length, 3);
  assert.deepEqual(adv.passage.questions.map((q) => q.kind), ['gist', 'fact', 'fact', 'inference', 'inference']);
});

test('shape: non-objects, wrong tier, missing or extra parts are rejected', () => {
  for (const bad of [null, undefined, 'text', 5, [], {}]) reject(bad, 'basic');
  reject(makePassage('basic'), 'expert', /tier/);
  for (const key of ['title', 'paragraphs', 'questions']) {
    const raw = makePassage('basic');
    delete raw[key];
    reject(raw, 'basic');
  }
  reject({ ...makePassage('basic'), paragraphs: 'one long string' }, 'basic');
  reject({ ...makePassage('basic'), paragraphs: [sentence(180, 'a')] }, 'basic', /paragraphs/);
  reject({ ...makePassage('basic'), paragraphs: [...makePassage('basic').paragraphs, 5] }, 'basic');
});

test('word counts must fall in the range for the tier', () => {
  reject(makePassage('basic', { words: 120 }), 'basic', /words/);
  reject(makePassage('basic', { words: 260 }), 'basic', /words/);
  reject(makePassage('advanced', { words: 180 }), 'advanced', /words/);
  reject(makePassage('advanced', { words: 330 }), 'advanced', /words/);
  assert.equal(G.validatePassage(makePassage('basic', { words: 170 }), 'basic', {}).ok, true);
  assert.equal(G.validatePassage(makePassage('basic', { words: 190 }), 'basic', {}).ok, true);
  assert.equal(G.validatePassage(makePassage('advanced', { words: 240 }), 'advanced', {}).ok, true);
  assert.equal(G.validatePassage(makePassage('advanced', { words: 260 }), 'advanced', {}).ok, true);
});

test('questions: right kinds in order, 4 distinct options, answer index in range', () => {
  const edit = (fn, tier = 'basic') => { const raw = makePassage(tier); fn(raw); return raw; };
  reject(edit((r) => r.questions.pop()), 'basic', /questions/);
  reject(edit((r) => r.questions.push({ ...r.questions[0] })), 'basic', /questions/);
  reject(edit((r) => { r.questions[1].kind = 'inference'; }), 'basic', /fact/);
  reject(edit((r) => { r.questions[0].options.pop(); }), 'basic', /4 options/);
  reject(edit((r) => { r.questions[0].options.push('five'); }), 'basic', /4 options/);
  reject(edit((r) => { r.questions[0].options[1] = r.questions[0].options[0].toUpperCase(); }), 'basic', /repeated/);
  reject(edit((r) => { r.questions[0].options[2] = ''; }), 'basic', /option/);
  reject(edit((r) => { r.questions[0].options[2] = 7; }), 'basic', /option/);
  reject(edit((r) => { r.questions[0].options[2] = 'x'.repeat(121); }), 'basic', /option/);
  for (const answer of [-1, 4, 1.5, '1', null, NaN]) reject(edit((r) => { r.questions[2].answer = answer; }), 'basic', /answer/);
  reject(edit((r) => { r.questions[1].q = r.questions[0].q; }), 'basic', /repeated/);
  reject(edit((r) => { r.questions[0].q = 'Why?'; }), 'basic', /text/);
  reject(edit((r) => { r.questions[0].q = 'q'.repeat(161); }), 'basic', /text/);
  reject(edit((r) => { r.questions[3].kind = 'fact'; }, 'advanced'), 'advanced', /inference/);
});

test('markup, HTML, entities, control characters and over-long fields are rejected everywhere', () => {
  const places = [
    (r, v) => { r.title = v; },
    (r, v) => { r.paragraphs[1] = `${r.paragraphs[1]} ${v}`; },
    (r, v) => { r.questions[0].q = `What is ${v} here?`; },
    (r, v) => { r.questions[2].options[3] = `a ${v}`; },
  ];
  for (const bad of ['<b>bold</b>', '**strong**', '__under__', '`code`', '[link](http://x)', '&amp;', '&#39;', '<script>', 'a\u0000b', '{brace}', 'a | b']) {
    for (const put of places) {
      const raw = makePassage('basic');
      put(raw, bad);
      reject(raw, 'basic');
    }
  }
  reject({ ...makePassage('basic'), paragraphs: ['# Heading\n' + sentence(60, 'a'), sentence(60, 'b'), sentence(60, 'c')] }, 'basic');
  reject({ ...makePassage('basic'), paragraphs: ['- bullet ' + sentence(60, 'a'), sentence(60, 'b'), sentence(60, 'c')] }, 'basic');
  reject({ ...makePassage('basic'), title: 'T'.repeat(61) }, 'basic', /title/);
  reject({ ...makePassage('basic'), title: 'Two\nlines' }, 'basic', /title/);
  reject({ ...makePassage('basic'), title: 'ab' }, 'basic', /title/);
  reject({ ...makePassage('basic'), paragraphs: ['x'.repeat(1501), 'y'.repeat(60), 'z'.repeat(60)] }, 'basic');
});

test('apostrophes, quotes, dashes and accents are fine in ordinary prose', () => {
  const raw = makePassage('basic');
  raw.title = 'Bees – a café’s secret';
  raw.paragraphs[0] = `${raw.paragraphs[0]} "It's fine," she said; naïve and 50% done (really)!`.split(' ').slice(0, 60).join(' ') + ' "Fine," she said — naïve (50%).';
  const r = G.validatePassage(raw, 'basic', {});
  assert.equal(r.ok, true, r.reason);
});

test('scans: three, each phrase found exactly once in the passage', () => {
  const edit = (fn) => { const raw = makePassage('advanced'); fn(raw); return raw; };
  reject(edit((r) => delete r.scans), 'advanced', /scan/);
  reject(edit((r) => r.scans.pop()), 'advanced', /scan/);
  reject(edit((r) => { r.scans[0].find = 'never appears anywhere'; }), 'advanced', /0 times/);
  reject(edit((r) => { r.scans[0].find = 'end.'; }), 'advanced', /3 times/);
  reject(edit((r) => { r.scans[0].find = 'END'; }), 'advanced', /times/);
  reject(edit((r) => { r.scans[0].find = ''; }), 'advanced', /phrase/);
  reject(edit((r) => { r.scans[0].find = '...'; }), 'advanced', /phrase/);
  reject(edit((r) => { r.scans[0].find = 'one two three four five six seven'; }), 'advanced', /phrase/);
  reject(edit((r) => { r.scans[0].find = 'x'.repeat(61); }), 'advanced', /phrase/);
  reject(edit((r) => { r.scans[0].find = 42; }), 'advanced', /phrase/);
  reject(edit((r) => { r.scans[1].find = '<b>1960</b>'; }), 'advanced');
  reject(edit((r) => { r.scans[1] = 'Peter Wason'; }), 'advanced', /scan/);
  reject(edit((r) => { r.scans[1].find = '1960'; }), 'advanced', /repeated/);
  reject(edit((r) => { r.scans[2].q = 'Hm?'; }), 'advanced', /scan/);
  // matching ignores case and edge punctuation, like the tapping does
  const ok = edit((r) => { r.scans[1].find = 'peter wason'; });
  assert.equal(G.validatePassage(ok, 'advanced', {}).ok, true);
  // a basic passage has no scans: anything sent is dropped, not stored
  const basic = G.validatePassage({ ...makePassage('basic'), scans: [{ q: 'whatever?', find: 'x' }] }, 'basic', {});
  assert.equal(basic.ok, true);
  assert.equal('scans' in basic.passage, false);
});

test('ids are sanitised and unique; titles already in use are refused', () => {
  const raw = makePassage('basic');
  const first = G.validatePassage(raw, 'basic', {}).passage;
  const ids = new Set([first.id]);
  const second = G.validatePassage(raw, 'basic', { ids }).passage;
  assert.notEqual(second.id, first.id);
  assert.match(second.id, /^gen-[a-z0-9-]+$/);
  const weird = G.validatePassage({ ...raw, title: 'Ünïcode & "quotes" / slashes!' }, 'basic', {}).passage;
  assert.match(weird.id, /^gen-[a-z0-9-]+$/);
  assert.ok(weird.id.length <= 60);
  reject(raw, 'basic', /title already/);
  const titles = new Set(['a test passage']);
  assert.equal(G.validatePassage(raw, 'basic', { titles }).ok, false);
  assert.equal(G.validatePassage({ ...raw, title: 'A TEST, passage!' }, 'basic', { titles }).ok, false, 'case and punctuation do not make a new title');
});

test('shuffling keeps every option and moves the answer with it', () => {
  const p = G.validatePassage(makePassage('advanced'), 'advanced', {}).passage;
  const seq = [0.1, 0.9, 0.5, 0.3, 0.7, 0.2];
  let i = 0;
  const shuffled = G.shuffleOptions(p, () => seq[i++ % seq.length]);
  shuffled.questions.forEach((q, n) => {
    assert.deepEqual([...q.options].sort(), [...p.questions[n].options].sort());
    assert.equal(q.options[q.answer], p.questions[n].options[p.questions[n].answer]);
  });
  assert.equal(p.questions[0].options[0], 'one 0', 'the original is untouched');
});

// ---- the model call, with fetch mocked like tests/chat.test.cjs ----
function setup(replies) {
  const storage = new Map();
  const requests = [];
  const fetch = async (_, options) => {
    requests.push(JSON.parse(options.body));
    const next = replies.shift();
    if (typeof next === 'function') return next(options);
    return next;
  };
  const context = vm.createContext({ window: {}, fetch, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) } });
  vm.runInContext(readFileSync('ai.js', 'utf8'), context);
  context.window.SpellAI.saveConfig({ apiKey: 'mock-test-key', useAI: true, model: 'mock/model' });
  return { ai: context.window.SpellAI, requests };
}
const reply = (text) => ({ ok: true, json: async () => ({ choices: [{ message: { content: text } }] }) });
const json = (raw) => reply(JSON.stringify(raw));
const fixed = () => 0.4;

test('a good reply is accepted on the first try with one request', async () => {
  const { ai, requests } = setup([json(makePassage('basic'))]);
  const p = await G.generatePassage('basic', { call: ai.callOpenRouter, random: fixed });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].model, 'mock/model');
  assert.match(requests[0].messages[1].content, /170 to 190 words/);
  assert.equal(p.tier, 'basic');
  assert.equal(p.questions.length, 3);
  assert.ok(p.at > 0);
});

test('a reply in a code fence with chatter around it is still read', async () => {
  const { ai } = setup([reply('Here you go:\n```json\n' + JSON.stringify(makePassage('advanced')) + '\n```')]);
  const p = await G.generatePassage('advanced', { call: ai.callOpenRouter, random: fixed });
  assert.equal(p.scans.length, 3);
  assert.match((await setup([json(makePassage('advanced'))]).requests, ''), /^$/);
});

test('a bad reply is retried once, with the reason given to the model, and a good second reply is used', async () => {
  const { ai, requests } = setup([json(makePassage('basic', { words: 90 })), json(makePassage('basic'))]);
  const p = await G.generatePassage('basic', { call: ai.callOpenRouter, random: fixed });
  assert.equal(requests.length, 2);
  assert.doesNotMatch(requests[0].messages[1].content, /rejected/);
  assert.match(requests[1].messages[1].content, /rejected: 90 words/);
  assert.equal(p.questions.length, 3);
});

test('not-JSON and broken scans are retried too; two failures throw and nothing is returned', async () => {
  const broken = makePassage('advanced');
  broken.scans[0].find = 'end.';
  const first = setup([reply('Sorry, I cannot do that.'), json(makePassage('advanced'))]);
  assert.ok(await G.generatePassage('advanced', { call: first.ai.callOpenRouter, random: fixed }));
  assert.match(first.requests[1].messages[1].content, /not valid JSON/);
  const second = setup([json(broken), json(broken), json(makePassage('advanced'))]);
  await assert.rejects(G.generatePassage('advanced', { call: second.ai.callOpenRouter, random: fixed }), /did not pass the checks/);
  assert.equal(second.requests.length, 2, 'exactly one automatic retry, never more');
});

test('request errors are not retried and do not leak the response body', async () => {
  for (const [status, pattern] of [[401, /API key/], [402, /credits/], [429, /rate-limiting/], [500, /could not write a passage/]]) {
    const { ai, requests } = setup([{ ok: false, status, text: async () => 'SECRET' }]);
    await assert.rejects(G.generatePassage('basic', { call: ai.callOpenRouter }), (e) => pattern.test(e.message) && !e.message.includes('SECRET'));
    assert.equal(requests.length, 1);
  }
});

test('cancelling stops the request and does not retry', async () => {
  const { ai, requests } = setup([(options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('stopped'), { name: 'AbortError' })));
  })]);
  const controller = new AbortController();
  const pending = G.generatePassage('basic', { call: ai.callOpenRouter, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(requests.length, 1);
  const already = setup([json(makePassage('basic'))]);
  await assert.rejects(G.generatePassage('basic', { call: already.ai.callOpenRouter, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(already.requests.length, 0);
});

test('without a key the call fails before any request', async () => {
  const { ai, requests } = setup([]);
  ai.saveConfig({ apiKey: '', useAI: false });
  await assert.rejects(G.generatePassage('basic', { call: ai.callOpenRouter }), /No API key/);
  assert.equal(requests.length, 0);
});

test('titles already in use are named in the prompt so the model avoids them', async () => {
  const { ai, requests } = setup([json({ ...makePassage('basic'), title: 'Fresh title' })]);
  await G.generatePassage('basic', { call: ai.callOpenRouter, taken: G.takenFrom(PASSAGES, []), random: fixed });
  assert.match(requests[0].messages[1].content, /the clever octopus/);
});

test('a reply that repeats a built-in title is rejected, then retried', async () => {
  const { ai, requests } = setup([json({ ...makePassage('basic'), title: 'The clever octopus' }), json(makePassage('basic'))]);
  await G.generatePassage('basic', { call: ai.callOpenRouter, taken: G.takenFrom(PASSAGES, []), random: fixed });
  assert.equal(requests.length, 2);
  assert.match(requests[1].messages[1].content, /title already used/);
});

// ---- storage ----
const stored = (tier, title, at = 1) => {
  const p = G.validatePassage({ ...makePassage(tier), title }, tier, {}).passage;
  return { ...p, tier, at };
};

test('stored passages are checked again on load: damage and tampering are dropped', () => {
  const good = stored('basic', 'Good one');
  const adv = stored('advanced', 'Good advanced');
  const tampered = [
    { ...stored('basic', 'Bad answer'), questions: stored('basic', 'x').questions.map((q) => ({ ...q, answer: 9 })) },
    { ...stored('basic', 'Html'), title: '<img src=x>' },
    { ...stored('basic', 'Bad id'), id: '../../etc' },
    { ...stored('basic', 'No tier'), tier: 'huge' },
    { ...stored('advanced', 'Lost scan'), scans: [] },
    { ...stored('advanced', 'Two scans'), scans: adv.scans.slice(0, 2) },
    null, 'text', 42,
  ];
  const out = G.sanitizeStored([good, ...tampered, adv], []);
  assert.deepEqual(out.map((p) => p.title), ['Good one', 'Good advanced']);
  assert.deepEqual(G.sanitizeStored('nope', []), []);
  assert.deepEqual(G.sanitizeStored(null, []), []);
});

test('stored passages cannot reuse a built-in id or title, or each other', () => {
  const a = stored('basic', 'Same title');
  const clash = G.sanitizeStored([a, { ...a, id: 'gen-other' }, { ...stored('basic', 'Third'), id: a.id }, { ...stored('basic', 'The clever octopus') }, { ...stored('basic', 'Built in id'), id: 'gen-x' }],
    [{ id: 'gen-x', title: 'Other' }]);
  assert.deepEqual(clash.map((p) => p.title), ['Same title', 'Third'].slice(0, 1));
});

test('load and save go through storage, and bad JSON or a full disk do no harm', () => {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  assert.deepEqual(G.loadStored(storage, []), []);
  assert.equal(G.saveStored(storage, [stored('basic', 'Saved')]), true);
  assert.ok(map.has('spellit_reading_generated'));
  assert.deepEqual(G.loadStored(storage, []).map((p) => p.title), ['Saved']);
  map.set('spellit_reading_generated', '{not json');
  assert.deepEqual(G.loadStored(storage, []), []);
  assert.equal(G.saveStored({ setItem() { throw new Error('quota'); } }, []), false);
  assert.deepEqual(G.loadStored({ getItem() { throw new Error('blocked'); } }, []), []);
});

test('only the newest 30 are kept, and a repeated passage replaces the older copy', () => {
  let list = [];
  for (let i = 0; i < 35; i++) list = G.addPassages(list, [{ ...stored('basic', `Title number ${i}`), id: `gen-t${i}`, at: i }]);
  assert.equal(list.length, G.MAX_STORED);
  assert.equal(list[0].title, 'Title number 5');
  assert.equal(list.at(-1).title, 'Title number 34');
  const again = G.addPassages(list, [{ ...list[3], at: 999 }]);
  assert.equal(again.length, G.MAX_STORED);
  assert.equal(again.at(-1).at, 999);
  assert.equal(new Set(again.map((p) => p.id)).size, G.MAX_STORED);
  // a hand-edited store with more than the cap is trimmed on load, keeping the newest
  const many = Array.from({ length: 40 }, (_, i) => ({ ...stored('basic', `Many ${i}`), id: `gen-m${i}` }));
  const loaded = G.sanitizeStored(many, []);
  assert.equal(loaded.length, G.MAX_STORED);
  assert.equal(loaded.at(-1).title, 'Many 39');
});

test('generated passages join the pool of the right tier and the built-in sets are untouched', () => {
  const basic = stored('basic', 'Gen basic');
  const adv = stored('advanced', 'Gen advanced');
  const sets = { PASSAGES, ADVANCED_PASSAGES, generatedFor: (tier) => G.forTier([basic, adv], tier) };
  const level = (n) => R.LEVELS[n - 1];
  const poolBasic = R.passagesFor(level(1), sets);
  assert.equal(poolBasic.length, PASSAGES.length + 1);
  assert.ok(poolBasic.includes(basic) && !poolBasic.includes(adv));
  for (const n of [5, 6, 7]) {
    const pool = R.passagesFor(level(n), sets);
    assert.equal(pool.length, ADVANCED_PASSAGES.length + 1);
    assert.ok(pool.includes(adv) && !pool.includes(basic));
  }
  assert.equal(PASSAGES.length, 10, 'built-in list not mutated');
  assert.equal(R.passagesFor(level(1), { PASSAGES, ADVANCED_PASSAGES }).length, PASSAGES.length, 'no getter: unchanged');
  assert.equal(R.passagesFor(level(1), { PASSAGES, ADVANCED_PASSAGES, generatedFor: () => [] }), PASSAGES);
});

test('a generated advanced passage works with the scan level and the quiz', () => {
  const adv = stored('advanced', 'Scan me');
  for (const s of adv.scans) assert.equal(R.findSpans(adv, s.find).length, 1);
  const state = R.emptyState();
  const picked = R.pickPassage(state, [adv], () => 0);
  assert.equal(picked.id, adv.id);
  const next = R.recordResult({ ...state, baseline: 200, unlocked: 5 }, 5, { wpm: 300, share: 1 }, adv.id).state;
  assert.equal(next.read[adv.id], 1);
});

test('the prompt asks for the right lengths, questions and scans for each tier', () => {
  const basic = G.buildPrompt('basic', { topic: 'bees' });
  assert.match(basic, /170 to 190 words/);
  assert.match(basic, /gist, fact, inference/);
  assert.doesNotMatch(basic, /scan questions/);
  const adv = G.buildPrompt('advanced', { topic: 'bees' });
  assert.match(adv, /240 to 260 words/);
  assert.match(adv, /gist, fact, fact, inference, inference/);
  assert.match(adv, /ONLY ONCE/);
});
