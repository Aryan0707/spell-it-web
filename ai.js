// AI layer: talks to OpenRouter directly from the browser using a key the
// user pastes in Settings (stored only in this browser's localStorage).
(() => {
  "use strict";

  const CONFIG_KEY = "spellit_ai_config";
  const MISTAKE_LOG_KEY = "spellit_mistake_log";
  const DEFAULT_MODEL = "openai/gpt-4.1-mini";
  const API_URL = "https://openrouter.ai/api/v1/chat/completions";

  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { apiKey: "", model: DEFAULT_MODEL, useAI: false };
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  function isEnabled() {
    const cfg = loadConfig();
    return !!(cfg.useAI && cfg.apiKey && cfg.apiKey.trim());
  }

  // ---- mistake log: rolling history used to personalize word generation ----
  function loadMistakeLog() {
    try {
      const raw = localStorage.getItem(MISTAKE_LOG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }

  function logMistake(word, attempt) {
    const log = loadMistakeLog();
    log.push({ word, attempt });
    while (log.length > 30) log.shift();
    localStorage.setItem(MISTAKE_LOG_KEY, JSON.stringify(log));
  }

  async function callOpenRouter(messages, { timeoutMs = 20000, signal } = {}) {
    const cfg = loadConfig();
    if (!cfg.apiKey) throw new Error("No API key configured");

    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey.trim()}`,
          "HTTP-Referer": "https://spellit.local",
          "X-Title": "Spell It",
        },
        body: JSON.stringify({
          model: cfg.model || DEFAULT_MODEL,
          messages,
          temperature: 0.8,
          max_tokens: 2500,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const messages = { 401: "Check your OpenRouter API key in Settings.", 402: "Your OpenRouter credits are exhausted. Add credits or keep using the built-in course.", 429: "OpenRouter is rate-limiting requests. Wait a little before trying again." };
        throw new Error(messages[res.status] || `OpenRouter could not generate words (HTTP ${res.status}). Try again or check your model in Settings.`);
      }

      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty AI response");
      return content;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  }

  function extractJson(text) {
    const trimmed = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("No JSON array found in AI response");
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  const DIFFICULTY_DESCRIPTIONS = {
    beginner: "beginner — very short, simple sight words (3-5 letters), no tricky spelling at all, suitable for someone just starting to learn to spell",
    easy: "easy — short, common, everyday words (4-6 letters)",
    medium: "medium — moderately challenging words (7-9 letters) with some tricky spelling patterns",
    hard: "hard — long or notoriously tricky words (9+ letters), silent letters, double consonants, unusual patterns",
    expert: "expert — ultra-advanced vocabulary (11+ letters), rare or academic words, easily confused vowel clusters, French/Greek/Latin-derived spellings, the kind of words used in spelling bees",
  };

  async function generateWordBatch(count, { recentWords = [], difficulty, category, weakPatterns = [], spellingStyle, signal } = {}) {
    count = Math.max(1, Math.min(20, Math.floor(count) || 5));
    const mistakes = loadMistakeLog().slice(-15);

    let mistakeContext = "";
    if (mistakes.length) {
      mistakeContext =
        "Here are recent words the learner misspelled and what they typed instead:\n" +
        mistakes.map((m) => `- correct: "${m.word}", typed: "${m.attempt}"`).join("\n") +
        "\nInfer the learner's weak spelling patterns (e.g. silent letters, double consonants, ie/ei confusion, homophones) and favor words that train those patterns.\n";
    }

    let weakPatternContext = "";
    if (weakPatterns.length) {
      weakPatternContext =
        "This learner's known weakest spelling patterns overall, ranked by how often they trip on them: " +
        weakPatterns.map((p) => `${p.label} (${p.count} misses)`).join(", ") +
        ". Prioritize words that specifically exercise these patterns.\n";
    }

    const avoidContext = recentWords.length
      ? `Do not include these recently used words: ${recentWords.join(", ")}.\n`
      : "";

    const difficultyText = DIFFICULTY_DESCRIPTIONS[difficulty] || "a natural mix of easy, medium, and hard";
    const categoryText = category
      ? `Every word must fit the theme/category "${category}" (e.g. words a learner would associate with that topic).\n`
      : "";
    const styleText =
      spellingStyle === "uk"
        ? "Use British English spelling conventions throughout (e.g. colour, organise, centre, travelling, favourite), never American spelling.\n"
        : "Use American English spelling conventions throughout (e.g. color, organize, center, traveling, favorite), never British spelling.\n";

    const prompt =
      `Generate exactly ${count} English words for a spelling practice app. Difficulty: ${difficultyText}.\n` +
      categoryText +
      styleText +
      weakPatternContext +
      mistakeContext +
      avoidContext +
      `Rules for each word: real English dictionary words only, lowercase letters a-z only, length 3-24 (matching the requested difficulty), no proper nouns, no hyphens/apostrophes/contractions. Never invent a word. ` +
      `Include a short one-sentence hint (a plain-English definition or example use) that never contains the word itself.\n` +
      `Include memoryTip: one short accurate spelling tip identifying tricky letters or a memory aid. Do not invent word origins or pronunciation rules.\n` +
      `Respond with ONLY a minified JSON array, no markdown, no commentary, in this exact shape:\n` +
      `[{"word":"example","hint":"a thing that shows how something is done","memoryTip":"Remember the x after e."}]`;

    const content = await callOpenRouter([
      { role: "system", content: "You are a precise JSON API for generating English spelling-practice word lists. Output only valid JSON, nothing else." },
      { role: "user", content: prompt },
    ], { signal });

    const parsed = extractJson(content);
    const seen = new Set();
    const clean = [];
    for (const item of parsed) {
      if (!item || typeof item.word !== "string" || typeof item.hint !== "string") continue;
      const w = item.word.trim().toLowerCase();
      if (!/^[a-z]{3,24}$/.test(w)) continue;
      if (seen.has(w) || recentWords.includes(w)) continue;
      const hint = item.hint.trim();
      if (!hint || hint.length > 500 || new RegExp(`\\b${w}\\b`, "i").test(hint)) continue;
      seen.add(w);
      clean.push({ word: w, hint,
        ...(DIFFICULTY_DESCRIPTIONS[difficulty] ? { difficulty } : {}),
        ...(typeof item.memoryTip === "string" && item.memoryTip.trim() ? { memoryTip: item.memoryTip.trim().slice(0, 500) } : {}),
      });
      if (clean.length === count) break;
    }
    if (!clean.length) throw new Error("AI returned no usable words");
    return clean;
  }

  async function explainMistake({ word, hint, attempts }) {
    const attemptList = attempts.filter(Boolean).join(", ") || "(skipped)";
    const prompt =
      `The learner was asked to spell the word "${word}" (hint: ${hint}). ` +
      `Their incorrect attempt(s): ${attemptList}. ` +
      `In at most 2 short, encouraging sentences, explain the likely spelling rule or pattern they missed ` +
      `(e.g. silent letters, double consonants, ie/ei, homophones, unusual endings) and give one quick memory tip. ` +
      `Do not just spell the word letter by letter. Speak directly to the learner as "you".`;

    const content = await callOpenRouter(
      [
        { role: "system", content: "You are a warm, concise spelling tutor. Maximum 2 sentences." },
        { role: "user", content: prompt },
      ],
      { timeoutMs: 15000 }
    );
    return content.trim();
  }

  window.SpellAI = {
    loadConfig,
    saveConfig,
    isEnabled,
    logMistake,
    generateWordBatch,
    explainMistake,
    DEFAULT_MODEL,
  };
})();
