// AI-made passages for the reading trainer, so the learner never runs out of fresh texts.
// The model's output is untrusted: validatePassage() checks every part of it and a passage that fails is
// never stored. The rules below the DOM line are pure and exported in Node for tests; the model call is
// passed in, so tests can mock it.
// Passages live in this browser only (localStorage), newest 30, and join the level pools through
// SpellReadingPassages.generatedFor(tier), which passagesFor in reading.js reads.
(() => {
  "use strict";

  const STORAGE_KEY = "spellit_reading_generated";
  const MAX_STORED = 30;
  const KINDS = {
    basic: ["gist", "fact", "inference"],
    advanced: ["gist", "fact", "fact", "inference", "inference"],
  };
  // Asked for 170-190 and 240-260 words; models miscount, so a little slack either side is accepted.
  const WORDS = { basic: { min: 155, max: 205 }, advanced: { min: 225, max: 280 } };
  const SCAN_COUNT = 3;
  const TOPICS = [
    "an everyday invention and the problem it solved", "a surprising fact about an animal", "how a natural process works",
    "a place that is hard to reach", "a famous experiment and what it showed", "how a common material is made",
    "a habit of the human body or brain", "a historical turning point told through one detail", "how an old craft or trade works",
    "a feature of the night sky or weather", "how a city solved a practical problem", "a plant and how it survives",
  ];

  const R = typeof window !== "undefined" ? window.SpellReading : require("./reading.js");

  // Markdown, HTML, entities and control characters have no place in a passage.
  const MARKUP = new RegExp("[<>`*\\\\{}|\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u2028\\u2029]|__|&[#a-z0-9]+;|^\\s*(#|[-+]\\s|\\d+\\.\\s)|\\]\\(", "im");
  const clean = (text) => typeof text === "string" && !MARKUP.test(text);
  const oneLine = (text) => clean(text) && !/[\r\n]/.test(text);
  const squash = (text) => text.replace(/\s+/g, " ").trim();
  const norm = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  function slug(text) {
    return norm(text).normalize("NFD").replace(/[^a-z0-9 ]+/g, "").replace(/ +/g, "-").slice(0, 30).replace(/-+$/, "") || "passage";
  }

  function hash(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // An id the model did not choose: from the title and text, made unique against `taken`.
  function makeId(title, firstParagraph, taken) {
    const base = `gen-${slug(title)}-${hash(title + firstParagraph)}`;
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
  }

  const fail = (reason) => ({ ok: false, reason });

  // Check one model-made passage. `tier` is "basic" or "advanced". `taken` is { ids, titles } (Sets) already
  // in use, built-in and stored. Returns { ok: true, passage } with only the fields we keep, or { ok: false, reason }.
  function validatePassage(raw, tier, taken = {}) {
    const kinds = KINDS[tier];
    if (!kinds) return fail("unknown tier");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("not an object");

    const title = typeof raw.title === "string" ? squash(raw.title) : "";
    if (title.length < 3 || title.length > 60 || !oneLine(title)) return fail("bad title");
    const titles = taken.titles instanceof Set ? taken.titles : new Set();
    if (titles.has(norm(title))) return fail("title already used");

    if (!Array.isArray(raw.paragraphs) || raw.paragraphs.length < 2 || raw.paragraphs.length > 6) return fail("needs 2 to 6 paragraphs");
    const paragraphs = [];
    for (const p of raw.paragraphs) {
      if (typeof p !== "string" || !clean(p)) return fail("paragraph has markup or is not text");
      const text = squash(p);
      if (text.length < 40 || text.length > 1500) return fail("paragraph length");
      paragraphs.push(text);
    }
    const words = R.countWords(paragraphs.join(" "));
    const range = WORDS[tier];
    if (words < range.min || words > range.max) return fail(`${words} words, need ${range.min}-${range.max}`);

    if (!Array.isArray(raw.questions) || raw.questions.length !== kinds.length) return fail(`needs ${kinds.length} questions`);
    const questions = [];
    for (let i = 0; i < kinds.length; i++) {
      const item = raw.questions[i];
      if (!item || typeof item !== "object") return fail("question is not an object");
      if (item.kind !== kinds[i]) return fail(`question ${i + 1} must be a ${kinds[i]} question`);
      const q = typeof item.q === "string" ? squash(item.q) : "";
      if (q.length < 8 || q.length > 160 || !oneLine(q)) return fail(`question ${i + 1} text`);
      if (!Array.isArray(item.options) || item.options.length !== 4) return fail(`question ${i + 1} needs 4 options`);
      const options = item.options.map((o) => (typeof o === "string" ? squash(o) : ""));
      if (options.some((o) => !o || o.length > 120 || !oneLine(o))) return fail(`question ${i + 1} option text`);
      if (new Set(options.map(norm)).size !== 4) return fail(`question ${i + 1} has repeated options`);
      if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3) return fail(`question ${i + 1} answer index`);
      questions.push({ kind: kinds[i], q, options, answer: item.answer });
    }
    if (new Set(questions.map((x) => norm(x.q))).size !== questions.length) return fail("repeated question");

    const ids = taken.ids instanceof Set ? taken.ids : new Set();
    const passage = { id: makeId(title, paragraphs[0], ids), title, paragraphs, questions };

    if (tier === "advanced") {
      if (!Array.isArray(raw.scans) || raw.scans.length !== SCAN_COUNT) return fail(`needs ${SCAN_COUNT} scan questions`);
      const scans = [];
      for (const item of raw.scans) {
        if (!item || typeof item !== "object") return fail("scan is not an object");
        const q = typeof item.q === "string" ? squash(item.q) : "";
        const find = typeof item.find === "string" ? squash(item.find) : "";
        if (q.length < 8 || q.length > 160 || !oneLine(q)) return fail("scan question text");
        const tokens = find.split(" ");
        if (!find || find.length > 60 || tokens.length > 6 || !oneLine(find) || tokens.some((t) => !/[\p{L}\p{N}]/u.test(t))) return fail("scan phrase");
        const found = R.findSpans(passage, find).length;
        if (found !== 1) return fail(`scan phrase "${find}" appears ${found} times, need exactly once`);
        scans.push({ q, find });
      }
      if (new Set(scans.map((s) => norm(s.find))).size !== SCAN_COUNT) return fail("repeated scan phrase");
      passage.scans = scans;
    }
    return { ok: true, passage };
  }

  // Mix the options of each question so the right answer is not always where the model likes to put it.
  function shuffleOptions(passage, random = Math.random) {
    const questions = passage.questions.map((q) => {
      const order = q.options.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
    });
    return { ...passage, questions };
  }

  // ---------- storage ----------
  // Every stored entry is checked again on load, so edited or damaged storage cannot put a broken
  // passage in front of the learner. Newest last; at most MAX_STORED kept.
  function sanitizeStored(raw, builtIn = []) {
    if (!Array.isArray(raw)) return [];
    const taken = { ids: new Set(builtIn.map((p) => p.id)), titles: new Set(builtIn.map((p) => norm(p.title))) };
    const out = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object" || !KINDS[entry.tier] || typeof entry.id !== "string") continue;
      const result = validatePassage(entry, entry.tier, { titles: taken.titles, ids: new Set() });
      if (!result.ok || !/^gen-[a-z0-9-]{1,80}$/.test(entry.id) || taken.ids.has(entry.id)) continue;
      const passage = { ...result.passage, id: entry.id, tier: entry.tier, at: Number.isFinite(entry.at) ? entry.at : 0 };
      taken.ids.add(passage.id);
      taken.titles.add(norm(passage.title));
      out.push(passage);
    }
    return out.slice(-MAX_STORED);
  }

  function loadStored(storage, builtIn) {
    try { return sanitizeStored(JSON.parse(storage.getItem(STORAGE_KEY)), builtIn); } catch { return []; }
  }

  function saveStored(storage, list) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_STORED))); return true; } catch { return false; }
  }

  // The passages to add to a level's pool, for the tier "basic" or "advanced".
  function forTier(list, tier) {
    return list.filter((p) => p.tier === tier);
  }

  function takenFrom(builtIn, stored) {
    const all = [...builtIn, ...stored];
    return { ids: new Set(all.map((p) => p.id)), titles: new Set(all.map((p) => norm(p.title))) };
  }

  // ---------- asking the model ----------
  function extractObject(text) {
    const trimmed = String(text).trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON object found in AI response");
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  function buildPrompt(tier, { topic, avoidTitles = [], problem = "" } = {}) {
    const advanced = tier === "advanced";
    const kinds = KINDS[tier];
    return (
      `Write one reading passage for a speed-reading trainer. Topic: ${topic}.\n` +
      `It must be factual general-interest non-fiction in plain, correct English. Only state facts you are sure are true; no invented statistics, names or quotes.\n` +
      `Length: ${advanced ? "240 to 260" : "170 to 190"} words in total, in ${advanced ? "4" : "3"} paragraphs. ${advanced ? "Make it dense and demanding: longer sentences, precise vocabulary, dates and names." : "Keep it clear and engaging."}\n` +
      `Plain text only: no markdown, no HTML, no asterisks, no lists, no line breaks inside a paragraph.\n` +
      `Then write ${kinds.length} multiple-choice questions, in this order of kinds: ${kinds.join(", ")}. ` +
      `A gist question asks for the main idea, a fact question asks for something the text states, an inference question asks for something that must be worked out from the text. ` +
      `Each has exactly 4 short options, only one of them right and the others plausible but clearly wrong from the text, and "answer" is the index (0-3) of the right option.\n` +
      (advanced
        ? `Also write 3 scan questions {"q","find"}: each q asks for one fact that can be tapped in the text, and "find" is the exact words from the passage that answer it (1 to 4 words, such as a year, a name or a measurement), copied exactly as written and appearing ONLY ONCE in the whole passage.\n`
        : "") +
      (avoidTitles.length ? `Do not reuse these titles or their subjects: ${avoidTitles.slice(-12).join("; ")}.\n` : "") +
      (problem ? `Your previous attempt was rejected: ${problem}. Fix that.\n` : "") +
      `Respond with ONLY one minified JSON object, no markdown, no commentary, in this shape:\n` +
      `{"title":"A short title","paragraphs":["First paragraph.","Second paragraph."],"questions":[{"kind":"gist","q":"What is the passage mainly about?","options":["A","B","C","D"],"answer":1}]` +
      (advanced ? `,"scans":[{"q":"In what year did it happen?","find":"1960"}]` : "") + `}`
    );
  }

  // Ask for one passage of `tier`. Up to `attempts` tries (one retry by default): a reply that is not JSON or
  // fails validatePassage is retried once, with the reason given to the model. Errors from the request itself
  // (no key, no credits, offline, cancelled) are not retried and are thrown as they are.
  //   call(messages, options) -> Promise<string>   the model call (SpellAI.callOpenRouter)
  async function generatePassage(tier, { call, taken = {}, signal, random = Math.random, attempts = 2 } = {}) {
    if (!KINDS[tier]) throw new Error("Unknown passage type");
    const topic = TOPICS[Math.floor(random() * TOPICS.length)];
    const avoidTitles = taken.titles ? [...taken.titles] : [];
    let problem = "";
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (signal?.aborted) throw Object.assign(new Error("Stopped"), { name: "AbortError" });
      const content = await call([
        { role: "system", content: "You are a precise JSON API that writes reading-comprehension passages. Output only valid JSON, nothing else." },
        { role: "user", content: buildPrompt(tier, { topic, avoidTitles, problem }) },
      ], { signal, maxTokens: tier === "advanced" ? 2600 : 1600, timeoutMs: 60000, temperature: 0.7, task: "write a passage" });
      let result;
      try { result = validatePassage(extractObject(content), tier, taken); } catch { result = fail("the reply was not valid JSON"); }
      if (result.ok) return { ...shuffleOptions(result.passage, random), tier, at: Date.now() };
      problem = result.reason;
    }
    throw new Error("The AI wrote a passage that did not pass the checks, twice. Nothing was saved. Try again.");
  }

  // Add new passages to the stored ones, newest kept, no repeated ids or titles.
  function addPassages(stored, fresh) {
    const seenIds = new Set();
    const seenTitles = new Set();
    const merged = [];
    for (const p of [...stored, ...fresh].reverse()) { // newest first, so a repeat drops the older one
      if (seenIds.has(p.id) || seenTitles.has(norm(p.title))) continue;
      seenIds.add(p.id);
      seenTitles.add(norm(p.title));
      merged.push(p);
    }
    return merged.slice(0, MAX_STORED).reverse();
  }

  const api = { STORAGE_KEY, MAX_STORED, KINDS, WORDS, validatePassage, shuffleOptions, sanitizeStored, loadStored, saveStored,
    forTier, takenFrom, extractObject, buildPrompt, generatePassage, addPassages };

  if (typeof window === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    return;
  }

  // ---------- DOM ----------
  const builtIn = () => [...(window.SpellReadingPassages?.PASSAGES || []), ...(window.SpellReadingPassages?.ADVANCED_PASSAGES || [])];
  let stored = null;
  const getStored = () => (stored ||= loadStored(localStorage, builtIn()));
  let job = null; // { controller, status } while generating

  // The pool hook read by passagesFor in reading.js.
  window.SpellReadingPassages.generatedFor = (tier) => forTier(getStored(), tier);

  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const countLine = () => {
    const n = getStored().length;
    return n ? `${n} new passage${n === 1 ? "" : "s"} saved on this device. They join your levels automatically.` : "None yet. The levels use the built-in passages.";
  };

  function home() {
    const on = Boolean(window.SpellAI?.isEnabled());
    return `<section class="feature-card rg-card" aria-labelledby="rg-title">
      <h3 id="rg-title">New passages</h3>
      <p class="settings-note" data-rg="count">${escapeHtml(countLine())}</p>
      <button class="btn btn-ghost" type="button" data-rg="go" ${on || job ? "" : "disabled"}>${job ? "Stop" : "Generate 2 new passages"}</button>
      <p class="settings-note rg-status" data-rg="status" role="status">${on || job ? escapeHtml(job?.status || "") : "Turn on AI and add your OpenRouter key in Settings to make new passages."}</p>
      <p class="settings-note">Uses your own OpenRouter credits: one basic and one advanced passage, a few cents at most. AI can make mistakes, so a question may occasionally be unclear.</p>
    </section>`;
  }

  function bind(root) {
    const card = root.querySelector(".rg-card");
    if (!card) return;
    const el = (name) => card.querySelector(`[data-rg="${name}"]`);
    const go = el("go");
    const setStatus = (text) => { if (job) job.status = text; if (card.isConnected) el("status").textContent = text; };

    go.addEventListener("click", async () => {
      if (job) { job.controller.abort(); return; }
      const controller = new AbortController();
      job = { controller, status: "" };
      go.textContent = "Stop";
      const made = [];
      let problem = "";
      for (const tier of ["basic", "advanced"]) {
        setStatus(`Writing a ${tier} passage… ${made.length ? `${made.length} of 2 done.` : "This can take up to a minute."}`);
        try {
          const taken = takenFrom(builtIn(), getStored());
          const passage = await generatePassage(tier, { call: window.SpellAI.callOpenRouter, taken, signal: controller.signal });
          made.push(passage);
          stored = addPassages(getStored(), [passage]);
          if (!saveStored(localStorage, stored)) problem = "Could not save on this device (storage is full or blocked).";
        } catch (error) {
          problem = error?.name === "AbortError" ? "Stopped." : error?.message || "Could not write a passage.";
          break;
        }
        if (card.isConnected) el("count").textContent = countLine();
      }
      const saved = made.length ? `Saved ${made.length} new passage${made.length === 1 ? "" : "s"}.` : "Nothing was saved.";
      job = null;
      if (card.isConnected) {
        el("count").textContent = countLine();
        el("status").textContent = [saved, problem].filter(Boolean).join(" ");
        go.textContent = "Generate 2 new passages";
        go.disabled = !window.SpellAI?.isEnabled();
      }
    });
  }

  window.SpellReading?.register({ id: "generated", home, bind });
})();
