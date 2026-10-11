// Listen and read: the app's voice reads a basic passage aloud, one sentence at a time, while a
// highlight follows the words. It helps pronunciation and weaker readers, and it is not a level:
// it never records a result or touches the baseline, unlocks or read counts.
// Words are timed on an estimate (proportional to letters), restarted at every sentence and
// corrected by how long the voice really took. Real word-boundary events are used when the engine
// sends them, but nothing depends on them.
// Registers itself on the trainer's front page with SpellReading.register. The rules above the DOM
// line are pure and exported in Node for tests.
(() => {
  "use strict";

  const SPEEDS = [0.8, 1, 1.2];
  const MS_PER_LETTER = 52;      // speaking time at speed 1 for one letter
  const MS_PER_WORD = 95;        // plus a fixed beat per word
  const COMMA_PAUSE = 190;       // after , ; : and dashes
  const GAP_MS = 220;            // silence between sentences
  const DEVICE_RATE = 0.95;      // the app's own device-voice rate; speed multiplies it
  const MIN_FACTOR = 0.5;
  const MAX_FACTOR = 2.5;

  // Words that end in a full stop without ending the sentence.
  const ABBREVIATIONS = new Set(["mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "mt", "capt", "col", "gen", "lt", "sgt", "rev", "hon", "fig", "no", "vs", "e.g", "i.e", "cf", "approx", "est"]);
  const CLOSERS = "[\"”’')\\]]*";
  const END_RE = new RegExp(`[.!?…]${CLOSERS}$`, "u");
  const STRONG_END_RE = new RegExp(`[!?…]${CLOSERS}$`, "u");

  const letterCount = (word) => word.replace(/[^\p{L}\p{N}]/gu, "").length;

  // Does this token close a sentence? `next` is the token after it, or undefined at the end of the text.
  function endsSentence(token, next) {
    if (next === undefined) return true;
    if (!END_RE.test(token)) return false;
    if (STRONG_END_RE.test(token)) return true;
    const stem = token.replace(new RegExp(`${CLOSERS}$`, "u"), "").replace(/^["“‘'(\[]+/u, "").slice(0, -1).toLowerCase();
    if (/^\p{L}$/u.test(stem)) return false;                        // an initial: J. R. R.
    if (ABBREVIATIONS.has(stem)) return false;                      // Dr. Mr. e.g. vs.
    if (/^(?:\p{L}\.)+\p{L}$/u.test(stem)) return /^["“‘'(\[]?\p{Lu}/u.test(next); // U.S. ends a sentence only before a capital
    if (/^\d+$/.test(stem) && /^["“‘'(\[]?\p{Ll}/u.test(next)) return false; // "chapter 3. and" is rare, "3. then" is a list
    return true;
  }

  // Split text into sentences. Works on whitespace-separated tokens, so decimals (3.5), abbreviations
  // (Dr. Smith), initials and closing quotes ("Go home.") are not mistaken for sentence ends.
  function splitSentences(text) {
    const tokens = String(text || "").split(/\s+/).filter(Boolean);
    const out = [];
    let current = [];
    tokens.forEach((token, i) => {
      current.push(token);
      if (endsSentence(token, tokens[i + 1])) { out.push(current.join(" ")); current = []; }
    });
    if (current.length) out.push(current.join(" "));
    return out;
  }

  // A passage as sentences, each with its words and the position of its first word counted across
  // all paragraphs: the same numbering the word spans use.
  function sentencesOf(paragraphs) {
    const out = [];
    let first = 0;
    paragraphs.forEach((paragraph, para) => {
      for (const text of splitSentences(paragraph)) {
        const words = text.split(/\s+/).filter(Boolean);
        out.push({ text, words, first, para });
        first += words.length;
      }
    });
    return out;
  }

  // Estimated speaking time of one word, in ms at speed 1: proportional to its letters, plus a beat
  // and a short pause where punctuation inside the sentence calls for one.
  function wordMs(word) {
    let ms = MS_PER_WORD + letterCount(word) * MS_PER_LETTER;
    if (new RegExp(`[,;:\\u2013\\u2014]${CLOSERS}$`, "u").test(word)) ms += COMMA_PAUSE;
    return ms;
  }

  // When each word of one sentence is said, relative to the start of the sentence. `speed` is how
  // fast the voice talks, `factor` corrects the estimate from measured speech, `lead` is the wait
  // before the first word (a network voice takes a moment to start).
  function buildSchedule(words, { speed = 1, factor = 1, lead = 0 } = {}) {
    const scale = factor / (speed > 0 ? speed : 1);
    let at = lead;
    const slots = words.map((word) => {
      const start = at;
      at += wordMs(word) * scale;
      return { start, end: at };
    });
    return { words: slots, total: at };
  }

  // The word being said `elapsed` ms into a sentence: -1 before the first word, and the last word
  // while the voice is still finishing (the highlight never runs off the end).
  function wordAt(schedule, elapsed) {
    const slots = schedule.words;
    if (!slots.length || elapsed < slots[0].start) return -1;
    let lo = 0, hi = slots.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (slots[mid].start <= elapsed) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  // The whole passage on one clock, for estimating its length and for finding a place by time.
  function buildTimeline(sentences, options = {}) {
    const gap = options.gap ?? GAP_MS;
    let at = 0;
    const entries = sentences.map((s) => {
      const schedule = buildSchedule(s.words, options);
      const entry = { start: at, end: at + schedule.total, schedule };
      at = entry.end + gap;
      return entry;
    });
    return { sentences: entries, total: entries.length ? at - gap : 0 };
  }

  // Which sentence and word is being said `t` ms into the passage. Null before the start or after
  // the end. In the gap between two sentences it is still the last word of the earlier one.
  function locate(timeline, t, sentences) {
    const list = timeline.sentences;
    if (!list.length || t < 0 || t > timeline.total) return null;
    let s = 0;
    while (s + 1 < list.length && list[s + 1].start <= t) s++;
    const word = Math.max(0, wordAt(list[s].schedule, t - list[s].start));
    return { sentence: s, word, globalWord: sentences ? sentences[s].first + word : null };
  }

  // The word a character position falls in, for an engine's word-boundary events. `words` are the
  // words of a sentence that was spoken as words.join(" ").
  function wordAtChar(words, charIndex) {
    let at = 0;
    for (let i = 0; i < words.length; i++) {
      if (charIndex < at + words[i].length + 1) return i;
      at += words[i].length + 1;
    }
    return Math.max(0, words.length - 1);
  }

  // Blend what the voice really took into the running correction, so later sentences keep time.
  // Short sentences are too noisy to learn from. Always between MIN_FACTOR and MAX_FACTOR.
  function calibrate(factor, estimatedMs, actualMs, wordCount = 99) {
    if (!(estimatedMs > 0) || !(actualMs > 0) || wordCount < 3) return factor;
    const measured = factor * (actualMs / estimatedMs);
    const next = factor * 0.4 + measured * 0.6;
    return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, next));
  }

  // A tapped word as it is said alone: no edge punctuation or quotes, inner apostrophes kept.
  const cleanWord = (token) => String(token || "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

  const api = { SPEEDS, DEVICE_RATE, splitSentences, sentencesOf, wordMs, buildSchedule, wordAt, buildTimeline, locate, wordAtChar, calibrate, cleanWord };

  if (typeof window === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    return;
  }

  // ---------- DOM ----------
  const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let host = null;     // the trainer's api (home, ...)
  let root = null;
  let view = null;     // the passage on screen, or null
  let watchers = [];   // observers and listeners to drop when the view closes

  // ----- voices -----
  const synth = () => ("speechSynthesis" in window ? window.speechSynthesis : null);
  // ElevenLabs and the natural voice are the learner's own choices; the device voice is the fallback.
  function engineKind() {
    if (window.SpellTTS?.isEnabled?.()) return "eleven";
    if (window.SpellNeural?.isEnabled?.()) return "neural";
    return synth() ? "device" : "none";
  }

  function deviceVoice() {
    const picked = window.SpellSpeech?.pickVoice?.();
    if (picked) return picked;
    return synth()?.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith("en")) || null;
  }

  // Every way speech can be running, stopped together: the same pair the app cancels when a round ends.
  function cancelSpeech() {
    try { synth()?.cancel(); } catch { /* nothing speaking */ }
    try { window.SpellTTS?.stop?.(); } catch { /* nothing playing */ }
  }

  let utterance = null; // kept referenced: Chrome can collect a playing utterance and never fire onend

  // Say one sentence on the device voice. Resolves when it ends; rejects if the voice never starts.
  function speakDevice(text, speed, hooks, retry = false) {
    return new Promise((resolve, reject) => {
      const engine = synth();
      if (!engine) return reject(new Error("no speech engine"));
      const utter = new SpeechSynthesisUtterance(text);
      const voice = deviceVoice();
      if (voice) { utter.voice = voice; utter.lang = voice.lang; } else utter.lang = "en-US";
      utter.rate = Math.min(2, Math.max(0.5, DEVICE_RATE * speed));
      let started = false, settled = false;
      const watchdog = setTimeout(() => {
        if (started || settled) return;
        // A wedged engine queues the utterance and never starts it: reset it and try once more.
        settled = true;
        try { engine.cancel(); } catch { /* ignore */ }
        if (retry) reject(new Error("the voice did not start"));
        else setTimeout(() => speakDevice(text, speed, hooks, true).then(resolve, reject), 90);
      }, 3000);
      const done = (fn, value) => { if (settled) return; settled = true; clearTimeout(watchdog); fn(value); };
      utter.onstart = () => { started = true; hooks.onStart(); };
      utter.onboundary = (e) => { if (e.name === undefined || e.name === "word") hooks.onBoundary(e.charIndex); };
      utter.onend = () => done(resolve);
      utter.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return done(resolve); // cancelled by us
        done(reject, new Error(e.error || "speech failed"));
      };
      utterance = utter;
      engine.speak(utter);
    });
  }

  // ----- screens -----
  function basicPassages() {
    return window.SpellReadingPassages?.PASSAGES || [];
  }

  function homeCard() {
    return `<button class="ls-card" type="button" data-ls="open">
      <span class="ls-card-icon" aria-hidden="true"><span></span><span></span><span></span></span>
      <span><small>Listen and read</small><strong>Hear a passage while you follow along</strong><span>The app reads it aloud and highlights each word. Good for pronunciation. It does not count as a level.</span></span>
    </button>`;
  }

  function renderPicker() {
    closeView();
    const items = basicPassages().map((p, i) => {
      const words = p.paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
      return `<li><button class="ls-pick" type="button" data-ls="pick" data-i="${i}"><strong>${escapeHtml(p.title)}</strong><small>${words} words</small></button></li>`;
    }).join("");
    root.innerHTML = `<p class="feature-eyebrow">Listen and read</p>
      <h3 class="rd-title">Pick a passage</h3>
      <p class="feature-intro">The voice reads one sentence at a time and the highlight follows. Tap any word to hear it alone. This does not change your levels or your speed.</p>
      <ul class="ls-picks">${items}</ul>
      <button class="btn btn-ghost" type="button" data-ls="home">Back to levels</button>`;
    root.scrollTop = 0;
    window.scrollTo?.(0, 0);
  }

  function renderView(passage) {
    closeView();
    const sentences = sentencesOf(passage.paragraphs);
    let index = 0;
    const body = passage.paragraphs.map((_, para) => {
      const spans = [];
      sentences.forEach((s, si) => {
        if (s.para === para) for (const w of s.words) spans.push(`<span class="ls-w" data-i="${index++}" data-s="${si}">${escapeHtml(w)}</span>`);
      });
      return `<p>${spans.join(" ")}</p>`;
    }).join("");
    const kind = engineKind();
    root.innerHTML = `<p class="feature-eyebrow">Listen and read</p>
      <div class="ls-msg" id="ls-msg" role="status" aria-live="polite" ${kind === "none" ? "" : "hidden"}>${kind === "none" ? "No voice is available on this device, so the passage cannot be read aloud. The text is here to read." : ""}</div>
      <article class="ls-text" aria-label="${escapeHtml(passage.title)}"><h3>${escapeHtml(passage.title)}</h3>${body}</article>
      <div class="ls-dock">
        <div class="ls-controls">
          <button class="btn btn-primary" type="button" data-ls="play" ${kind === "none" ? "disabled" : ""}>Play</button>
          <button class="btn btn-ghost" type="button" data-ls="stop" disabled>Stop</button>
          <div class="ls-speeds" role="group" aria-label="Speed">${SPEEDS.map((s) => `<button type="button" class="ls-speed${s === 1 ? " on" : ""}" data-ls="speed" data-speed="${s}" aria-pressed="${s === 1}">${s}x</button>`).join("")}</div>
        </div>
      </div>
      <p class="settings-note ls-note">${kind === "device" || kind === "none" ? "Tap a word to hear it alone." : "Tap a word to hear it alone. Speed changes only work with the device voice."}</p>
      <button class="btn btn-primary btn-big" type="button" data-ls="read">Now read it yourself</button>
      <button class="btn btn-ghost" type="button" data-ls="back">Pick another passage</button>`;
    root.scrollTop = 0;
    window.scrollTo?.(0, 0);

    view = {
      passage, sentences, kind,
      spans: [...root.querySelectorAll(".ls-w")],
      state: "idle",       // idle | playing | paused | done
      at: 0,               // the sentence being spoken, or the one to speak next
      speed: 1,
      factor: 1,           // measured correction to the time estimate
      token: 0,            // bumped on every start, pause and stop: a stale sentence ignores its own end
      timer: null,
    };
    watch();
  }

  function say(message) {
    const box = root?.querySelector("#ls-msg");
    if (!box) return;
    box.textContent = message;
    box.hidden = !message;
  }

  function setControls() {
    if (!view) return;
    const label = { playing: "Pause", paused: "Resume", done: "Play again", idle: "Play" }[view.state];
    root.querySelector('[data-ls="play"]').textContent = label;
    root.querySelector('[data-ls="stop"]').disabled = view.state === "idle";
  }

  // Highlight a sentence softly and one word strongly. A word of -1 clears the word.
  function mark(sentenceIndex, wordIndex) {
    if (!view) return;
    const s = view.sentences[sentenceIndex];
    view.spans.forEach((span, i) => {
      span.classList.toggle("ls-sent", Boolean(s) && i >= s.first && i < s.first + s.words.length);
      span.classList.toggle("ls-on", Boolean(s) && wordIndex >= 0 && i === s.first + wordIndex);
    });
    const target = s && wordIndex >= 0 ? view.spans[s.first + wordIndex] : null;
    if (target) {
      const box = target.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.2 || box.bottom > window.innerHeight * 0.6) {
        target.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
      }
    }
  }

  function clearMarks() {
    view?.spans.forEach((span) => span.classList.remove("ls-sent", "ls-on"));
  }

  function stopClock() {
    if (view?.timer) { clearInterval(view.timer); view.timer = null; }
  }

  // Stop all sound and timing now. Used for pause, stop and leaving.
  function halt() {
    if (view) { view.token++; stopClock(); }
    cancelSpeech();
  }

  async function speakFrom(i) {
    const v = view;
    const token = ++v.token;
    const fresh = () => view === v && v.token === token;
    v.state = "playing";
    say("");
    setControls();
    // Chrome drops an utterance spoken in the same tick as cancel(), so wait a moment after one.
    if (synth()?.speaking || synth()?.pending) { cancelSpeech(); await delay(90); if (!fresh()) return; }

    for (v.at = i; v.at < v.sentences.length; v.at++) {
      const s = v.sentences[v.at];
      const at = v.at;
      const kind = engineKind();
      v.kind = kind;
      const speed = kind === "device" ? v.speed : 1;
      const lead = kind === "device" ? 0 : 350;
      const timing = {
        began: 0,                                   // when the voice started, 0 until it has
        boundary: false,                            // true once the engine reports real word positions
        word: -1,
        schedule: buildSchedule(s.words, { speed, factor: v.factor, lead }),
        estimate: buildSchedule(s.words, { speed, factor: 1, lead }).total,
      };
      const hooks = {
        onStart: () => { if (fresh()) timing.began = performance.now(); },
        onBoundary: (charIndex) => {
          if (!fresh() || !Number.isFinite(charIndex)) return;
          timing.boundary = true;
          const word = wordAtChar(s.words, charIndex);
          if (word > timing.word) { timing.word = word; mark(at, word); }
        },
      };
      mark(at, -1);
      startClock(v, token, at, timing);
      try {
        await speakSentence(s, kind, v, fresh, timing, hooks);
      } catch (err) {
        if (!fresh()) return;
        console.warn("Listen and read: the voice stopped", err);
        halt();
        v.state = "paused";
        setControls();
        say("The voice stopped. Press Resume to try this sentence again, or read the text yourself.");
        return;
      }
      if (!fresh()) return;
      if (timing.began) v.factor = calibrate(v.factor, timing.estimate, performance.now() - timing.began, s.words.length);
      mark(at, s.words.length - 1);
      if (at + 1 < v.sentences.length) { await delay(GAP_MS); if (!fresh()) return; }
    }
    stopClock();
    v.state = "done";
    v.at = 0;
    clearMarks();
    setControls();
  }

  async function speakSentence(s, kind, v, fresh, timing, hooks) {
    if (kind === "eleven" || kind === "neural") {
      timing.began = performance.now(); // these voices give no start signal: count from the request, correct at the next sentence
      try {
        const next = v.sentences[v.at + 1];
        if (kind === "neural" && next) window.SpellNeural.prefetch?.([next.text]);
        if (kind === "eleven") await window.SpellTTS.speak(s.text);
        else await window.SpellNeural.speak(s.text, { timeoutMs: 6000 });
        return;
      } catch (err) {
        if (!fresh() || !synth()) throw err;
        // Fall back to the device voice for this sentence, as the app does for a word.
        timing.began = 0;
        timing.schedule = buildSchedule(s.words, { speed: v.speed, factor: v.factor });
      }
    }
    await speakDevice(s.text, v.speed, hooks);
  }

  // Moves the word highlight along the estimated schedule. Real boundary events take over when they come.
  function startClock(v, token, at, timing) {
    stopClock();
    v.timer = setInterval(() => {
      if (view !== v || v.token !== token || !timing.began || timing.boundary) return;
      const word = wordAt(timing.schedule, performance.now() - timing.began);
      if (word !== timing.word) { timing.word = word; mark(at, word); }
    }, 60);
  }

  function pause() {
    if (!view || view.state !== "playing") return;
    // Engines differ on pausing mid-sentence, so stop and take this sentence again from its start on resume.
    halt();
    view.state = "paused";
    setControls();
  }

  function play() {
    if (!view || view.kind === "none") return;
    if (view.state === "playing") return pause();
    const from = view.state === "done" ? 0 : view.at;
    clearMarks();
    speakFrom(from);
  }

  function stop() {
    if (!view) return;
    halt();
    view.state = "idle";
    view.at = 0;
    clearMarks();
    say("");
    setControls();
  }

  function setSpeed(speed) {
    if (!view || !SPEEDS.includes(speed)) return;
    view.speed = speed;
    view.factor = 1;
    root.querySelectorAll(".ls-speed").forEach((b) => {
      const on = Number(b.dataset.speed) === speed;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    // A new speed takes effect from the start of the sentence being spoken.
    if (view.state === "playing") { const from = view.at; halt(); speakFrom(from); }
  }

  // One word on its own, through the app's own speak, so it follows the learner's chosen voice.
  function sayWord(span) {
    const word = cleanWord(span.textContent);
    if (!word) return;
    if (view.state === "playing") pause(); else cancelSpeech();
    if (!window.SpellSpeech?.speak) return say("Single words cannot be spoken on this device.");
    window.SpellSpeech.speak(word);
    span.classList.add("ls-tap");
    setTimeout(() => span.classList.remove("ls-tap"), 700);
  }

  // Everything that must end when the learner leaves: sound, timers, observers.
  function closeView() {
    if (view) { halt(); view.state = "idle"; }
    view = null;
    for (const off of watchers) { try { off(); } catch { /* already gone */ } }
    watchers = [];
  }

  // Leaving the screen, going back to the levels, or switching apps stops the voice at once.
  function watch() {
    const v = view;
    const leave = () => { if (view === v) closeView(); };
    const onHidden = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", leave);
    watchers.push(() => document.removeEventListener("visibilitychange", onHidden), () => window.removeEventListener("pagehide", leave));
    if (typeof MutationObserver === "function") {
      const screen = root.closest(".screen");
      const gone = new MutationObserver(() => {
        if (view === v && (!root.contains(v.spans[0]) || (screen && !screen.classList.contains("active")))) leave();
      });
      gone.observe(root, { childList: true });
      if (screen) gone.observe(screen, { attributes: true, attributeFilter: ["class"] });
      watchers.push(() => gone.disconnect());
    }
  }

  function onClick(event) {
    const word = event.target.closest(".ls-w");
    if (word && view) return sayWord(word);
    const target = event.target.closest("[data-ls]");
    if (!target || target.disabled) return;
    switch (target.dataset.ls) {
      case "open": return renderPicker();
      case "pick": { const passage = basicPassages()[Number(target.dataset.i)]; return passage && renderView(passage); }
      case "play": return play();
      case "stop": return stop();
      case "speed": return setSpeed(Number(target.dataset.speed));
      case "back": return renderPicker();
      case "home": closeView(); return host.home();
      case "read": // leave for the normal timed read: level 1 is always open
        closeView();
        host.home();
        return root.querySelector('.rd-level[data-level="1"]')?.click();
    }
  }

  window.SpellReadingListen = api;
  window.SpellReading?.register({
    id: "listen",
    home: () => (basicPassages().length ? homeCard() : ""),
    bind(rootEl, trainer) {
      host = trainer;
      closeView();
      if (root !== rootEl) { root = rootEl; root.addEventListener("click", onClick); }
    },
  });
})();
