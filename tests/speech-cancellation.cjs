const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

(async () => {
  let finishFetch;
  let plays = 0;
  const context = {
    window: {},
    localStorage: { getItem: () => JSON.stringify({ apiKey: 'test-only', useElevenLabs: true }) },
    fetch: () => new Promise(resolve => { finishFetch = resolve; }),
    AbortController, setTimeout, clearTimeout,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    Audio: class { play() { plays++; return Promise.resolve(); } pause() {} },
  };
  vm.runInNewContext(readFileSync('tts.js', 'utf8'), context);
  const tts = context.window.SpellTTS;
  const pending = tts.speak('cat');
  tts.stop();
  finishFetch({ ok: true, blob: async () => ({}) });
  await pending;
  assert.equal(plays, 0, 'Speech cancelled during download must not play later');
  const playing = tts.speak('cat');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(plays, 1);
  tts.stop();
  await playing;
  console.log('PASS: pending speech cancels; stopped playback settles.');
})();
