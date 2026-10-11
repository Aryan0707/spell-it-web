// Read your own text: the learner pastes an article or a page from a school book and reads it in the
// reading trainer, either at their own pace (timed) or with the highlight pacer. It is practice, not
// progress: a custom read never touches level progress, the baseline, unlocks or the built-in passage
// counts. It keeps its own short history (last 20 reads) under spellit_reading_custom.
// Questions: with the AI on, the model writes three (gist, fact, inference) and a strict validator checks
// them; otherwise, or if that fails twice, the learner does a self-check and rates how well they followed.
// The rules above the DOM line are pure and exported in Node for tests.
(() => {
  "use strict";

  const STORAGE_KEY = "spellit_reading_custom";
  const MIN_WORDS = 150;
  const MAX_WORDS = 3000;
  const MIN_PACE = 100;
  const MAX_PACE = 800;
  const PACE_STEP = 10;
  const PACE_BOOST = 1.15;      // default pacer speed: your starting speed times this
  const DEFAULT_PACE = 200;     // when no starting speed is known yet
  const MAX_HISTORY = 20;
  const MAX_SKIM_WPM = 1000;    // faster than this is skimming, not reading
  const LONG_PARAGRAPH = 140;   // a block longer than this is split so the highlight and the recap have landmarks
  const SPLIT_TARGET = 80;
  const KINDS = ["gist", "fact", "inference"];

  const countWords = (text) => String(text || "").split(/\s+/).filter(Boolean).length;
  const fmt = (n) => Number(n).toLocaleString("en-US");

  // ---------- clean-up ----------
  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

  function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body) => {
      if (body[0] === "#") {
        const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
        return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " ";
      }
      return ENTITIES[body.toLowerCase()] ?? whole;
    });
  }

  // Turn whatever was pasted into plain paragraphs separated by one blank line. Removes HTML tags,
  // markdown marks, links, footnote numbers and lines with no letters (page numbers, rules); joins lines
  // that were wrapped by a PDF or a web page; mends a word split by a line-end hyphen.
  function cleanText(raw) {
    let t = String(raw ?? "").replace(/\r\n?/g, "\n");
    t = t.replace(/[\t   ]/g, " ").replace(/[​-‍⁠﻿­]/g, "");
    t = t.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
    t = t.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article|ul|ol|table)\s*>/gi, "\n\n");
    t = t.replace(/<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi, "");
    t = decodeEntities(t);
    t = t.replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2");
    const paragraphs = [];
    let lines = [];
    const flush = () => { if (lines.length) paragraphs.push(lines.join(" ")); lines = []; };
    for (let line of t.split("\n")) {
      line = line.trim();
      if (/^(```|~~~)/.test(line)) { flush(); continue; }
      if (!line) { flush(); continue; }
      if (/^([-*_=]\s*){3,}$/.test(line)) { flush(); continue; }
      line = line.replace(/^#{1,6}\s+/, "").replace(/^(>\s?)+/, "").replace(/^[-*+•]\s+/, "");
      line = line.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
      line = line.replace(/https?:\/\/\S+/gi, " ").replace(/\[\d{1,3}\]/g, "");
      line = line.replace(/(\*\*|__)(.+?)\1/g, "$2").replace(/\*([^*\s][^*]*)\*/g, "$1").replace(/(^|\s)_([^_\s][^_]*)_(?=\s|[.,;:!?)]|$)/g, "$1$2").replace(/`([^`]*)`/g, "$1");
      line = line.replace(/\s+/g, " ").trim();
      if (!/\p{L}/u.test(line)) { flush(); continue; }
      lines.push(line);
    }
    flush();
    return paragraphs.join("\n\n");
  }

  // Split into paragraphs. A very long block (copied from a page with no breaks) is cut at sentence ends
  // into pieces of about SPLIT_TARGET words, so the pacer has places to scroll and the recap has landmarks.
  function splitParagraphs(text) {
    const out = [];
    for (const block of String(text || "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)) {
      if (countWords(block) <= LONG_PARAGRAPH) { out.push(block); continue; }
      const sentences = block.match(/[^.!?]+(?:[.!?]+["”')]*|$)\s*/g) || [block];
      let piece = [];
      let n = 0;
      for (const s of sentences) {
        piece.push(s.trim());
        n += countWords(s);
        if (n >= SPLIT_TARGET) { out.push(piece.join(" ")); piece = []; n = 0; }
      }
      if (piece.length) {
        if (n < SPLIT_TARGET / 2 && out.length) out[out.length - 1] += " " + piece.join(" ");
        else out.push(piece.join(" "));
      }
    }
    return out.filter(Boolean);
  }

  // Clean, count and check the limits. `message` is ready to show under the text box.
  function validateText(raw) {
    const text = cleanText(raw);
    const words = countWords(text);
    if (!words) return { ok: false, reason: "empty", words, text, message: "Paste some text first." };
    if (words < MIN_WORDS) return { ok: false, reason: "short", words, text, message: `That is ${fmt(words)} words. Paste at least ${MIN_WORDS}, so there is enough to measure your speed.` };
    if (words > MAX_WORDS) return { ok: false, reason: "long", words, text, message: `That is ${fmt(words)} words. The limit is ${fmt(MAX_WORDS)}: paste a shorter part.` };
    return { ok: true, words, text, paragraphs: splitParagraphs(text) };
  }

  function titleFor(text, given) {
    const own = String(given || "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (own) return own;
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const head = words.slice(0, 6).join(" ").replace(/[\s,;:.\-–—]+$/, "");
    return head ? head + (words.length > 6 ? "…" : "") : "Your text";
  }

  // The synthetic passage the drills use: the same shape as the built-in ones.
  function buildPassage(text, title, questions) {
    return { id: "custom", title: titleFor(text, title), paragraphs: splitParagraphs(text), questions: questions || [] };
  }

  // ---------- pace ----------
  const clampPace = (wpm) => Math.round(Math.min(MAX_PACE, Math.max(MIN_PACE, Number(wpm) || DEFAULT_PACE)));
  const defaultPace = (baseline) => (Number.isFinite(baseline) && baseline > 0 ? clampPace(baseline * PACE_BOOST) : DEFAULT_PACE);
  const stepPace = (wpm, direction) => clampPace(clampPace(wpm) + (direction < 0 ? -PACE_STEP : PACE_STEP));

  // ---------- AI questions ----------
  function questionMessages(text, strict) {
    return [
      { role: "system", content: "You write reading comprehension questions. Reply with JSON only: no prose, no code fences." },
      { role: "user", content:
        `Write exactly 3 multiple-choice questions about the text between the markers, for a reader who has just read it once.\n` +
        `1. kind "gist": the main idea.\n2. kind "fact": one detail the text states directly.\n3. kind "inference": something the reader must work out from the text.\n` +
        `Each question has exactly 4 short, distinct options and exactly one correct one. Never use "all of the above" or "none of the above". Use only what the text says.\n` +
        `Format: {"questions":[{"kind":"gist","q":"...","options":["...","...","...","..."],"answer":0}, ...]} where answer is the index (0 to 3) of the correct option.\n` +
        (strict ? "Your last reply could not be used. Reply with the JSON object only.\n" : "") +
        `\n=== TEXT ===\n${text}\n=== END ===` },
    ];
  }

  function parseLoose(raw) {
    const s = String(raw ?? "").replace(/```(?:json)?/gi, "");
    const open = s.search(/[{[]/);
    if (open < 0) return null;
    const close = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (close <= open) return null;
    try { return JSON.parse(s.slice(open, close + 1)); } catch { return null; }
  }

  const tidy = (value, max) => {
    if (typeof value !== "string") return null;
    const s = value.replace(/\s+/g, " ").trim();
    return s && s.length <= max ? s : null;
  };

  // Strict check of the model's reply, which is untrusted. Returns three questions in the built-in
  // shape ({ kind, q, options, answer }), options shuffled so the answer is not where the model put it,
  // or null if anything is off: not three, a kind missing or repeated, not four distinct options, a
  // "none of the above", an answer outside 0 to 3.
  function validateQuestions(raw, random = Math.random) {
    let data = typeof raw === "string" ? parseLoose(raw) : raw;
    if (data && !Array.isArray(data) && Array.isArray(data.questions)) data = data.questions;
    if (!Array.isArray(data) || data.length !== 3) return null;
    const byKind = {};
    for (const item of data) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const kind = typeof item.kind === "string" ? item.kind.trim().toLowerCase() : "";
      if (!KINDS.includes(kind) || byKind[kind]) return null;
      const q = tidy(item.q ?? item.question, 220);
      if (!q || q.length < 8) return null;
      if (!Array.isArray(item.options) || item.options.length !== 4) return null;
      const options = item.options.map((o) => tidy(o, 160));
      if (options.some((o) => !o || /\b(all|none) of the above\b|\bboth [a-d] and [a-d]\b/i.test(o))) return null;
      if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return null;
      if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3) return null;
      const order = [0, 1, 2, 3].sort(() => random() - 0.5);
      byKind[kind] = { kind, q, options: order.map((i) => options[i]), answer: order.indexOf(item.answer) };
    }
    return KINDS.map((k) => byKind[k]);
  }

  // Ask the model through `chat(messages) => Promise<string>`; one retry. Resolves to the questions, or
  // null if the model failed or answered badly twice. It never throws: the caller falls back to a self-check.
  async function generateQuestions(text, chat, { attempts = 2, random = Math.random } = {}) {
    for (let i = 0; i < attempts; i++) {
      try {
        const questions = validateQuestions(await chat(questionMessages(text, i > 0)), random);
        if (questions) return questions;
      } catch { /* try again, then fall back */ }
    }
    return null;
  }

  // ---------- self-check and history ----------
  const RATINGS = [
    { n: 1, label: "Lost" }, { n: 2, label: "Barely" }, { n: 3, label: "Mostly" }, { n: 4, label: "Well" }, { n: 5, label: "Completely" },
  ];
  const ratingShare = (rating) => (Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating / 5 : null);

  // The first sentence of each paragraph, for the recap. Capped so a long text does not make a long list.
  function firstSentences(paragraphs, max = 10) {
    return paragraphs.slice(0, max).map((p) => (p.match(/^.*?[.!?](?=\s|$)/) || [p])[0].trim());
  }

  const shareOf = (entry) => (Number.isFinite(entry.share) ? entry.share : ratingShare(entry.rating));

  function sanitizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((e) => e && typeof e === "object" && typeof e.title === "string" && Number.isFinite(e.words) && Number.isFinite(e.at)).map((e) => ({
      title: e.title.slice(0, 60),
      words: Math.max(0, Math.round(e.words)),
      wpm: Number.isFinite(e.wpm) && e.wpm > 0 ? Math.round(e.wpm) : 0,
      share: Number.isFinite(e.share) ? Math.min(1, Math.max(0, e.share)) : null,
      rating: Number.isInteger(e.rating) && e.rating >= 1 && e.rating <= 5 ? e.rating : null,
      mode: e.mode === "pacer" ? "pacer" : "own",
      at: Math.round(e.at),
    })).slice(-MAX_HISTORY);
  }

  const addHistory = (history, entry) => sanitizeHistory([...history, entry]);

  function outcomeLabel(entry) {
    if (Number.isFinite(entry.share)) return `${Math.round(entry.share * 3)} of 3 right`;
    if (entry.rating) return `followed ${entry.rating} of 5`;
    return "no check";
  }

  const api = { MIN_WORDS, MAX_WORDS, MIN_PACE, MAX_PACE, PACE_STEP, MAX_HISTORY, cleanText, splitParagraphs, validateText, titleFor, buildPassage,
    clampPace, defaultPace, stepPace, questionMessages, validateQuestions, generateQuestions, ratingShare, RATINGS, firstSentences, shareOf,
    sanitizeHistory, addHistory, outcomeLabel };

  if (typeof window === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    return;
  }

  // ---------- DOM ----------
  const R = () => window.SpellReading;
  let root = null;
  let host = null;       // the trainer's api object from the latest render
  let wired = false;
  let draft = { text: "", title: "", mode: "own", pace: null };
  let session = null;    // the read in progress
  let timer = null;

  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function loadHistory() {
    try { return sanitizeHistory(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return []; }
  }
  function saveEntry(entry) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(addHistory(loadHistory(), entry))); } catch { /* storage blocked: the history just is not kept */ }
  }

  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const isOpen = () => root && root.closest(".screen")?.classList.contains("active");
  // True while one of this file's reading screens is showing (they all carry .rc-live).
  const alive = () => isOpen() && root.querySelector(".rc-live");

  function show(html) {
    stop();
    window.SpellReadingLesson?.stop?.();
    root.innerHTML = html;
    root.scrollTop = 0;
    window.scrollTo?.(0, 0);
  }

  // ---------- front-page card ----------
  function homeHtml() {
    const history = loadHistory().slice().reverse();
    const rows = history.map((e) => `<li><strong>${esc(e.title)}</strong><span>${fmt(e.words)} words${e.wpm ? ` · ${e.wpm} wpm` : ""} · ${esc(outcomeLabel(e))} · ${esc(new Date(e.at).toLocaleDateString())}</span></li>`);
    return `<section class="feature-card rc-card" aria-labelledby="rc-card-title">
      <small class="rc-kicker">Practice · not scored</small>
      <h3 id="rc-card-title">Read your own text</h3>
      <p>Paste an article or a page from a school book and read it here, at your own pace or with the pacer. It does not change your levels.</p>
      <button class="btn btn-primary" type="button" data-rc-act="open">Read your own text</button>
      ${rows.length ? `<details class="rc-history"><summary>Your last ${rows.length} ${rows.length === 1 ? "read" : "reads"}</summary><ul>${rows.join("")}</ul></details>` : ""}
    </section>`;
  }

  // ---------- setup ----------
  function paceControl() {
    const baseline = host?.state?.().baseline;
    const pace = draft.pace || defaultPace(baseline);
    return `<div class="rc-pace" id="rc-pace" ${draft.mode === "pacer" ? "" : "hidden"}>
      <span class="rc-pace-label" id="rc-pace-label">Pace</span>
      <button type="button" class="btn btn-ghost rc-step" data-rc-act="slower" aria-label="10 words per minute slower">−</button>
      <output class="rc-pace-value" id="rc-pace-value" aria-labelledby="rc-pace-label"><strong>${pace}</strong> wpm</output>
      <button type="button" class="btn btn-ghost rc-step" data-rc-act="faster" aria-label="10 words per minute faster">+</button>
      <p class="settings-note">${baseline ? `Starts at your starting speed (${baseline} wpm) × ${PACE_BOOST}.` : `Your starting speed is not measured yet, so this starts at ${DEFAULT_PACE} wpm.`} Steps of ${PACE_STEP}, from ${MIN_PACE} to ${MAX_PACE}.</p>
    </div>`;
  }

  function showSetup() {
    const ai = window.SpellAI?.isEnabled?.();
    draft.pace = draft.pace || defaultPace(host?.state?.().baseline);
    show(`<p class="feature-eyebrow">Your own text</p>
      <h3 class="rd-title">Read your own text</h3>
      <form class="feature-card rc-form" data-rc-form="setup" novalidate>
        <label class="field-label" for="rc-text"><strong>Paste the text</strong></label>
        <textarea id="rc-text" class="text-input rc-text" rows="9" aria-describedby="rc-count rc-error" placeholder="Paste an article or a page from a book. ${MIN_WORDS} to ${fmt(MAX_WORDS)} words.">${esc(draft.text)}</textarea>
        <p class="rc-count" id="rc-count" aria-live="polite"></p>
        <label class="field-label" for="rc-title">Title (optional)</label>
        <input id="rc-title" class="text-input" maxlength="60" autocomplete="off" placeholder="Taken from the first words if you leave it empty" value="${esc(draft.title)}" />
        <fieldset class="rc-modes">
          <legend>How do you want to read it?</legend>
          <label class="rd-choice"><input type="radio" name="rc-mode" value="own" ${draft.mode === "own" ? "checked" : ""}> <span><strong>Own pace.</strong> You read, we time you. Press Done at the end.</span></label>
          <label class="rd-choice"><input type="radio" name="rc-mode" value="pacer" ${draft.mode === "pacer" ? "checked" : ""}> <span><strong>Pacer.</strong> A highlight moves through the text at a speed you choose.</span></label>
        </fieldset>
        ${paceControl()}
        <p class="settings-note">${ai ? "Your AI model will write three questions from this text, so the text is sent to it." : "AI is off, so after reading you do a quick self-check. Turn AI on in Settings for questions."}</p>
        <p class="rc-error" id="rc-error" role="alert"></p>
        <button class="btn btn-primary btn-big" type="submit">Start reading</button>
        <button class="btn btn-ghost" type="button" data-rc-act="home">Back to levels</button>
      </form>`);
    updateCount();
  }

  function updateCount() {
    const box = root.querySelector("#rc-text");
    const label = root.querySelector("#rc-count");
    if (!box || !label) return;
    const words = countWords(cleanText(box.value));
    label.textContent = words ? `${fmt(words)} ${words === 1 ? "word" : "words"} · need ${MIN_WORDS} to ${fmt(MAX_WORDS)}` : `Need ${MIN_WORDS} to ${fmt(MAX_WORDS)} words`;
    label.classList.toggle("bad", words > 0 && (words < MIN_WORDS || words > MAX_WORDS));
  }

  function readDraft() {
    draft.text = root.querySelector("#rc-text")?.value ?? draft.text;
    draft.title = root.querySelector("#rc-title")?.value ?? draft.title;
    draft.mode = root.querySelector('input[name="rc-mode"]:checked')?.value || draft.mode;
  }

  function submitSetup() {
    readDraft();
    const check = validateText(draft.text);
    const error = root.querySelector("#rc-error");
    if (!check.ok) {
      error.textContent = check.message;
      root.querySelector("#rc-text").focus();
      return;
    }
    error.textContent = "";
    const passage = buildPassage(check.text, draft.title);
    session = { passage, mode: draft.mode, target: draft.mode === "pacer" ? clampPace(draft.pace) : null, words: check.words, questions: null, pending: null };
    // Start the questions while the learner reads, so there is no wait afterwards.
    if (window.SpellAI?.isEnabled?.()) {
      const mine = session;
      mine.pending = generateQuestions(check.text, (messages) => window.SpellAI.chat(messages)).then((q) => { mine.questions = q; return q; });
    }
    session.mode === "pacer" ? startPaced() : startTimed();
  }

  // ---------- drills ----------
  function passageHtml({ wrap = false } = {}) {
    let index = 0;
    const body = session.passage.paragraphs.map((p) => {
      const words = p.split(/\s+/).filter(Boolean);
      return wrap ? `<p>${words.map((w) => `<span class="rd-w" data-i="${index++}">${esc(w)}</span>`).join(" ")}</p>` : `<p>${esc(words.join(" "))}</p>`;
    }).join("");
    return `<article class="rd-passage rc-live"><h3>${esc(session.passage.title)}</h3>${body}</article>`;
  }

  function startTimed() {
    show(`${passageHtml()}<div class="rd-dock"><button class="btn btn-primary btn-big" data-rc-act="done">Done reading</button></div>`);
    session.startedAt = performance.now();
    session.hiddenMs = 0;
    session.hiddenAt = null;
  }

  // The same highlight as level 2 (one word at a time), timed from the clock so a slow phone does not drift.
  function startPaced() {
    const paragraphs = session.passage.paragraphs.map((p) => p.split(/\s+/).filter(Boolean));
    const chunks = paragraphs.flatMap((words) => R().makeChunks(words, 1));
    const msPerWord = 60000 / session.target;
    let at = 0, wordIndex = 0;
    const timeline = chunks.map((c) => {
      const entry = { start: at, first: wordIndex, words: c.words };
      at += c.weight * msPerWord;
      wordIndex += c.words.length;
      return entry;
    });
    const total = at;
    show(`<p class="feature-eyebrow">${session.target} words per minute · follow the highlight</p>${passageHtml({ wrap: true })}
      <div class="rd-dock"><button class="btn btn-ghost" data-rc-act="pause">Pause</button></div>`);
    const spans = [...root.querySelectorAll(".rd-w")];
    const lead = 400;
    let shown = -1;
    const mine = session;
    const p = mine.paced = { elapsed: -lead, last: performance.now(), paused: false };
    timer = setInterval(() => {
      if (!alive() || session !== mine) return stop();
      const now = performance.now();
      if (!p.paused && !document.hidden) p.elapsed += now - p.last;
      else if (document.hidden && !p.paused) setPaused(true);
      p.last = now;
      if (p.elapsed < 0) return;
      if (p.elapsed >= total) {
        stop();
        mine.readMs = total;
        setTimeout(() => session === mine && alive() && showQuestions(), 500);
        return;
      }
      let i = shown < 0 ? 0 : shown;
      while (i + 1 < timeline.length && timeline[i + 1].start <= p.elapsed) i++;
      if (i === shown) return;
      shown = i;
      const chunk = timeline[i];
      for (let w = 0; w < spans.length; w++) {
        spans[w].classList.toggle("on", w >= chunk.first && w < chunk.first + chunk.words.length);
        spans[w].classList.toggle("past", w < chunk.first);
      }
      const box = spans[chunk.first].getBoundingClientRect();
      if (box.top < window.innerHeight * 0.25 || box.bottom > window.innerHeight * 0.7) spans[chunk.first].scrollIntoView({ block: "center", behavior: "smooth" });
    }, 30);
  }

  function setPaused(paused) {
    if (!session?.paced) return;
    session.paced.paused = paused;
    const button = root.querySelector('[data-rc-act="pause"]');
    if (button) button.textContent = paused ? "Resume" : "Pause";
  }

  // Time spent in another app does not count as reading time.
  function onVisibility() {
    if (!session || session.mode !== "own" || session.startedAt === undefined || session.readMs !== undefined) return;
    if (document.hidden) session.hiddenAt = performance.now();
    else if (session.hiddenAt) { session.hiddenMs += performance.now() - session.hiddenAt; session.hiddenAt = null; }
  }

  // ---------- questions or self-check ----------
  async function showQuestions() {
    stop();
    const mine = session;
    if (mine.pending && !mine.questions) {
      show(`<p class="feature-eyebrow rc-live">Questions</p><p class="settings-note" role="status">Writing your questions…</p>`);
      await mine.pending;
      if (session !== mine || !alive()) return;
    }
    if (mine.questions) return showQuiz();
    showSelfCheck(Boolean(mine.pending));
  }

  function showQuiz() {
    show(`<p class="feature-eyebrow rc-live">Questions · no looking back</p>
      <form class="rd-quiz" data-rc-form="quiz">
        ${session.questions.map((q, qi) => `<fieldset class="feature-card"><legend><strong>${qi + 1}. ${esc(q.q)}</strong></legend>
          ${q.options.map((o, oi) => `<label class="rd-choice"><input type="radio" name="q${qi}" value="${oi}" required> <span>${esc(o)}</span></label>`).join("")}
        </fieldset>`).join("")}
        <button class="btn btn-primary btn-big" type="submit">Check answers</button>
      </form>`);
  }

  function showSelfCheck(failed) {
    const firsts = firstSentences(session.passage.paragraphs);
    const more = session.passage.paragraphs.length - firsts.length;
    show(`<p class="feature-eyebrow rc-live">Self-check · no looking back</p>
      ${failed ? '<p class="settings-note" role="status">The AI could not write questions this time, so here is a self-check.</p>' : ""}
      <div class="feature-card">
        <h3>1. Say the main point in five words</h3>
        <input id="rc-point" class="text-input" maxlength="80" autocomplete="off" placeholder="Say it, or type it" />
        <h3 class="rc-gap">2. Check yourself</h3>
        <button class="btn btn-ghost" type="button" data-rc-act="reveal" aria-expanded="false">Reveal the first sentence of each paragraph</button>
        <ol class="rc-firsts" id="rc-firsts" hidden>${firsts.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
        ${more > 0 ? `<p class="settings-note rc-more" hidden>and ${more} more ${more === 1 ? "paragraph" : "paragraphs"}.</p>` : ""}
        <h3 class="rc-gap" id="rc-rate-h">3. How well did you follow it?</h3>
        <div class="rc-rate" role="group" aria-labelledby="rc-rate-h">
          ${RATINGS.map((r) => `<button type="button" class="btn btn-ghost" data-rc-rate="${r.n}"><strong>${r.n}</strong><span>${r.label}</span></button>`).join("")}
        </div>
      </div>`);
  }

  // ---------- result ----------
  function clock(ms) {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // Shows the result and saves it to the custom history only. It never calls recordResult, so level
  // progress, the baseline, unlocks and the built-in read counts stay exactly as they were.
  function finishRead({ answers, rating }) {
    const ms = session.readMs ?? 0;
    const wpm = R().wordsPerMinute(session.words, ms);
    const skimmed = wpm > MAX_SKIM_WPM;
    let right = null, share;
    if (answers) {
      right = answers.filter((a, i) => a === session.questions[i].answer).length;
      share = right / session.questions.length;
    } else {
      share = ratingShare(rating);
    }
    // A skim is shown but not kept: it says nothing true about reading speed.
    if (!skimmed) {
      saveEntry({ title: session.passage.title, words: session.words, wpm, share: answers ? share : null, rating: answers ? null : rating, mode: session.mode, at: Date.now() });
    }
    const effective = R().effectiveWpm(wpm, share);
    const weak = share < 2 / 3;
    const message = skimmed
      ? `${fmt(wpm)} words per minute is faster than anyone can read with understanding, so this counts as skimming and is not saved. Read every line next time.`
      : weak ? "Understanding comes first. Try a slower pace, or read in smaller steps and picture each paragraph."
      : `Good: you understood it at ${wpm} words per minute.`;
    const review = answers ? session.questions.map((q, i) => {
      const ok = answers[i] === q.answer;
      return `<li class="${ok ? "ok" : "miss"}"><span>${ok ? "✓" : "✗"}</span> ${esc(q.q)}${ok ? "" : `<br><small>Answer: ${esc(q.options[q.answer])}</small>`}</li>`;
    }).join("") : "";
    show(`<p class="feature-eyebrow rc-live">Your own text · ${esc(session.passage.title)}</p>
      <div class="rd-stats rd-result">
        <div><strong>${wpm}</strong><span>words / min</span></div>
        <div><strong>${answers ? `${right}/${session.questions.length}` : `${rating}/5`}</strong><span>${answers ? "understood" : "you followed"}</span></div>
        ${skimmed ? "" : `<div><strong>${effective}</strong><span>${answers ? "effective" : "effective, self-rated"}</span></div>`}
      </div>
      <p class="settings-note">${fmt(session.words)} words in ${clock(ms)}${session.mode === "pacer" ? `, paced at ${session.target} wpm` : ", at your own pace"}. This read is not part of your level progress.</p>
      <p class="rd-message ${skimmed || weak ? "fail" : "pass"}" role="status">${esc(message)}</p>
      ${review ? `<ul class="rd-review">${review}</ul>` : ""}
      <button class="btn btn-primary btn-big" data-rc-act="open">Read another text</button>
      <button class="btn btn-ghost" data-rc-act="home">Back to levels</button>`);
    session = null;
  }

  // ---------- wiring ----------
  function onClick(event) {
    const rate = event.target.closest("[data-rc-rate]");
    if (rate && session) return finishRead({ rating: Number(rate.dataset.rcRate) });
    const target = event.target.closest("[data-rc-act]");
    if (!target) return;
    const act = target.dataset.rcAct;
    if (act === "open") { draft = { text: "", title: "", mode: draft.mode, pace: draft.pace }; return showSetup(); }
    if (act === "home") { stop(); session = null; return host.home(); }
    if (act === "slower" || act === "faster") {
      draft.pace = stepPace(draft.pace || defaultPace(host?.state?.().baseline), act === "slower" ? -1 : 1);
      root.querySelector("#rc-pace-value").innerHTML = `<strong>${draft.pace}</strong> wpm`;
      return;
    }
    if (act === "done" && session) { session.readMs = performance.now() - session.startedAt - session.hiddenMs; return showQuestions(); }
    if (act === "pause" && session?.paced) return setPaused(!session.paced.paused);
    if (act === "reveal") {
      root.querySelector("#rc-firsts").hidden = false;
      root.querySelector(".rc-more")?.removeAttribute("hidden");
      target.hidden = true;
    }
  }

  function onSubmit(event) {
    const kind = event.target.dataset?.rcForm;
    if (!kind) return;
    event.preventDefault();
    if (kind === "setup") return submitSetup();
    if (kind === "quiz" && session?.questions) {
      const data = new FormData(event.target);
      finishRead({ answers: session.questions.map((_, i) => Number(data.get(`q${i}`))) });
    }
  }

  function onInput(event) {
    if (event.target.id === "rc-text") updateCount();
  }

  function onChange(event) {
    if (event.target.name !== "rc-mode") return;
    draft.mode = event.target.value;
    root.querySelector("#rc-pace").hidden = draft.mode !== "pacer";
  }

  function wire() {
    if (wired) return;
    wired = true;
    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    document.addEventListener("visibilitychange", onVisibility);
  }

  window.SpellReadingCustom = api;
  window.SpellReading?.register({
    id: "custom",
    home(h) { host = h; return homeHtml(); },
    bind(r, h) { root = r; host = h; wire(); },
  });
})();
