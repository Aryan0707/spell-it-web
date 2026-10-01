const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
function setup(fetch) {
  const storage = new Map();
  const context = vm.createContext({ window: {}, fetch, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) } });
  vm.runInContext(readFileSync('ai.js', 'utf8'), context);
  const api = context.window.SpellAI;
  api.saveConfig({ apiKey: 'mock-test-key', useAI: true, model: 'mock/model' });
  return api;
}
const response = items => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(items) } }] }) });
test('AI filters duplicates, invalid and revealing entries; retains teaching metadata and caps results', async () => {
  let request;
  const api = setup(async (_, options) => { request = JSON.parse(options.body); return response([
    { word: 'known', hint: 'Old word' }, { word: 'bad-word', hint: 'Invalid' },
    { word: 'reveal', hint: 'To reveal something' }, { word: 'blank', hint: ' ' },
    { word: 'fern', hint: 'A leafy plant', memoryTip: 'Remember the r before n.' },
    { word: 'fern', hint: 'A duplicate' }, { word: 'moss', hint: 'A soft green plant' },
    { word: 'pond', hint: 'A small body of water' }
  ]); });
  const words = await api.generateWordBatch(2, { difficulty: 'beginner', spellingStyle: 'uk', recentWords: ['known'] });
  assert.deepEqual(Array.from(words, w => w.word), ['fern', 'moss']);
  assert.equal(words[0].difficulty, 'beginner');
  assert.equal(words[0].memoryTip, 'Remember the r before n.');
  assert.match(request.messages[1].content, /British English/);
  assert.equal(request.model, 'mock/model');
});
test('AI empty usable output fails clearly and provider errors do not echo response secrets', async () => {
  await assert.rejects(setup(async () => response([])).generateWordBatch(5), /no usable words/);
  const api = setup(async () => ({ ok: false, status: 402, text: async () => 'SECRET' }));
  await assert.rejects(api.generateWordBatch(5), e => /credits/.test(e.message) && !e.message.includes('SECRET'));
});
test('AI cancellation aborts the underlying request', async () => {
  const api = setup(async (_, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })));
  }));
  const controller = new AbortController();
  const pending = api.generateWordBatch(5, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

// ---- study-card extras for AI words ----
function setupWithWordInfo(fetch) {
  const storage = new Map();
  const context = vm.createContext({ window: {}, fetch, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) } });
  for (const file of ['words.js', 'meanings.js', 'sounds.js', 'ai.js']) vm.runInContext(readFileSync(file, 'utf8'), context);
  const api = context.window.SpellAI;
  api.saveConfig({ apiKey: 'mock-test-key', useAI: true, model: 'mock/model' });
  return api;
}
const good = {
  word: 'fern', hint: 'A leafy plant', partOfSpeech: 'noun', definition: 'A green plant with feathery leaves that grows in damp shade.',
  related: ['plant', 'frond'], syllables: 'fern', respelling: 'furn', ipa: '/fɝn/', soundNote: '',
  examples: ['A fern grew beside the stream.', 'The fern in my room needs water.', 'We found a fern near the path.'],
};
test('AI extras are kept in the stored format when they pass validation', async () => {
  const [w] = await setupWithWordInfo(async () => response([good])).generateWordBatch(1);
  assert.deepEqual(Array.from(w.examples), ['A {word} grew beside the stream.', 'The {word} in my room needs water.', 'We found a {word} near the path.']);
  assert.equal(w.meaning, 'noun | A green plant with feathery leaves that grows in damp shade. | plant, frond');
  assert.equal(w.sounds, 'fern | furn | /fɝn/');
});
test('a bad extra is dropped on its own; the word and its other extras survive', async () => {
  const api = setupWithWordInfo(async () => response([{
    ...good,
    definition: 'A fern is a plant.',                 // gives the word away
    examples: ['A fern near a fern is odd.', 'No target word in this one.', 'Pipes | and {braces} are refused.', 'The fern drank the rain.'],
  }]));
  const [w] = await api.generateWordBatch(1);
  assert.equal(w.word, 'fern');
  assert.equal(w.meaning, undefined, 'definition containing the word is rejected');
  assert.deepEqual(Array.from(w.examples), ['The {word} drank the rain.'], 'only the sentence with the word exactly once survives');
  const two = (await setupWithWordInfo(async () => response([{ ...good, syllables: 'fe-rn', respelling: 'FUR-UN' }])).generateWordBatch(1))[0];
  assert.equal(two.sounds, undefined, 'two stressed parts is not a valid guide');
  const wrongSpelling = (await setupWithWordInfo(async () => response([{ ...good, syllables: 'fur-n', respelling: 'FUR-un' }])).generateWordBatch(1))[0];
  assert.equal(wrongSpelling.sounds, undefined, 'syllables that do not spell the word are rejected');
});
test('a larger batch asks for enough output and the prompt requests the extras in the right accent', async () => {
  let request;
  const api = setupWithWordInfo(async (_, options) => { request = JSON.parse(options.body); return response([good]); });
  await api.generateWordBatch(20, { spellingStyle: 'uk' });
  assert.ok(request.max_tokens >= 9000, 'room for 20 words with their extras');
  const prompt = request.messages[1].content;
  assert.match(prompt, /British pronunciation/);
  for (const field of ['partOfSpeech', 'definition', 'examples', 'syllables', 'respelling', 'ipa']) assert.match(prompt, new RegExp(field));
});

test('filling in a list: only requested words, one result each, hint kept only if it does not reveal the word', async () => {
  let request;
  const api = setupWithWordInfo(async (_, options) => { request = JSON.parse(options.body); return response([
    { ...good, word: 'fern', hint: 'A leafy plant' },
    { ...good, word: 'fern', hint: 'A duplicate answer' },                                   // second copy ignored
    { word: 'intruder', hint: 'Was never requested' },                                       // not asked for
    { word: 'moss', hint: 'moss is a soft plant' },                                          // hint gives the word away
    { word: 'qwxz' },                                                                        // model says it is not a word
  ]); });
  const out = await api.enrichWords(['fern', 'moss', 'qwxz', 'Fern', 'bad-word', 'x']);
  assert.deepEqual(Array.from(out, r => r.word), ['fern', 'moss', 'qwxz']);
  assert.equal(out[0].hint, 'A leafy plant');
  assert.match(out[0].meaning, /^noun \| A green plant/);
  assert.equal(out[1].hint, undefined, 'a hint containing the word is dropped');
  assert.deepEqual(Object.keys(out[2]), ['word'], 'a non-word comes back with nothing to merge');
  assert.match(request.messages[1].content, /fern, moss, qwxz/);
  assert.doesNotMatch(request.messages[1].content, /bad-word/, 'invalid words are never sent');
  assert.equal((await api.enrichWords([])).length, 0, 'nothing to ask, nothing requested');
});
test('filling in a list asks for at most one batch and uses the learner\'s accent', async () => {
  let request;
  const api = setupWithWordInfo(async (_, options) => { request = JSON.parse(options.body); return response([]); });
  const words = Array.from({ length: 30 }, (_, i) => 'word' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26)));
  await api.enrichWords(words, { spellingStyle: 'uk' });
  assert.equal(request.messages[1].content.split('in this order: ')[1].split('.\n')[0].split(', ').length, api.ENRICH_BATCH);
  assert.match(request.messages[1].content, /British/);
});
