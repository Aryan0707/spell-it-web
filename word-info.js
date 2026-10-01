// Everything the app knows about one word, gathered in one place so the study card and the
// "My words" list view agree. Built-in, hand-checked data always wins; a word's own saved
// fields (written by AI, or typed by the learner) fill the gaps.
(() => {
  "use strict";

  const DETAIL_FIELDS = ["examples", "meaning", "sounds"];

  function builtIn(entry) {
    const list = typeof WORD_LIST !== "undefined" ? WORD_LIST : [];
    return list.find((w) => w.word === entry.word || (w.variants && Object.values(w.variants).includes(entry.word))) || null;
  }

  // Example sentences, each with exactly one "{word}" placeholder. Entries can come from an
  // imported backup, so anything that does not fit the template is ignored rather than shown.
  function examplesOf(entry) {
    if (!entry) return [];
    const base = builtIn(entry);
    const table = typeof WORD_EXAMPLES !== "undefined" ? WORD_EXAMPLES : {};
    const own = Array.isArray(entry.examples) ? entry.examples.slice(0, 3) : [];
    const list = (base && table[base.word]) || own;
    return list.filter((s) => typeof s === "string" && s.length <= 200 && s.split("{word}").length === 2);
  }

  function forEntry(entry) {
    return {
      hint: (entry && entry.hint) || "",
      meaning: (window.SpellMeanings && window.SpellMeanings.forEntry(entry)) || null,
      guide: (window.SpellSounds && window.SpellSounds.forEntry(entry)) || null,
      examples: examplesOf(entry),
    };
  }

  // A sentence as DOM nodes with the word picked out. A sentence that starts with the
  // word gets a capital letter, since the stored form is lowercase.
  function sentenceNodes(sentence, word) {
    const [before, after] = sentence.split("{word}");
    const mark = document.createElement("mark");
    mark.textContent = before ? word : word.charAt(0).toUpperCase() + word.slice(1);
    return [document.createTextNode(before), mark, document.createTextNode(after)];
  }

  // The sentence as plain text, for speaking aloud.
  function sentenceText(sentence, word) {
    const [before, after] = sentence.split("{word}");
    return before + (before ? word : word.charAt(0).toUpperCase() + word.slice(1)) + after;
  }

  const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="3 9 3 15 8 15 13 20 13 4 8 9 3 9"></polygon><path d="M16 9a5 5 0 0 1 0 6"></path><path d="M19.5 6a9 9 0 0 1 0 12"></path></svg>';

  // A small speaker button; the caller says what to speak.
  function listenButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "example-listen";
    button.setAttribute("aria-label", label);
    button.innerHTML = SPEAKER; // fixed markup above, no learner text
    button.addEventListener("click", onClick);
    return button;
  }

  // Does this word still lack something the study card would like to show?
  function needsDetails(entry) {
    const info = forEntry(entry);
    return !info.meaning || !info.guide || !info.examples.length;
  }

  // Ask for details for every word that needs them, one batch at a time, and report what came back.
  // A failed batch stops the run but keeps everything gathered before it. `ask(words)` resolves to
  // [{ word, hint?, examples?, meaning?, sounds? }]; the caller merges the result into the live list.
  async function gatherDetails(entries, ask, { batch = 12, onProgress } = {}) {
    const targets = entries.filter(needsDetails);
    const found = new Map();
    let failure = "";
    for (let i = 0; i < targets.length; i += batch) {
      if (onProgress) onProgress(i, targets.length);
      try {
        for (const result of await ask(targets.slice(i, i + batch).map((e) => e.word))) found.set(result.word, result);
      } catch (error) {
        failure = (error && error.message) || String(error);
        break;
      }
    }
    return { found, failure, asked: targets.length };
  }

  // Add newly written details to a word without overwriting anything it already has.
  function mergeDetails(entry, extra) {
    if (!extra) return entry;
    const merged = { ...entry };
    let changed = false;
    if (extra.hint && !merged.hint) { merged.hint = extra.hint; changed = true; }
    for (const field of DETAIL_FIELDS) {
      const have = field === "examples" ? Array.isArray(merged.examples) && merged.examples.length : merged[field];
      if (!have && extra[field] && (field !== "examples" || extra.examples.length)) { merged[field] = extra[field]; changed = true; }
    }
    return changed ? merged : entry; // the same object back means nothing was added
  }

  // When a list is edited its words are rebuilt from text, which only holds word, definition and
  // syllables. Carry the saved details over so editing never throws them away.
  function keepDetails(oldEntry, newEntry) {
    if (!oldEntry || oldEntry.word !== newEntry.word) return newEntry;
    const kept = { ...newEntry };
    for (const field of DETAIL_FIELDS) if (kept[field] === undefined && oldEntry[field] !== undefined) kept[field] = oldEntry[field];
    return kept;
  }

  window.SpellWordInfo = { forEntry, examplesOf, sentenceNodes, sentenceText, listenButton, needsDetails, gatherDetails, mergeDetails, keepDetails };
})();
