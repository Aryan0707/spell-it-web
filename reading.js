// Reading trainer: seven levels, from measuring your natural speed to a mastery test well above it.
// Each level teaches one technique, drills it on a short passage, then asks three questions with the
// passage hidden. Speed only counts with understanding: every level needs two thirds of the answers
// right (2 of 3 on the basic texts, 4 of 5 on the advanced ones), and the headline number is effective speed (words per minute × share right), so racing
// through and guessing never scores well.
// Progress stays in this browser; like the chat, it is not part of backups or sync yet.
// The rules below the DOM line are pure and exported in Node for tests.
(() => {
  "use strict";

  const STORAGE_KEY = "spellit_reading";
  const PASS_SHARE = 2 / 3;      // share of questions needed to pass any level: 2 of 3, or 4 of 5
  const MIN_WPM = 80;
  const MAX_WPM = 1000;
  const MAX_RESULTS = 100;
  // The final test: this many times your starting speed, still understanding it. The starting speed was
  // measured on the easier passages and the test uses an advanced one, so 1.3× here is a real step up.
  const MASTERY_GOAL = 1.3;
  const PREVIEW_SECONDS = 20;
  const SCAN_SECONDS = 20;       // per question in the scanning level

  // The method, shown on the trainer's front page. It is what the levels teach, in order.
  const METHOD = [
    { title: "Measure speed and understanding together", text: "Speed means nothing if you cannot say what you read. Track effective speed: words per minute × the share of questions you got right." },
    { title: "Know why you are reading", text: "Before you start, decide what you need: the main idea, one fact, or every detail. Your purpose sets your speed." },
    { title: "Preview first", text: "Spend 20 seconds on the title and the first sentence of each paragraph. With a map of where the text is going, the full read is faster and sticks better." },
    { title: "Keep your eyes moving forward", text: "Much slow reading is jumping back over words you already read. Run a finger, pen or cursor under the line at a steady pace and follow it." },
    { title: "Read in phrases, not single words", text: "Take in meaningful groups like \"at the end of the day\". Your inner voice can stay: it helps understanding. Let it say phrases instead of words." },
    { title: "Scan when you need one fact", text: "Do not read. Hunt for the shape of the answer: a number, a name, a capital letter, a key word from the question." },
    { title: "Change gear", text: "Slow down for hard or important parts and speed through what you already know. Good readers are flexible, not fast all the time." },
    { title: "A little every day", text: "Ten minutes daily beats an hour once a week. Reading widely grows your vocabulary, the biggest long-term speed boost of all." },
  ];

  const HONEST_NOTE = "Most adults read 200–300 words per minute. Claims of 1,000+ words per minute with full understanding are not supported by research. A realistic goal is to read 20–50% faster with the same understanding, and to skim much faster when you only need the gist.";

  // drill: timed (read at your own pace), pacer (a highlight sets the pace), preview (preview, then pacer),
  // scan (find each answer against the clock), rsvp (words flash in one spot).
  // boost: the starting pace for the level, as a multiple of your first measured speed.
  const LEVELS = [
    { n: 1, tier: "Basic", name: "Find your speed", drill: "timed", short: "Read normally. We measure your speed and understanding.",
      why: "You cannot improve what you have not measured. This sets your starting speed, and every later level builds on it.",
      steps: ["Read at your normal pace. Do not rush: this is not a race.", "Press Done as soon as you finish.", "Answer three questions without looking back."] },
    { n: 2, tier: "Basic", name: "Guide your eyes", drill: "pacer", chunk: 1, boost: 1.15, short: "A moving highlight keeps you reading forward.",
      why: "Readers often jump back to words they already read without noticing. A pacer stops that habit, which alone makes reading faster.",
      steps: ["Follow the highlight with your eyes. Do not look back.", "If you miss a word, keep going: the meaning usually comes back from the next sentence.", "Off the app, use a finger or pen under the line the same way."] },
    { n: 3, tier: "Intermediate", name: "Read in phrases", drill: "pacer", chunk: 3, boost: 1.3, short: "Take in a few words at a time.",
      why: "Your eyes stop a few times on each line. Each stop can take in more than one word, so reading in phrases means fewer stops for the same text.",
      steps: ["Look at the middle of each highlighted phrase and take it in as one idea.", "Let your inner voice say the phrase, not each word.", "Keep up with the highlight even if it feels fast."] },
    { n: 4, tier: "Intermediate", name: "Preview, then read", drill: "preview", chunk: 3, boost: 1.4, short: "Get the big picture first, then read faster.",
      why: "Knowing where a text is going lets you read it faster and remember more. A short preview of the opening sentences builds that map.",
      steps: [`You get ${PREVIEW_SECONDS} seconds to read the title and the first sentence of each paragraph.`, "Guess what the passage will say.", "Then read it in phrases with the highlight. One question will be about the main idea."] },
    { n: 5, tier: "Advanced", name: "Scan for facts", drill: "scan", texts: "advanced", short: "Hunt down facts in a dense text and tap them.",
      why: "When you need one fact, reading every word wastes time. Scanning means hunting for the shape of the answer and skipping everything else. This text is longer and denser than before, so reading all of it will not fit in the time.",
      steps: ["Read the question and decide what the answer looks like: a year, a name, a measurement.", "Sweep your eyes down the text for that shape. Capitals, digits and the question's key word jump out.", `Tap the answer in the text within ${SCAN_SECONDS} seconds. A wrong tap shows you where it was.`] },
    { n: 6, tier: "Advanced", name: "Sprint", drill: "rsvp", chunk: 1, boost: 1.6, texts: "advanced", short: "Words flash one at a time, lined up on a focus letter.",
      why: "Each word appears in the same spot, lined up on the letter where the eye recognises a word fastest, so your eyes never have to move. Long words and sentence ends stay up a little longer and the rest go a little faster, so the average pace is unchanged. This trains focus at speed. It is a workout, not a way to read hard texts.",
      steps: ["Keep your eyes on the orange focus letter between the two marks. It never moves.", "Do not try to say every word. Hold the meaning as it flows.", "Afterwards you need four of five answers right."] },
    { n: 7, tier: "Advanced", name: "Mastery test", drill: "timed", texts: "advanced", short: `A longer, harder text on your own at ${MASTERY_GOAL}× your starting speed.`,
      why: `Nothing sets the pace here, and the text is harder than the one you started on. That is why the goal is ${MASTERY_GOAL}× your starting speed: reading dense text that fast, and understanding it, shows the skills have become yours.`,
      steps: ["Preview the first sentences quickly on your own.", "Read forward in phrases. Slow down where it gets dense, speed up where it is easy.", `Pass at ${MASTERY_GOAL}× your starting speed with at least four of five answers right.`] },
  ];

  const clampWpm = (wpm) => Math.round(Math.min(MAX_WPM, Math.max(MIN_WPM, wpm)));

  function countWords(text) {
    return String(text || "").split(/\s+/).filter(Boolean).length;
  }

  function passageWords(passage) {
    return passage.paragraphs.map((p) => p.split(/\s+/).filter(Boolean));
  }

  function wordsPerMinute(words, ms) {
    if (!(ms > 0)) return 0;
    return Math.round(words / (ms / 60000));
  }

  function effectiveWpm(wpm, share) {
    return Math.round((wpm || 0) * share);
  }

  // Split a paragraph's words into phrases of up to `size`, ending a phrase early at punctuation so a
  // phrase never spans two clauses. Each phrase's `weight` is how long it stays up, in word-lengths:
  // the end of a sentence gets a short extra beat.
  function makeChunks(words, size) {
    const chunks = [];
    let current = [];
    const flush = () => {
      if (!current.length) return;
      const last = current[current.length - 1];
      chunks.push({ words: current, weight: current.length + (/[.!?]["”)]?$/.test(last) ? 0.5 : 0) });
      current = [];
    };
    for (const word of words) {
      current.push(word);
      if (current.length >= size || /[,.;:!?]["”)]?$/.test(word)) flush();
    }
    flush();
    return chunks;
  }

  const normWord = (word) => word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

  // Every place a phrase occurs in a passage, as word positions { first, last } counted across all
  // paragraphs: the same numbering the tappable words use. Case and edge punctuation are ignored.
  function findSpans(passage, phrase) {
    const words = passageWords(passage).flat().map(normWord);
    const target = phrase.split(/\s+/).map(normWord);
    const spans = [];
    for (let i = 0; i + target.length <= words.length; i++) {
      if (target.every((t, k) => words[i + k] === t)) spans.push({ first: i, last: i + target.length - 1 });
    }
    return spans;
  }

  // Sprint display: the focus letter a flashed word is lined up on, a little left of its middle, where
  // the eye recognises a word fastest. Returns [before, focus, after].
  function orpSplit(word) {
    const start = word.search(/[\p{L}\p{N}]/u);
    if (start < 0) return ["", word, ""];
    const length = word.slice(start).replace(/[^\p{L}\p{N}]+$/u, "").length;
    const at = start + (length <= 1 ? 0 : length <= 5 ? 1 : length <= 9 ? 2 : length <= 13 ? 3 : 4);
    return [word.slice(0, at), word[at], word.slice(at + 1)];
  }

  // How long a word stays up in the sprint, in average word-lengths: long words and the ends of clauses
  // and sentences get extra time. The run is rescaled so the overall pace still matches the target.
  function flashWeight(word) {
    const letters = word.replace(/[^\p{L}\p{N}]/gu, "").length;
    let weight = 1;
    if (letters >= 9) weight += 0.4;
    if (/[.!?]["”')]?$/.test(word)) weight += 1;
    else if (/[,;:]["”')]?$/.test(word)) weight += 0.5;
    return weight;
  }

  function passagesFor(level, sets) {
    const advanced = level.texts === "advanced" && sets.ADVANCED_PASSAGES?.length;
    const base = advanced ? sets.ADVANCED_PASSAGES : sets.PASSAGES;
    const extra = sets.generatedFor?.(advanced ? "advanced" : "basic") || []; // AI-made passages (reading-generated.js)
    return extra.length ? [...base, ...extra] : base;
  }

  // ---------- progress ----------
  function emptyState() {
    return { v: 1, baseline: null, unlocked: 1, targets: {}, results: [], read: {} };
  }

  function sanitize(raw) {
    const state = emptyState();
    if (!raw || typeof raw !== "object") return state;
    if (Number.isFinite(raw.baseline) && raw.baseline > 0) state.baseline = clampWpm(raw.baseline);
    if (Number.isInteger(raw.unlocked)) state.unlocked = Math.min(LEVELS.length, Math.max(1, raw.unlocked));
    if (!state.baseline) state.unlocked = 1; // every level after the first is paced from the baseline
    for (const level of LEVELS) {
      const t = raw.targets?.[level.n];
      if (Number.isFinite(t)) state.targets[level.n] = clampWpm(t);
    }
    if (Array.isArray(raw.results)) {
      state.results = raw.results.filter((r) => r && Number.isInteger(r.level) && Number.isFinite(r.share)).slice(-MAX_RESULTS);
    }
    if (raw.read && typeof raw.read === "object") {
      for (const [id, count] of Object.entries(raw.read)) if (Number.isInteger(count) && count > 0) state.read[id] = count;
    }
    return state;
  }

  // The pace for a paced level. Starts at the level's multiple of your baseline; after each run it
  // moves with adaptTarget. The mastery test's goal is fixed so it always means the same thing.
  function targetFor(state, levelNumber) {
    const level = LEVELS[levelNumber - 1];
    if (!state.baseline) return null;
    if (level.n === LEVELS.length) return clampWpm(state.baseline * MASTERY_GOAL);
    if (!level.boost) return null;
    return state.targets[level.n] || clampWpm(state.baseline * level.boost);
  }

  // Faster than this is skimming, not reading with understanding, whatever the quiz says: a lucky
  // guess or a passage remembered from last time must not become a baseline.
  const tooFast = (result) => result.wpm > MAX_WPM;

  function passes(level, result, state) {
    if (result.share < PASS_SHARE || tooFast(result)) return false;
    if (level.n === LEVELS.length) return result.wpm >= targetFor(state, level.n);
    return true;
  }

  // How the pace of a paced level changes after a run, so practice stays just hard enough.
  //   target: the pace (words per minute) the learner just read at.
  //   result: { wpm, share } where share is the fraction of questions answered right (0, 1/3, 2/3 or 1).
  // Returns the pace for next time; the caller clamps it to a sensible range.
  function adaptTarget(target, result) {
    // TODO(you): decide how the pace responds to how well the learner understood.
    return target;
  }

  // Store one finished run and return what changed. Pure: takes a state, returns a new one.
  function recordResult(state, levelNumber, result, passageId, now = Date.now()) {
    const level = LEVELS[levelNumber - 1];
    const next = sanitize(JSON.parse(JSON.stringify(state)));
    const passed = passes(level, result, state);
    next.results.push({ at: now, level: level.n, passage: passageId, wpm: result.wpm || 0, share: result.share, passed });
    next.results = next.results.slice(-MAX_RESULTS);
    next.read[passageId] = (next.read[passageId] || 0) + 1;
    // The first passing level-1 read becomes the baseline and stays fixed, so the mastery test always
    // measures growth from where you started. Later level-1 reads are just check-ins.
    if (level.n === 1 && passed && !next.baseline) next.baseline = clampWpm(result.wpm);
    if (level.boost && result.wpm) next.targets[level.n] = clampWpm(adaptTarget(targetFor(state, level.n), result));
    const unlockedNew = passed && next.baseline && level.n === next.unlocked && level.n < LEVELS.length;
    if (unlockedNew) next.unlocked = level.n + 1;
    return { state: next, passed, unlockedNew: Boolean(unlockedNew) };
  }

  // The passage read least often, never the one just read when there is a choice.
  function pickPassage(state, passages, random = Math.random) {
    const last = state.results[state.results.length - 1]?.passage;
    const pool = passages.length > 1 ? passages.filter((p) => p.id !== last) : passages;
    const fewest = Math.min(...pool.map((p) => state.read[p.id] || 0));
    const options = pool.filter((p) => (state.read[p.id] || 0) === fewest);
    return options[Math.floor(random() * options.length)];
  }

  function stats(state) {
    const read = state.results.filter((r) => r.wpm > 0 && !tooFast(r));
    const best = read.reduce((max, r) => Math.max(max, effectiveWpm(r.wpm, r.share)), 0);
    const latestCheck = [...state.results].reverse().find((r) => r.level === 1 || r.level === LEVELS.length);
    return { sessions: state.results.length, bestEffective: best, latest: latestCheck || null };
  }

  const api = { LEVELS, METHOD, PASS_SHARE, MASTERY_GOAL, MAX_WPM, countWords, passageWords, wordsPerMinute, effectiveWpm, makeChunks,
    findSpans, orpSplit, flashWeight, passagesFor,
    emptyState, sanitize, targetFor, passes, adaptTarget, recordResult, pickPassage, stats };

  if (typeof window === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    return;
  }

  // ---------- DOM ----------
  let adapter = null;
  let root = null;
  let state = emptyState();
  let run = null; // the read in progress: { level, passage, startedAt, ... }

  // Extensions: other files add to the trainer without editing this one. An extension is
  //   { id, home?(api) => html for the front page, bind?(root, api) => wire it up after the page renders }
  // and registers itself with SpellReading.register(ext) when its script loads (after reading.js).
  const extensions = [];
  const api_ = () => ({ state: () => state, save: () => { save(); }, setState: (next) => { state = next; save(); }, home: renderHome, root: () => root, adapter: () => adapter, escapeHtml });
  const extensionHtml = () => extensions.map((e) => { try { return e.home?.(api_()) || ""; } catch (err) { console.warn("reading extension", e.id, err); return ""; } }).join("");
  const bindExtensions = () => extensions.forEach((e) => { try { e.bind?.(root, api_()); } catch (err) { console.warn("reading extension", e.id, err); } });

  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function load() {
    try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return emptyState(); }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage full or blocked: progress just is not kept */ }
  }

  const isOpen = () => root && root.closest(".screen")?.classList.contains("active");

  function stopTimers() {
    if (run?.timer) { clearInterval(run.timer); run.timer = null; }
  }

  function render(html) {
    window.SpellReadingLesson?.stop();
    root.innerHTML = html;
    root.scrollTop = 0;
    window.scrollTo?.(0, 0);
  }

  // ---------- front page ----------
  function renderHome() {
    stopTimers();
    run = null;
    const s = stats(state);
    const levelRows = LEVELS.map((level) => {
      const locked = level.n > state.unlocked;
      const done = state.results.some((r) => r.level === level.n && r.passed);
      const target = targetFor(state, level.n);
      const pace = level.drill === "scan" ? `${SCAN_SECONDS}s per fact` : target ? `${target} wpm` : level.n === 1 ? "your pace" : "";
      return `<li><button class="rd-level${locked ? " locked" : ""}${done ? " done" : ""}${level.n === state.unlocked ? " current" : ""}" data-level="${level.n}" ${locked ? "disabled" : ""}>
        <span class="rd-level-num" aria-hidden="true">${done ? "✓" : level.n}</span>
        <span class="rd-level-text"><small>${level.tier}${pace ? ` · ${pace}` : ""}</small><strong>${escapeHtml(level.name)}</strong><span>${escapeHtml(level.short)}</span></span>
        ${locked ? '<span class="rd-lock" aria-label="Locked">🔒</span>' : ""}
      </button></li>`;
    }).join("");

    const statsRow = state.baseline
      ? `<div class="rd-stats">
          <div><strong>${state.baseline}</strong><span>starting wpm</span></div>
          <div><strong>${s.bestEffective}</strong><span>best effective</span></div>
          <div><strong>${s.sessions}</strong><span>reads</span></div>
        </div>`
      : "";

    render(`
      <p class="feature-intro">Read faster and still understand. Seven short levels, from basic to advanced. Each one teaches one technique, then checks your understanding.</p>
      ${statsRow}
      <button class="btn btn-primary btn-big" data-level="${state.unlocked}">${state.baseline ? `Continue: Level ${state.unlocked}` : "Start: find your speed"}</button>
      <button class="rd-lesson-card" data-action="eyes" type="button">
        <span class="rd-lesson-eye" aria-hidden="true"><span></span></span>
        <span><small>Lesson · animated</small><strong>How your eyes and brain read together</strong><span>See what your eye really sees, and why prediction makes you fast.</span></span>
      </button>
      <details class="feature-card rd-method">
        <summary><strong>The method: how to read faster</strong></summary>
        <ol class="rd-method-list">${METHOD.map((m) => `<li><strong>${escapeHtml(m.title)}.</strong> ${escapeHtml(m.text)}</li>`).join("")}</ol>
        <p class="settings-note">${escapeHtml(HONEST_NOTE)}</p>
      </details>
      <div class="rd-extras" id="rd-extras">${extensionHtml()}</div>
      <ol class="rd-levels" aria-label="Levels">${levelRows}</ol>
      <p class="settings-note">Every level needs two thirds of the answers right: 2 of 3 on the basic texts, 4 of 5 on the advanced ones. Effective speed = words per minute × share right.</p>
    `);
    bindExtensions();
  }

  // ---------- lesson ----------
  function renderLesson(levelNumber) {
    stopTimers();
    const level = LEVELS[levelNumber - 1];
    const target = targetFor(state, level.n);
    const pace = level.drill === "scan" ? `${SCAN_SECONDS} seconds per fact` : level.drill === "rsvp" ? `${target} words per minute on average` : target ? `${target} words per minute` : "Your own pace";
    const passage = pickPassage(state, passagesFor(level, window.SpellReadingPassages));
    // Options appear in a fresh order each read, so the right answer is never "usually B".
    const order = passage.questions.map((q) => q.options.map((_, i) => i).sort(() => Math.random() - 0.5));
    run = { level, passage, target, order };
    render(`
      <p class="feature-eyebrow">Level ${level.n} · ${level.tier}</p>
      <h3 class="rd-title">${escapeHtml(level.name)}</h3>
      <div class="feature-card">
        <h3>Why it works</h3>
        <p>${escapeHtml(level.why)}</p>
        <h3>How to do it</h3>
        <ol class="rd-steps">${level.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
        <p class="rd-pace"><span>Pace</span> <strong>${escapeHtml(pace)}</strong></p>
        ${level.texts === "advanced" ? '<p class="rd-pace"><span>Text</span> <strong>Advanced: longer and denser</strong></p>' : ""}
      </div>
      <button class="btn btn-primary btn-big" data-action="begin">Start reading</button>
      <button class="btn btn-ghost" data-action="home">Back to levels</button>
    `);
  }

  // ---------- reading drills ----------
  function passageHtml(passage, { wrap = false, preview = false } = {}) {
    let index = 0;
    const paragraphs = passageWords(passage).map((words) => {
      if (!wrap) return `<p>${escapeHtml(words.join(" "))}</p>`;
      return `<p>${words.map((w) => `<span class="rd-w" data-i="${index++}">${escapeHtml(w)}</span>`).join(" ")}</p>`;
    });
    const body = preview
      ? passage.paragraphs.map((p) => {
          const match = p.match(/^.*?[.!?](?=\s|$)/);
          const first = match ? match[0] : p;
          return `<p><mark class="rd-preview">${escapeHtml(first)}</mark> <span class="rd-dim">${escapeHtml(p.slice(first.length))}</span></p>`;
        }).join("")
      : paragraphs.join("");
    return `<article class="rd-passage"><h3>${escapeHtml(passage.title)}</h3>${body}</article>`;
  }

  function begin() {
    const { level } = run;
    run.words = countWords(run.passage.paragraphs.join(" "));
    if (level.drill === "timed") return startTimed();
    if (level.drill === "pacer") return startPaced(level.chunk, "inline");
    if (level.drill === "rsvp") return startPaced(level.chunk, "flash");
    if (level.drill === "preview") return startPreview();
    if (level.drill === "scan") return startScan(0, []);
  }

  // Self-paced: time from showing the text to pressing Done, not counting time the app was hidden.
  function startTimed() {
    render(`${passageHtml(run.passage)}
      <div class="rd-dock"><button class="btn btn-primary btn-big" data-action="done">Done reading</button></div>`);
    run.startedAt = performance.now();
    run.hiddenMs = 0;
  }

  function startPreview() {
    render(`<p class="feature-eyebrow">Preview · <span id="rd-countdown">${PREVIEW_SECONDS}</span>s</p>
      ${passageHtml(run.passage, { preview: true })}
      <div class="rd-dock"><button class="btn btn-primary btn-big" data-action="after-preview">I'm ready, start reading</button></div>`);
    const ends = performance.now() + PREVIEW_SECONDS * 1000;
    run.timer = setInterval(() => {
      if (!isOpen()) return stopTimers();
      const left = Math.max(0, Math.ceil((ends - performance.now()) / 1000));
      const label = document.getElementById("rd-countdown");
      if (label) label.textContent = left;
      if (left === 0) { stopTimers(); startPaced(run.level.chunk, "inline"); }
    }, 200);
  }

  // A highlight moves through the text (inline) or phrases flash in one box (flash). Timing comes from
  // the clock, not from counting ticks, so a slow phone never drifts off pace.
  function startPaced(chunkSize, style) {
    stopTimers();
    const paragraphs = passageWords(run.passage);
    const chunks = style === "flash"
      ? paragraphs.flat().map((word) => ({ words: [word], weight: flashWeight(word) }))
      : paragraphs.flatMap((words) => makeChunks(words, chunkSize));
    // In the sprint, the extra time long words and sentence ends get is taken from the other words,
    // so the average pace is still the target.
    const scale = style === "flash" ? chunks.length / chunks.reduce((sum, c) => sum + c.weight, 0) : 1;
    const msPerWord = 60000 / run.target;
    let at = 0, wordIndex = 0;
    const timeline = chunks.map((c) => {
      const entry = { start: at, first: wordIndex, words: c.words };
      at += c.weight * msPerWord * scale;
      wordIndex += c.words.length;
      return entry;
    });
    const total = at;

    if (style === "inline") {
      render(`<p class="feature-eyebrow">${run.target} words per minute · follow the highlight</p>
        ${passageHtml(run.passage, { wrap: true })}
        <div class="rd-dock"><button class="btn btn-ghost" data-action="pause">Pause</button></div>`);
    } else {
      render(`<p class="feature-eyebrow">${run.target} words per minute · eyes on the orange letter</p>
        <div class="rd-flash" aria-live="off"><div class="rd-orp"><span id="rd-orp-l"></span><span id="rd-orp-c">•</span><span id="rd-orp-r"></span></div></div>
        <div class="rd-progress"><span id="rd-progress-bar"></span></div>
        <div class="rd-dock"><button class="btn btn-ghost" data-action="pause">Pause</button></div>`);
    }
    const spans = style === "inline" ? [...root.querySelectorAll(".rd-w")] : [];
    const lead = style === "flash" ? 800 : 400; // a beat to settle before the first word
    let shown = -1;
    run.paced = { elapsed: -lead, last: performance.now(), paused: false };
    run.startedAt = performance.now() + lead;

    run.timer = setInterval(() => {
      if (!isOpen()) return stopTimers();
      const p = run.paced;
      const now = performance.now();
      if (!p.paused && !document.hidden) p.elapsed += now - p.last;
      else if (document.hidden && !p.paused) setPaused(true);
      p.last = now;
      if (p.elapsed < 0) return;
      if (p.elapsed >= total) {
        stopTimers();
        run.readMs = total;
        setTimeout(() => isOpen() && renderSummary(), 500);
        return;
      }
      let i = shown < 0 ? 0 : shown;
      while (i + 1 < timeline.length && timeline[i + 1].start <= p.elapsed) i++;
      if (i === shown) return;
      shown = i;
      const chunk = timeline[i];
      if (style === "flash") {
        const [before, focus, after] = orpSplit(chunk.words[0]);
        document.getElementById("rd-orp-l").textContent = before;
        document.getElementById("rd-orp-c").textContent = focus;
        document.getElementById("rd-orp-r").textContent = after;
        document.getElementById("rd-progress-bar").style.width = `${(100 * chunk.start) / total}%`;
        return;
      }
      for (let w = 0; w < spans.length; w++) {
        const on = w >= chunk.first && w < chunk.first + chunk.words.length;
        spans[w].classList.toggle("on", on);
        spans[w].classList.toggle("past", w < chunk.first);
      }
      const box = spans[chunk.first].getBoundingClientRect();
      if (box.top < window.innerHeight * 0.25 || box.bottom > window.innerHeight * 0.7) {
        spans[chunk.first].scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }, 30);
  }

  function setPaused(paused) {
    if (!run?.paced) return;
    run.paced.paused = paused;
    const button = root.querySelector('[data-action="pause"]');
    if (button) button.textContent = paused ? "Resume" : "Pause";
  }

  // Scanning: one fact at a time over the whole passage. The learner hunts for the answer and taps it in
  // the text, each against its own clock. Only a tap on one of the answer's words counts.
  function startScan(index, found) {
    stopTimers();
    const scans = run.passage.scans;
    const item = scans[index];
    if (!item) {
      run.found = found;
      return finish();
    }
    render(`<p class="feature-eyebrow">Fact ${index + 1} of ${scans.length} · <span id="rd-countdown">${SCAN_SECONDS}</span>s</p>
      <div class="feature-card rd-scan-q"><strong>${escapeHtml(item.q)}</strong><small>Find the answer and tap it in the text.</small></div>
      ${passageHtml(run.passage, { wrap: true })}`);
    root.querySelector(".rd-passage").classList.add("rd-scan-text");
    const started = performance.now();
    run.scan = { index, found, span: findSpans(run.passage, item.find)[0], started, locked: false };
    run.timer = setInterval(() => {
      if (!isOpen()) return stopTimers();
      const left = Math.max(0, Math.ceil((started + SCAN_SECONDS * 1000 - performance.now()) / 1000));
      const label = document.getElementById("rd-countdown");
      if (label) label.textContent = left;
      if (left === 0) answerScan(null); // out of time counts as not found
    }, 200);
  }

  // Mark the tap, show where the answer was if it was missed, then move on to the next fact.
  function answerScan(tapped) {
    const scan = run?.scan;
    if (!scan || scan.locked) return;
    scan.locked = true;
    stopTimers();
    const hit = tapped !== null && tapped >= scan.span.first && tapped <= scan.span.last;
    const seconds = (performance.now() - scan.started) / 1000;
    const words = root.querySelectorAll(".rd-w");
    for (let i = scan.span.first; i <= scan.span.last; i++) words[i]?.classList.add(hit ? "hit" : "answer");
    if (tapped !== null && !hit) words[tapped]?.classList.add("wrong");
    if (!hit) words[scan.span.first]?.scrollIntoView({ block: "center", behavior: "smooth" });
    const result = { hit, seconds: hit ? seconds : null };
    setTimeout(() => isOpen() && run?.scan === scan && startScan(scan.index + 1, [...scan.found, result]), hit ? 700 : 1600);
  }

  // ---------- questions and result ----------
  // Saying the point in a few words, before seeing any question, is the best single check that the
  // eyes and the brain kept up with each other. Optional: it is a habit to build, not a test.
  function renderSummary() {
    stopTimers();
    render(`<p class="feature-eyebrow">Sum it up · no looking back</p>
      <form class="feature-card" data-form="summary">
        <label class="field-label" for="rd-summary"><strong>In about five words, what was it about?</strong></label>
        <input id="rd-summary" class="text-input" maxlength="80" autocomplete="off" placeholder="e.g. bees dance to share directions" />
        <p class="settings-note">Picture the passage, then say its point. You will compare it with the main idea at the end.</p>
        <button class="btn btn-primary btn-big" type="submit">Continue to questions</button>
        <button class="btn btn-ghost" type="button" data-action="skip-summary">Skip</button>
      </form>`);
    root.querySelector("#rd-summary").focus({ preventScroll: true });
  }

  function renderQuiz() {
    stopTimers();
    const qs = run.passage.questions;
    render(`<p class="feature-eyebrow">Questions · no looking back</p>
      <form class="rd-quiz" data-form="quiz">
        ${qs.map((q, qi) => `<fieldset class="feature-card"><legend><strong>${qi + 1}. ${escapeHtml(q.q)}</strong></legend>
          ${run.order[qi].map((oi) => `<label class="rd-choice"><input type="radio" name="q${qi}" value="${oi}" required> <span>${escapeHtml(q.options[oi])}</span></label>`).join("")}
        </fieldset>`).join("")}
        <button class="btn btn-primary btn-big" type="submit">Check answers</button>
      </form>`);
  }

  function finish() {
    stopTimers();
    const scan = run.level.drill === "scan";
    const qs = run.passage.questions;
    const total = scan ? run.passage.scans.length : qs.length;
    const right = scan ? run.found.filter((f) => f.hit).length : run.answers.filter((a, i) => a === qs[i].answer).length;
    const share = right / total;
    const wpm = scan ? 0 : wordsPerMinute(run.words, run.readMs);
    const before = state;
    const outcome = recordResult(state, run.level.n, { wpm, share }, run.passage.id);
    state = outcome.state;
    save();
    adapter?.onResult?.();
    renderResult({ wpm, share, right, total, outcome, before });
  }

  function renderResult({ wpm, share, right, total, outcome, before }) {
    const { level, passage } = run;
    const answers = run.answers;
    const scan = level.drill === "scan";
    const hits = scan ? run.found.filter((f) => f.hit) : [];
    const avgSeconds = hits.length ? (hits.reduce((sum, f) => sum + f.seconds, 0) / hits.length).toFixed(1) : null;
    const firstBaseline = !before.baseline && state.baseline;
    const message = tooFast({ wpm })
      ? `${wpm} words per minute is faster than anyone can read with understanding, so this counts as skimming. Read every line this time, at a pace where you can follow the story.`
      : outcome.passed
      ? (level.n === LEVELS.length ? "You passed the mastery test. You read well above your starting speed and understood it." : outcome.unlockedNew ? `Passed. Level ${level.n + 1} is open.` : "Passed.")
      : share < PASS_SHARE && scan
        ? "Do not read: hunt. Decide what the answer looks like, then sweep the text for numbers, capitals or the question's key word."
      : share < PASS_SHARE
        ? "Understanding comes first. Try again a little slower, and picture what each paragraph is saying."
        : `Good understanding, but under the ${targetFor(before, level.n)} wpm goal. Preview first and keep your eyes moving forward.`;
    const nextPace = level.boost ? targetFor(state, level.n) : null;
    const review = scan ? passage.scans.map((item, i) => {
      const f = run.found[i];
      return `<li class="${f?.hit ? "ok" : "miss"}"><span>${f?.hit ? "✓" : "✗"}</span> ${escapeHtml(item.q)}${f?.hit ? ` <small>${f.seconds.toFixed(1)}s</small>` : `<br><small>Answer: ${escapeHtml(item.find)}</small>`}</li>`;
    }).join("") : passage.questions.map((q, i) => {
      const ok = answers[i] === q.answer;
      return `<li class="${ok ? "ok" : "miss"}"><span>${ok ? "✓" : "✗"}</span> ${escapeHtml(q.q)}${ok ? "" : `<br><small>Answer: ${escapeHtml(q.options[q.answer])}</small>`}</li>`;
    }).join("");
    const canNext = outcome.passed && level.n < LEVELS.length && level.n + 1 <= state.unlocked;
    const gist = passage.questions.find((q) => q.kind === "gist") || passage.questions[0];

    render(`<p class="feature-eyebrow">Level ${level.n} · ${escapeHtml(level.name)}</p>
      <div class="rd-stats rd-result">
        ${wpm ? `<div><strong>${wpm}</strong><span>words / min</span></div>` : ""}
        <div><strong>${right}/${total}</strong><span>${scan ? "found" : "understood"}</span></div>
        ${scan ? `<div><strong>${avgSeconds ? `${avgSeconds}s` : "–"}</strong><span>per fact found</span></div>` : ""}
        ${wpm ? `<div><strong>${effectiveWpm(wpm, share)}</strong><span>effective</span></div>` : ""}
      </div>
      <p class="rd-message ${outcome.passed ? "pass" : "fail"}" role="status">${escapeHtml(message)}</p>
      ${firstBaseline ? `<p class="settings-note">Your starting speed is ${state.baseline} words per minute. Paced levels start from here.</p>` : ""}
      ${nextPace && nextPace !== targetFor(before, level.n) ? `<p class="settings-note">Next pace for this level: ${nextPace} wpm.</p>` : ""}
      ${run.summary ? `<div class="feature-card rd-summary-check"><p><span>Your summary</span> “${escapeHtml(run.summary)}”</p><p><span>Main idea</span> ${escapeHtml(gist.options[gist.answer])}</p><p class="settings-note">Did you catch the same point? If not, preview next time and ask yourself a question before reading.</p></div>` : ""}
      <ul class="rd-review">${review}</ul>
      ${canNext ? `<button class="btn btn-primary btn-big" data-level="${level.n + 1}">Next: ${escapeHtml(LEVELS[level.n].name)}</button>` : ""}
      <button class="btn ${canNext ? "btn-ghost" : "btn-primary btn-big"}" data-level="${level.n}">Try again with a new passage</button>
      <button class="btn btn-ghost" data-action="home">Back to levels</button>`);
  }

  // ---------- wiring ----------
  function onClick(event) {
    const word = event.target.closest(".rd-w");
    if (word && run?.scan && !run.scan.locked) return answerScan(Number(word.dataset.i));
    const target = event.target.closest("[data-level], [data-action]");
    if (!target || target.disabled) return;
    // A level opened from the lesson may still be locked: open the furthest one reached instead.
    if (target.dataset.level) return renderLesson(Math.min(Number(target.dataset.level), state.unlocked));
    const action = target.dataset.action;
    if (action === "home") return renderHome();
    if (action === "eyes") { stopTimers(); run = null; root.innerHTML = ""; window.scrollTo?.(0, 0); return window.SpellReadingLesson?.render(root); }
    if (action === "skip-summary") { run.summary = ""; return renderQuiz(); }
    if (action === "begin") return begin();
    if (action === "after-preview") { stopTimers(); return startPaced(run.level.chunk, "inline"); }
    if (action === "pause") return setPaused(!run.paced.paused);
    if (action === "done") {
      run.readMs = performance.now() - run.startedAt - run.hiddenMs;
      return renderSummary();
    }
  }

  function onSubmit(event) {
    if (event.target.dataset.form === "summary") {
      event.preventDefault();
      run.summary = event.target.querySelector("#rd-summary").value.trim();
      return renderQuiz();
    }
    if (event.target.dataset.form !== "quiz") return;
    event.preventDefault();
    const data = new FormData(event.target);
    run.answers = run.passage.questions.map((_, i) => Number(data.get(`q${i}`)));
    finish();
  }

  // Time spent in another app does not count as reading time.
  function onVisibility() {
    if (!run || run.level?.drill !== "timed" || run.readMs !== undefined || run.startedAt === undefined) return;
    if (document.hidden) run.hiddenAt = performance.now();
    else if (run.hiddenAt) { run.hiddenMs += performance.now() - run.hiddenAt; run.hiddenAt = null; }
  }

  function open() {
    adapter.show("reading");
    state = load();
    renderHome();
  }

  function init(options) {
    adapter = options;
    root = document.getElementById("reading-view");
    if (!root) return;
    state = load();
    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    document.addEventListener("visibilitychange", onVisibility);
    for (const button of document.querySelectorAll("[data-open-reading]")) button.addEventListener("click", open);
  }

  window.SpellReading = { init, open, register: (ext) => { extensions.push(ext); }, ...api };
})();
