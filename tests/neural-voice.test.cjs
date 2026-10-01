// Queue behaviour of the natural voice, with a fake worker (no model download).
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

function setup() {
  const store = new Map();
  const workers = [];
  class FakeWorker {
    constructor() { this.sent = []; this.terminated = false; workers.push(this); }
    postMessage(msg) { this.sent.push(msg); }
    terminate() { this.terminated = true; }
    emit(data) { this.onmessage({ data }); }
  }
  let played = [];
  const context = {
    window: { SpellTTS: { playUrl: async (url) => { played.push(url); } } },
    localStorage: { getItem: () => JSON.stringify({ enabled: true, voice: "auto" }), setItem() {} },
    Worker: FakeWorker, WebAssembly: {},
    caches: {
      open: async () => ({ put: async (key, res) => { store.set(key, res); } }),
      match: async (key) => store.get(key),
    },
    URL: { createObjectURL: () => `blob:${Math.random()}`, revokeObjectURL() {} },
    Blob, Response, DataView, ArrayBuffer, Float32Array, Promise, setTimeout, clearTimeout, console,
  };
  vm.runInNewContext(readFileSync("neural-voice.js", "utf8"), context);
  return { N: context.window.SpellNeural, workers, played: () => played, store };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const audio = (id) => ({ type: "audio", id, samples: new Float32Array([0, 0.5, -0.5]), rate: 24000 });

test("speaking now fails fast while the engine is loading, so the app can use the device voice", async () => {
  const { N, workers } = setup();
  await assert.rejects(N.speak("cat"), /not ready/);
  assert.equal(workers.length, 1, "the first request still starts the download");
  assert.equal(workers[0].sent[0].type, "load");
});

test("a spoken request jumps ahead of background prefetch, and each word is generated once", async () => {
  const { N, workers } = setup();
  N.start();
  const w = workers[0];
  N.prefetch(["one", "two", "three"]);
  await tick();
  w.emit({ type: "ready" });
  await tick();
  assert.equal(w.sent.filter((m) => m.type === "generate").length, 1, "one at a time");
  const spoken = N.speak("urgent");
  const dup = N.speak("urgent");
  await tick();
  // the first prefetch word is already generating; "urgent" must be next, not behind two and three
  w.emit(audio(w.sent.find((m) => m.type === "generate").id));
  await tick();
  const generating = w.sent.filter((m) => m.type === "generate");
  assert.equal(generating[1].text, "urgent.", "spoken word goes before the remaining prefetch words");
  w.emit(audio(generating[1].id));
  await Promise.all([spoken, dup]);
  assert.equal(generating.filter((m) => m.text === "urgent.").length, 1, "duplicate requests share one generation");
});

test("a failed load rejects everyone waiting, including the word being generated", async () => {
  const { N, workers } = setup();
  N.start();
  const w = workers[0];
  w.emit({ type: "ready" });
  const pending = N.speak("cat", { timeoutMs: 1000 });
  await tick();
  assert.equal(w.sent.filter((m) => m.type === "generate").length, 1);
  w.emit({ type: "error", message: "boom" });
  await assert.rejects(pending, /boom/);
  assert.equal(N.getState().state, "error");
  assert.equal(w.terminated, true);
  N.start();
  assert.equal(workers.length, 2, "the next attempt builds a fresh worker");
});

test("a generated word is stored and later played without generating again", async () => {
  const { N, workers, played, store } = setup();
  N.start();
  const w = workers[0];
  w.emit({ type: "ready" });
  const first = N.speak("cat");
  await tick();
  w.emit(audio(w.sent.find((m) => m.type === "generate").id));
  await first;
  await tick();
  assert.equal(store.size, 1, "saved for next time");
  await N.speak("CAT"); // same word, different case
  assert.equal(w.sent.filter((m) => m.type === "generate").length, 1);
  assert.equal(played().length, 2);
  assert.equal(await N.countStored(["cat", "dog"]), 1);
});

test("whenReady rejects instead of hanging when the engine fails to start", async () => {
  const { N, workers } = setup();
  const waiting = N.whenReady();
  workers[0].emit({ type: "error", message: "offline" });
  await assert.rejects(waiting, /offline/);
});
