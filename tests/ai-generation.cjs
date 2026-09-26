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
