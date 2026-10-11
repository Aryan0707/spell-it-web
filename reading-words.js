// Reading to spelling: on a passage's result screen the learner taps a word they did not know or could
// not spell, and it is saved to the list "From reading". That list is an ordinary word list, so it feeds
// spelling practice, the notebook and study cards like any other. When AI words are on, saved words get a
// meaning, examples and pronunciation in the background. The front page shows a small card with a
// Practise button. Words are never tappable during a drill: this only runs on the result screen.
// The rules above the DOM line are pure and exported in Node for tests.
(() => {
  "use strict";

  const LIST_NAME = "From reading";
  const MAX_LIST = 100;          // same limit as every word list (packs.js, learning.js)
  const MIN_LETTERS = 3;
  const MAX_LETTERS = 24;
  const WORD_SHAPE = new RegExp(`^[a-z]{${MIN_LETTERS},${MAX_LETTERS}}$`);

  // The plain form of a tapped word: lowercase, punctuation and quotes stripped from both ends, letters
  // only. Returns "" for anything that cannot be a practice word (too short, digits, hyphens, accents).
  function normaliseWord(raw) {
    const word = String(raw == null ? "" : raw).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").toLowerCase();
    return WORD_SHAPE.test(word) ? word : "";
  }

  // One paragraph as tappable pieces, in order: { text } as printed, and { word } when it can be saved.
  function tokenize(paragraph) {
    return String(paragraph || "").split(/\s+/).filter(Boolean).map((text) => ({ text, word: normaliseWord(text) }));
  }

  // What happens when `raw` is tapped and the list already holds `have` (an array of words).
  // status: "added" | "duplicate" | "invalid" | "full"
  function planAdd(have, raw, max = MAX_LIST) {
    const word = normaliseWord(raw);
    if (!word) return { status: "invalid", word: "" };
    if (have.includes(word)) return { status: "duplicate", word };
    if (have.length >= max) return { status: "full", word };
    return { status: "added", word };
  }

  // A list entry for a word that has no details yet. `known` is the entry the word bank already has, if any.
  function makeEntry(word, known) {
    return { ...(known || {}), word, hint: (known && known.hint) || "", syllables: (known && known.syllables) || "" };
  }

  const withoutWord = (entries, word) => entries.filter((e) => e.word !== word);

  // The sentence under the passage: how many words are saved from this read.
  function summaryText(savedNow, total) {
    if (!savedNow) return total ? `${total} ${total === 1 ? "word" : "words"} in “${LIST_NAME}”.` : "";
    return `Saved ${savedNow} ${savedNow === 1 ? "word" : "words"} from this read. ${total} in “${LIST_NAME}”.`;
  }

  const rules = { LIST_NAME, MAX_LIST, normaliseWord, tokenize, planAdd, makeEntry, withoutWord, summaryText };

  if (typeof window === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = rules;
    return;
  }

  // ---------- DOM ----------
  if (!window.SpellReading || !window.SpellReading.register) return;

  const findList = () => (window.SpellLearning ? SpellLearning.lists().find((l) => l.name === LIST_NAME) || null : null);
  const listWords = () => (findList()?.entries || []).map((e) => e.word);

  function enrichSoon(api) {
    clearTimeout(enrichSoon.timer);
    if (!window.SpellAI?.isEnabled() || !window.SpellWordInfo) return;
    enrichSoon.timer = setTimeout(async () => {
      const list = findList();
      if (!list || enrichSoon.busy) return;
      enrichSoon.busy = true;
      try {
        const style = api.adapter()?.style?.() || "us";
        const { found } = await SpellWordInfo.gatherDetails(list.entries, (words) => SpellAI.enrichWords(words, { spellingStyle: style }), { batch: SpellAI.ENRICH_BATCH });
        const current = findList(); // the list may have changed while the AI was thinking
        if (!current) return;
        const entries = current.entries.map((e) => SpellWordInfo.mergeDetails(e, found.get(e.word)));
        if (entries.some((e, i) => e !== current.entries[i])) SpellLearning.saveList(current.id, current.name, entries);
      } catch (error) { /* the words stay saved; details can be added later from My lists */ }
      enrichSoon.busy = false;
    }, 1500);
  }

  function addWord(word) {
    const parsed = SpellLearning.parseWords(word).entries[0]; // fills in what the word bank already knows
    return SpellPacks.addToList(LIST_NAME, [makeEntry(word, parsed)]);
  }

  function removeWord(word) {
    const list = findList();
    if (list) SpellLearning.saveList(list.id, list.name, withoutWord(list.entries, word));
  }

  function resultSection(root, api, { passage }) {
    if (!window.SpellLearning || !window.SpellPacks) return;
    const esc = api.escapeHtml;
    const saved = new Set(listWords()); // words in the list, shown highlighted
    const mine = new Set();             // words saved during this read
    const body = passage.paragraphs.map((p) =>
      `<p>${tokenize(p).map((t) => t.word
        ? `<button type="button" class="rdw-word${saved.has(t.word) ? " saved" : ""}" data-w="${t.word}" aria-pressed="${saved.has(t.word)}">${esc(t.text)}</button>`
        : esc(t.text)).join(" ")}</p>`).join("");
    const section = document.createElement("section");
    section.className = "feature-card rdw-keep";
    section.innerHTML = `<h3>Words to keep</h3>
      <p class="settings-note">Tap a word you did not know or could not spell. It goes to “${LIST_NAME}” so you can practise it. Tap it again to take it out.</p>
      <div class="rdw-text">${body}</div>
      <p class="rdw-status" role="status"></p>
      <button class="btn btn-primary" type="button" data-rdw-practise hidden>Practise them</button>`;
    const anchor = root.querySelector(".rd-review");
    if (anchor) anchor.after(section); else root.append(section);

    const status = section.querySelector(".rdw-status");
    const practise = section.querySelector("[data-rdw-practise]");
    const refresh = (message) => {
      const total = listWords().length;
      status.textContent = message || summaryText(mine.size, total);
      practise.hidden = !total;
    };
    refresh();

    section.addEventListener("click", (event) => {
      const button = event.target.closest(".rdw-word");
      if (!button) return;
      const word = button.dataset.w;
      try {
        if (button.classList.contains("saved")) {
          removeWord(word);
          mine.delete(word);
          for (const b of section.querySelectorAll(`.rdw-word[data-w="${word}"]`)) { b.classList.remove("saved"); b.setAttribute("aria-pressed", "false"); }
          return refresh();
        }
        const plan = planAdd(listWords(), word);
        if (plan.status === "full") return refresh(`“${LIST_NAME}” is full (${MAX_LIST} words). Practise some or take a few out first.`);
        if (plan.status !== "added") return refresh();
        addWord(word);
        mine.add(word);
        for (const b of section.querySelectorAll(`.rdw-word[data-w="${word}"]`)) { b.classList.add("saved"); b.setAttribute("aria-pressed", "true"); }
        refresh();
        enrichSoon(api);
      } catch (error) { refresh(error.message || "Could not save that word."); }
    });
    practise.addEventListener("click", () => { const list = findList(); if (list) SpellPacks.practice(list.id); });
  }

  function homeCard(api) {
    if (!window.SpellLearning) return "";
    const count = listWords().length;
    if (!count) return "";
    return `<div class="feature-card rdw-home">
      <span><strong>From reading: ${count} ${count === 1 ? "word" : "words"}</strong><small>Words you tapped in passages.</small></span>
      <button class="btn btn-primary" type="button" data-rdw-practise-home>Practise them</button>
    </div>`;
  }

  SpellReading.register({
    id: "reading-words",
    home: homeCard,
    bind(root) {
      root.querySelector("[data-rdw-practise-home]")?.addEventListener("click", () => {
        const list = findList();
        if (list && window.SpellPacks) SpellPacks.practice(list.id);
      });
    },
    afterResult: resultSection,
  });
  window.SpellReadingWords = rules;
})();
