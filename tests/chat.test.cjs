const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');

// chat.js builds its DOM only inside init(), so its logic loads here without a browser.
function setup(fetch) {
  const storage = new Map();
  const context = vm.createContext({ window: {}, fetch, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) } });
  for (const file of ['ai.js', 'chat.js']) vm.runInContext(readFileSync(file, 'utf8'), context);
  context.window.SpellAI.saveConfig({ apiKey: 'mock-test-key', useAI: true, model: 'mock/model' });
  return context.window;
}
const reply = text => ({ ok: true, json: async () => ({ choices: [{ message: { content: text } }] }) });
const turns = n => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));

test('the tutor prompt allows names, admits uncertainty and follows the learner\'s spelling style', () => {
  const { SpellChat } = setup(async () => reply('x'));
  const us = SpellChat.systemPrompt('us');
  assert.match(us, /names/i);
  assert.match(us, /not sure/i);
  assert.match(us, /American/);
  assert.match(SpellChat.systemPrompt('uk'), /British/);
});

test('a request carries the rules first and only the recent conversation', () => {
  const { SpellChat } = setup(async () => reply('x'));
  const messages = SpellChat.buildMessages(turns(30), 'us');
  assert.equal(messages[0].role, 'system');
  assert.ok(messages.length < 31, 'long chats are trimmed');
  assert.equal(messages.at(-1).content, 'm29', 'the newest message is always kept');
  assert.equal(messages[1].role, 'user', 'a reply whose question was trimmed away is dropped');
});

test('chat sends the messages to the configured model and returns the trimmed reply', async () => {
  let request;
  const { SpellAI, SpellChat } = setup(async (_, options) => { request = JSON.parse(options.body); return reply('  Use **necessary**: one collar, two sleeves.  '); });
  const text = await SpellAI.chat(SpellChat.buildMessages([{ role: 'user', content: 'How do I spell necessary?' }], 'us'));
  assert.equal(text, 'Use **necessary**: one collar, two sleeves.');
  assert.equal(request.model, 'mock/model');
  assert.equal(request.messages.at(-1).content, 'How do I spell necessary?');
  assert.ok(request.temperature < 0.8, 'answers are steadier than word generation');
});

test('chat errors are phrased for a chat and never echo the response body', async () => {
  const { SpellAI } = setup(async () => ({ ok: false, status: 500, text: async () => 'SECRET' }));
  await assert.rejects(SpellAI.chat([{ role: 'user', content: 'hi' }]), e => /could not answer/.test(e.message) && !e.message.includes('SECRET'));
  const credits = setup(async () => ({ ok: false, status: 402, text: async () => 'SECRET' }));
  await assert.rejects(credits.SpellAI.chat([]), /credits/);
});

test('stopping a question aborts the underlying request', async () => {
  const { SpellAI } = setup(async (_, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('stopped'), { name: 'AbortError' })));
  }));
  const controller = new AbortController();
  const pending = SpellAI.chat([{ role: 'user', content: 'hi' }], { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
