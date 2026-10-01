// Natural offline voice: the free Kokoro neural voice, running in a Web Worker.
//
// Generating a word takes a few seconds on a phone, which is too slow to wait for when the
// learner taps Listen. So words are generated ahead of time (prefetch), kept on the device,
// and played instantly afterwards. When a word is not ready yet, speak() fails fast and the
// app falls back to the device voice for that one word.
(() => {
  "use strict";

  const CONFIG_KEY = "spellit_neural_voice";
  const AUDIO_CACHE = "neural-audio-v1"; // not "spellit-*": the service worker deletes those on every release
  const SPEED = 0.95;
  const MEMORY_LIMIT = 80;
  const EXPECTED_DOWNLOAD_BYTES = 92_000_000; // the 8-bit model plus voices, for the progress bar

  // Grades are from the Kokoro model card; only the better-scoring voices are offered.
  const VOICES = [
    { id: "auto", label: "Automatic (matches US/UK spelling)" },
    { id: "af_heart", label: "Heart · US, female (best quality)" },
    { id: "af_bella", label: "Bella · US, female" },
    { id: "af_nicole", label: "Nicole · US, female" },
    { id: "am_michael", label: "Michael · US, male" },
    { id: "am_fenrir", label: "Fenrir · US, male" },
    { id: "bf_emma", label: "Emma · UK, female" },
    { id: "bf_isabella", label: "Isabella · UK, female" },
    { id: "bm_george", label: "George · UK, male" },
    { id: "bm_fable", label: "Fable · UK, male" },
  ];
  const AUTO_VOICE = { us: "af_heart", uk: "bf_emma" };

  let accent = "us";
  let worker = null;
  let state = "idle"; // idle -> loading -> ready | error
  let errorMessage = "";
  let nextId = 1;
  let busy = false;
  const files = new Map(); // file -> { loaded, total }, for one overall download percentage
  const listeners = new Set();
  const urls = new Map(); // cache key -> blob URL of a generated word
  const jobs = []; // waiting to be generated
  const inFlight = new Map(); // cache key -> job (waiting or generating)
  let readyWaiters = [];

  function loadConfig() {
    try {
      const raw = JSON.parse(localStorage.getItem(CONFIG_KEY));
      if (raw && typeof raw === "object") return { enabled: !!raw.enabled, voice: raw.voice || "auto" };
    } catch (e) { /* fall through to defaults */ }
    return { enabled: false, voice: "auto" };
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ enabled: !!cfg.enabled, voice: cfg.voice || "auto" }));
  }

  const supported = () => typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";
  const isEnabled = () => loadConfig().enabled && supported();
  const isReady = () => state === "ready";

  function currentVoice() {
    const { voice } = loadConfig();
    return VOICES.some((v) => v.id === voice && v.id !== "auto") ? voice : AUTO_VOICE[accent] || AUTO_VOICE.us;
  }

  function setAccent(value) { accent = value === "uk" ? "uk" : "us"; }

  function progress() {
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) { loaded += f.loaded || 0; total += f.total || 0; }
    // Small config files finish first and would read as "100%", so measure against the model's size.
    return Math.min(1, loaded / Math.max(total, EXPECTED_DOWNLOAD_BYTES));
  }

  function getState() { return { state, progress: progress(), error: errorMessage, supported: supported() }; }
  function emit() { for (const cb of listeners) { try { cb(getState()); } catch (e) { /* a bad listener must not break speech */ } } }
  function onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }

  function setState(next, message = "") {
    state = next;
    errorMessage = message;
    emit();
  }

  // ---------- worker ----------
  function start() {
    if (worker || !supported()) return;
    try {
      worker = new Worker("neural-voice-worker.js", { type: "module" });
    } catch (e) {
      setState("error", "This browser can't run the natural voice.");
      return;
    }
    setState("loading");
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") {
        files.set(data.file, { loaded: data.loaded, total: data.total });
        emit();
      } else if (data.type === "ready") {
        setState("ready");
        for (const wake of readyWaiters.splice(0)) wake.resolve();
        pump();
      } else if (data.type === "audio") {
        finishJob(data);
      } else if (data.type === "error") {
        data.id ? failJob(data.id, data.message) : fail(data.message);
      }
    };
    worker.onerror = () => fail("The natural voice engine could not start. Check your connection and try again.");
    worker.postMessage({ type: "load" });
  }

  // Ends the current attempt completely (worker, queue and anyone waiting), so the next
  // start() builds a fresh worker. Includes the word being generated, which is no longer in `jobs`.
  function reset(error) {
    if (worker) worker.terminate();
    worker = null;
    busy = false;
    files.clear();
    jobs.length = 0;
    for (const job of inFlight.values()) rejectJob(job, error);
    inFlight.clear();
    for (const wake of readyWaiters.splice(0)) wake.reject(error);
  }

  function fail(message) {
    reset(new Error(message));
    setState("error", message);
  }

  function stop() {
    reset(new Error("Natural voice turned off"));
    setState("idle");
  }

  function whenReady() {
    if (state === "ready") return Promise.resolve();
    return new Promise((resolve, reject) => {
      readyWaiters.push({ resolve, reject });
      start();
      if (state === "error") fail(errorMessage); // start() failed on the spot, so nothing will ever resolve this
    });
  }

  // ---------- generation queue ----------
  const rejectJob = (job, err) => job.waiters.forEach((w) => w.reject(err));

  function pump() {
    if (state !== "ready" || busy || !jobs.length) return;
    // Spoken-now requests jump ahead of background prefetch, newest first.
    let index = -1;
    for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].high) { index = i; break; }
    const job = jobs.splice(index >= 0 ? index : 0, 1)[0];
    busy = true;
    job.id = nextId++;
    worker.postMessage({ type: "generate", id: job.id, text: job.input, voice: job.voice, speed: SPEED });
  }

  function currentJob(id) {
    for (const job of inFlight.values()) if (job.id === id) return job;
    return null;
  }

  async function finishJob({ id, samples, rate }) {
    const job = currentJob(id);
    busy = false;
    pump();
    if (!job) return;
    const blob = toWav(samples, rate);
    remember(job.key, blob);
    inFlight.delete(job.key);
    const url = urlFor(job.key, blob);
    job.waiters.forEach((w) => w.resolve(url));
  }

  function failJob(id, message) {
    const job = currentJob(id);
    busy = false;
    pump();
    if (!job) return;
    inFlight.delete(job.key);
    rejectJob(job, new Error(message));
  }

  // ---------- storage ----------
  const keyOf = (text, voice) => `${voice}|${SPEED}|${text.trim().toLowerCase()}`;
  const cacheRequest = (key) => `https://neural-voice.local/${encodeURIComponent(key)}`;

  function urlFor(key, blob) {
    if (urls.has(key)) return urls.get(key);
    if (urls.size >= MEMORY_LIMIT) {
      const oldest = urls.keys().next().value;
      URL.revokeObjectURL(urls.get(oldest));
      urls.delete(oldest);
    }
    const url = URL.createObjectURL(blob);
    urls.set(key, url);
    return url;
  }

  async function remember(key, blob) {
    try {
      const cache = await caches.open(AUDIO_CACHE);
      await cache.put(cacheRequest(key), new Response(blob, { headers: { "Content-Type": "audio/wav" } }));
    } catch (e) { /* storage full or unavailable: the word is simply regenerated next time */ }
  }

  async function recall(key) {
    try {
      const hit = await caches.match(cacheRequest(key), { cacheName: AUDIO_CACHE });
      return hit ? urlFor(key, await hit.blob()) : null;
    } catch (e) { return null; }
  }

  function toWav(samples, rate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const tag = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
    tag(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); tag(8, "WAVE");
    tag(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    tag(36, "data"); view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  // Resolves to a playable URL. high = a learner is waiting for it, so it fails at once if the
  // engine is not ready; background requests simply wait their turn.
  async function request(text, { high = false } = {}) {
    const voice = currentVoice();
    const key = keyOf(text, voice);
    if (urls.has(key)) return urls.get(key);
    const stored = await recall(key);
    if (stored) return stored;
    if (high && state !== "ready") throw new Error("The natural voice is not ready yet");
    let job = inFlight.get(key);
    if (!job) {
      // A trailing full stop gives a single word natural, falling intonation.
      const input = /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
      job = { key, input, voice, high: false, waiters: [] };
      inFlight.set(key, job);
      jobs.push(job);
    }
    if (high) job.high = true;
    return new Promise((resolve, reject) => {
      job.waiters.push({ resolve, reject });
      pump();
    });
  }

  function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("The natural voice took too long")), ms); });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  // ---------- public ----------
  async function speak(text, { timeoutMs = 8000 } = {}) {
    start(); // idempotent; also begins the download the first time speech is wanted
    const url = await withTimeout(request(text, { high: true }), timeoutMs);
    await window.SpellTTS.playUrl(url);
  }

  // Generate words in the background so they are ready when the learner reaches them.
  function prefetch(texts) {
    if (!isEnabled()) return;
    start();
    for (const text of texts) {
      if (text && String(text).trim()) request(String(text)).catch(() => {});
    }
  }

  // Drop queued background work (the word being generated right now still finishes).
  function cancelPrefetch() {
    for (let i = jobs.length - 1; i >= 0; i--) {
      if (jobs[i].high) continue;
      const [job] = jobs.splice(i, 1);
      inFlight.delete(job.key);
      rejectJob(job, new Error("Cancelled"));
    }
  }

  // Generate every word up front, reporting how many are done. Resolves once all have finished.
  async function prefetchAll(texts, onProgress) {
    await whenReady();
    let done = 0;
    let cancelled = false;
    const total = texts.length;
    const outcomes = texts.map((text) => request(text).then(() => true, (err) => { if (err.message === "Cancelled") cancelled = true; return false; })
      .then((ok) => { if (ok) done += 1; onProgress && onProgress(done, total); }));
    await Promise.all(outcomes);
    return { done, total, cancelled };
  }

  async function countStored(texts) {
    const voice = currentVoice();
    let count = 0;
    for (const text of texts) if (urls.has(keyOf(text, voice)) || await recall(keyOf(text, voice))) count += 1;
    return count;
  }

  window.SpellNeural = {
    VOICES, supported, isEnabled, isReady, loadConfig, saveConfig, setAccent, getState, onChange,
    start, stop, whenReady, speak, prefetch, prefetchAll, cancelPrefetch, countStored,
  };
})();
