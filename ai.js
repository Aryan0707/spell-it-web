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

  async function callOpenRouter(messages, { timeoutMs = 20000, maxTokens = 2500, temperature = 0.8, task = "generate words", signal } = {}) {
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
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const messages = { 401: "Check your OpenRouter API key in Settings.", 402: "Your OpenRouter credits are exhausted. Add credits or keep using the built-in course.", 429: "OpenRouter is rate-limiting requests. Wait a little before trying again." };
        throw new Error(messages[res.status] || `OpenRouter could not ${task} (HTTP ${res.status}). Try again or check your model in Settings.`);
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

  // ---- study-card extras (meaning, examples, pronunciation) ----
  // The model's output is untrusted: each extra is checked on its own and silently dropped if it
  // fails, so a bad definition or guide never costs the learner the word itself.
  const noPipes = (text) => String(text || "").replace(/[|{}]/g, " ").replace(/\s+/g, " ").trim();

  function cleanExamples(word, list) {
    if (!Array.isArray(list)) return [];
    const whole = new RegExp(`\\b${word}\\b`, "gi");
    const out = [];
    for (const raw of list) {
      if (typeof raw !== "string") continue;
      const sentence = raw.trim();
      if (sentence.length < 12 || sentence.length > 140 || /[{}|]/.test(sentence)) continue;
      if ((sentence.match(whole) || []).length !== 1) continue; // the word, exactly once, in its exact form
      const templated = sentence.replace(whole, "{word}");
      if (!out.includes(templated)) out.push(templated);
      if (out.length === 3) break;
    }
    return out;
  }

  function cleanMeaning(word, item) {
    const meanings = typeof window !== "undefined" && window.SpellMeanings;
    if (!meanings || typeof item.definition !== "string") return "";
    const related = Array.isArray(item.related) ? item.related.map(noPipes).filter(Boolean).slice(0, 4) : [];
    const row = `${noPipes(item.partOfSpeech)} | ${noPipes(item.definition)} | ${related.join(", ")}`;
    return meanings.fromRow(word, row) ? row : "";
  }

  function cleanSounds(word, item) {
    const sounds = typeof window !== "undefined" && window.SpellSounds;
    if (!sounds) return "";
    const row = `${noPipes(item.syllables)} | ${noPipes(item.respelling)} | ${noPipes(item.ipa)} | ${noPipes(item.soundNote)}`.replace(/ \| $/, "");
    return sounds.fromRow(word, row) ? row : "";
  }

  // Every extra that passed its own check, as the fields stored on a word entry.
  function cleanExtras(word, item) {
    const examples = cleanExamples(word, item.examples);
    const meaning = cleanMeaning(word, item);
    const sounds = cleanSounds(word, item);
    return {
      ...(examples.length ? { examples } : {}),
      ...(meaning ? { meaning } : {}),
      ...(sounds ? { sounds } : {}),
    };
  }

  // The field-by-field instructions for the extras, shared by new-word and fill-in requests.
  function detailRules(spellingStyle) {
    return (
      `- partOfSpeech: noun, verb, adjective, adverb, etc.\n` +
      `- definition: one plain-English sentence in simple words, never containing the word itself.\n` +
      `- related: 2 or 3 synonyms or closely related words.\n` +
      `- examples: exactly 3 short, natural sentences in different contexts. Each must contain the word exactly once, spelled exactly as given (same form: no plural, no past tense).\n` +
      `- syllables: the written syllables, lowercase, joined by hyphens, which must spell the word exactly when the hyphens are removed.\n` +
      `- respelling: how to say it in ordinary English letters (ay, ee, eye, oh, oo, ow, aw, uh, ur, air), one part per syllable joined by hyphens, with the stressed syllable in CAPITAL LETTERS. ` +
      (spellingStyle === "uk" ? "Use British pronunciation.\n" : "Use American pronunciation.\n") +
      `- ipa: the IPA transcription between slashes.\n` +
      `- soundNote: one short note about any sound the spelling hides (silent letters, unexpected sounds), or an empty string if there is none.\n`
    );
  }

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
      `Also include, for each word, the details a learner needs to understand and say it:\n` +
      detailRules(spellingStyle) +
      `Respond with ONLY a minified JSON array, no markdown, no commentary, in this exact shape:\n` +
      `[{"word":"example","hint":"a thing that shows how something is done","memoryTip":"Remember the x after e.","partOfSpeech":"noun","definition":"Something that shows what a thing is like.","related":["sample","instance"],"examples":["She gave an example of a good answer.","This picture is a good example of her style.","Can you give me one more example?"],"syllables":"ex-am-ple","respelling":"ig-ZAM-pul","ipa":"/ɪɡˈzæm.pəl/","soundNote":"The x says /gz/."}]`;

    const content = await callOpenRouter([
      { role: "system", content: "You are a precise JSON API for generating English spelling-practice word lists. Output only valid JSON, nothing else." },
      { role: "user", content: prompt },
    ], { signal, maxTokens: Math.min(12000, 800 + count * 450), timeoutMs: Math.min(90000, 20000 + count * 3500) });

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
        ...cleanExtras(w, item),
      });
      if (clean.length === count) break;
    }
    if (!clean.length) throw new Error("AI returned no usable words");
    return clean;
  }

  // Fill in the study-card details for words the learner already has (their own lists).
  // Returns one { word, hint?, examples?, meaning?, sounds? } per word the model handled; anything
  // it got wrong is left out, so the caller only ever merges details that passed validation.
  const ENRICH_BATCH = 12;

  async function enrichWords(words, { spellingStyle, signal } = {}) {
    const list = [...new Set(words.map((w) => String(w).toLowerCase()))].filter((w) => /^[a-z]{2,24}$/.test(w)).slice(0, ENRICH_BATCH);
    if (!list.length) return [];
    const styleText = spellingStyle === "uk" ? "Use British English spelling and pronunciation.\n" : "Use American English spelling and pronunciation.\n";
    const prompt =
      `Prepare study notes for these English words, in this order: ${list.join(", ")}.\n` + styleText +
      `Never change a word's spelling, and never add or skip words. If something is not a real English word, return only {"word":"<it>"} for it.\n` +
      `For each real word include:\n` +
      `- hint: a plain-English definition of at most 15 words that never contains the word itself.\n` +
      detailRules(spellingStyle) +
      `Respond with ONLY a minified JSON array, no markdown, no commentary, in this exact shape:\n` +
      `[{"word":"example","hint":"a thing that shows how something is done","partOfSpeech":"noun","definition":"Something that shows what a thing is like.","related":["sample","instance"],"examples":["She gave an example of a good answer.","This picture is a good example of her style.","Can you give me one more example?"],"syllables":"ex-am-ple","respelling":"ig-ZAM-pul","ipa":"/ɪɡˈzæm.pəl/","soundNote":"The x says /gz/."}]`;

    const content = await callOpenRouter([
      { role: "system", content: "You are a precise JSON API that writes study notes for English words. Output only valid JSON, nothing else." },
      { role: "user", content: prompt },
    ], { signal, maxTokens: Math.min(12000, 800 + list.length * 450), timeoutMs: Math.min(90000, 20000 + list.length * 3500) });

    const seen = new Set();
    const out = [];
    for (const item of extractJson(content)) {
      const w = item && typeof item.word === "string" ? item.word.trim().toLowerCase() : "";
      if (!list.includes(w) || seen.has(w)) continue; // only words we asked about, once each
      seen.add(w);
      const hint = typeof item.hint === "string" ? item.hint.trim() : "";
      const hintOk = hint && hint.length <= 240 && !new RegExp(`\\b${w}\\b`, "i").test(hint);
      out.push({ word: w, ...(hintOk ? { hint } : {}), ...cleanExtras(w, item) });
    }
    return out;
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

  // The plain a-z form of a word or name, so it can be practised with letter tiles and typed with an
  // ordinary keyboard: Siobhán -> siobhan, Straße -> strasse, Ørsted -> orsted. The original spelling
  // is kept separately, in the word's origin text.
  function fold(text) {
    return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/ß/g, "ss").replace(/[æÆ]/g, "ae").replace(/[œŒ]/g, "oe").replace(/[øØ]/g, "o")
      .replace(/[đĐ]/g, "d").replace(/[łŁ]/g, "l").replace(/ı/g, "i")
      .toLowerCase().replace(/[^a-z]/g, "");
  }

  // Pick words and names worth practising out of the latest chat exchange. `turns` is the recent
  // conversation ([{ role, content }]). Anything the model gets wrong is dropped item by item, the same
  // way the word lab treats its output, so a bad definition never costs the learner the word itself.
  async function suggestWords(turns, { spellingStyle, signal } = {}) {
    const talk = turns.slice(-4).map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${String(m.content).slice(0, 1200)}`).join("\n");
    const prompt =
      `Here is the end of a chat between a learner and a spelling tutor:\n${talk}\n\n` +
      `Pick up to 6 single words or names from it that are worth practising spelling, focusing on what the learner just asked about and the tutor just answered. ` +
      `They may be words in any language, or personal names, surnames and places (for example Irish, Indian, British or other names). One word each: skip phrases.\n` +
      `For each give:\n` +
      `- word: lowercase letters a-z only (remove accents, spaces, hyphens and apostrophes), 3-24 letters.\n` +
      `- written: the real spelling with accents and capital letters, for example "Siobhán".\n` +
      `- origin: what it is, at most 60 characters, for example "Irish first name", "German word used in English" or "Place in England".\n` +
      `- lang: a two-letter language code ONLY if the word is normally said in its own language rather than the English way and is written in Latin letters (for example "de", "pt", "es"); otherwise "".\n` +
      `- hint: a plain-English meaning of at most 15 words that never contains the word itself.\n` +
      detailRules(spellingStyle) +
      `- For a name, partOfSpeech must be exactly "first name", "surname" or "place name".\n` +
      `Never invent a word or a meaning; leave out anything you are not sure about.\n` +
      `Respond with ONLY a minified JSON array, no markdown, no commentary, in this exact shape:\n` +
      `[{"word":"siobhan","written":"Siobhán","origin":"Irish first name","lang":"","hint":"A traditional Irish girl's name.","partOfSpeech":"first name","definition":"A traditional Irish girl's name, said with a sh sound at the start.","related":[],"examples":["Siobhan won the school spelling prize.","My friend Siobhan always spells it out for new teachers.","Nobody guesses how to say Siobhan on the first try."],"syllables":"sio-bhan","respelling":"shi-VAWN","ipa":"/ʃɪˈvɔːn/","soundNote":"In Irish, sio says shi and bh says v."}]`;

    const content = await callOpenRouter([
      { role: "system", content: "You are a precise JSON API that picks words and names for spelling practice. Output only valid JSON, nothing else." },
      { role: "user", content: prompt },
    ], { signal, maxTokens: 3800, timeoutMs: 45000, temperature: 0.3, task: "find words" });

    const seen = new Set();
    const out = [];
    for (const item of extractJson(content)) {
      if (!item || typeof item !== "object") continue;
      const written = typeof item.written === "string" ? item.written.trim() : "";
      if (/\s/.test(written) || /\s/.test(String(item.word || "").trim())) continue; // a phrase, not one word
      const word = fold(item.word || written);
      if (!/^[a-z]{3,24}$/.test(word) || seen.has(word)) continue;
      const extras = cleanExtras(word, item);
      const whole = new RegExp(`\\b${word}\\b`, "i");
      const rawHint = typeof item.hint === "string" ? item.hint.trim() : "";
      const hint = rawHint && rawHint.length <= 240 && !whole.test(rawHint) ? rawHint : "";
      if (!hint && !extras.meaning) continue; // nothing to show the learner about it
      seen.add(word);
      // Keep the original spelling visible when it differs from the plain letters (accents, unusual capitals).
      const plainCaps = word.charAt(0).toUpperCase() + word.slice(1);
      const kind = noPipes(item.origin).slice(0, 60);
      const showWritten = written && fold(written) === word && written !== word && written !== plainCaps ? noPipes(written).slice(0, 40) : "";
      const origin = [kind, showWritten].filter(Boolean).join(" · ");
      const lang = typeof item.lang === "string" && /^[a-z]{2,3}$/.test(item.lang.trim().toLowerCase()) ? item.lang.trim().toLowerCase() : "";
      out.push({ word, hint: hint || extras.meaning.split("|")[1].trim().slice(0, 240), ...(origin ? { origin } : {}), ...(lang ? { lang } : {}), ...extras });
      if (out.length === 6) break;
    }
    if (!out.length) throw new Error("No words to add from that answer. Ask about a word or a name first.");
    return out;
  }

  // One turn of the free-form word chat. `messages` is the whole conversation to send, system prompt
  // first (chat.js builds it). A lower temperature than word generation: answers about spelling and
  // meaning should be steady, not inventive. Resolves to the reply text.
  async function chat(messages, { signal } = {}) {
    const content = await callOpenRouter(messages, { signal, temperature: 0.4, maxTokens: 700, timeoutMs: 30000, task: "answer" });
    return content.trim();
  }

  window.SpellAI = {
    loadConfig,
    saveConfig,
    isEnabled,
    logMistake,
    generateWordBatch,
    enrichWords,
    ENRICH_BATCH,
    explainMistake,
    chat,
    suggestWords,
    fold,
    DEFAULT_MODEL,
  };
})();
