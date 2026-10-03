// Word packs: hand-written words in other languages, and names and places. Small and always loaded;
// the words themselves live in one file per pack (packs-<id>.js) that loads only when it is needed.
//
// Storage: a pack word saved in a list, a review record or the notebook is stored as just
// { word, pack } plus anything the learner changed, and is looked up here when it is read back
// (see `slim` and `hydrate`). A word is therefore kept once, in the shipped file, not once per place.
//
// Row format in packs-<id>.js (SpellPacks.register(id, { themeId: [rows] })):
//   w: the plain a-z word        o: language / kind, then the original spelling
//   lang: say it in this language (only Latin-script words that English does not say its own way)
//   pos / def / rel: the meaning row     say: "syllables | respelling | IPA | note"  (or syl: syllables only)
//   ex: three sentences, each with {word} exactly once
(() => {
  "use strict";

  const USED_KEY = "spellit_packs"; // pack ids this device uses; index.html loads these before the app starts
  const MAX_LIST = 100;

  // What the Learn tab shows without loading any words. `count` per theme must match the data file (tested).
  const INDEX = [
    { id: "world", title: "World words", file: "packs-world.js",
      blurb: "Words English borrowed from other languages, and words with no short English translation. A long, strange-looking word is just a word you have not met yet.",
      themes: [
        { id: "german", title: "German", count: 6 },
        { id: "japanese", title: "Japanese", count: 5 },
        { id: "indian", title: "Hindi & Sanskrit", count: 6 },
        { id: "nordic", title: "Nordic", count: 3 },
        { id: "romance", title: "French, Italian, Spanish & Portuguese", count: 4 },
        { id: "world", title: "Across the world", count: 6 },
      ] },
    { id: "names", title: "Names & places", file: "packs-names.js",
      blurb: "British and Indian names and places that do not sound the way they look. Learn them once and you will never be caught out.",
      themes: [
        { id: "british-places", title: "British places", count: 9 },
        { id: "british-surnames", title: "British surnames", count: 4 },
        { id: "irish", title: "Irish names", count: 4 },
        { id: "indian-names", title: "Indian names", count: 5 },
        { id: "indian-places", title: "Indian places", count: 8 },
      ] },
  ];
  const info = (id) => INDEX.find((p) => p.id === id);
  const listName = (pack, theme) => `${pack.title} · ${theme.title}`;

  let app;
  const DATA = {};    // pack id -> { themeId: rows }, once loaded
  const ENTRIES = {}; // pack id -> Map(word -> full entry), once loaded
  const VERSION = typeof document !== "undefined" && document.currentScript && document.currentScript.src.includes("?") ? document.currentScript.src.split("?")[1] : "";

  // A row becomes the same entry shape the rest of the app already understands.
  function entryFor(packId, row) {
    const syllables = row.say ? row.say.split("|")[0].trim() : row.syl || "";
    return {
      word: row.w,
      hint: row.def,
      origin: row.o,
      ...(row.lang ? { lang: row.lang } : {}),
      pack: packId,
      meaning: `${row.pos} | ${row.def} | ${row.rel || ""}`,
      ...(row.say ? { sounds: row.say } : {}),
      ...(syllables ? { syllables } : {}),
      examples: row.ex.slice(),
    };
  }

  function register(id, themes) {
    DATA[id] = themes;
    const map = new Map();
    for (const rows of Object.values(themes)) for (const row of rows) map.set(row.w, entryFor(id, row));
    ENTRIES[id] = map;
    if (typeof Event !== "undefined") window.dispatchEvent(new Event("spellit-change")); // let anything showing these words refresh
  }

  // ---- keeping a word once ----
  const lookup = (packId, word) => (ENTRIES[packId] ? ENTRIES[packId].get(word) || null : null);
  // The full entries of one theme, in file order (empty until the pack has loaded).
  const themeWords = (packId, themeId) => (DATA[packId] && DATA[packId][themeId] ? DATA[packId][themeId].map((row) => ENTRIES[packId].get(row.w)) : []);
  const unset = (v) => v === undefined || v === null || v === "";

  // What to store for a word: just its name and pack, plus any field the learner changed.
  // A word whose pack is not loaded is stored in full, so nothing is ever lost.
  function slim(entry) {
    const full = entry && entry.pack ? lookup(entry.pack, entry.word) : null;
    if (!full) return entry;
    const out = { word: entry.word, pack: entry.pack };
    for (const [key, value] of Object.entries(entry)) {
      if (key === "word" || key === "pack" || unset(value)) continue;
      if (JSON.stringify(value) !== JSON.stringify(full[key])) out[key] = value;
    }
    return out;
  }

  // The full word again: the shipped details, with the learner's own changes on top.
  function hydrate(entry) {
    const full = entry && entry.pack ? lookup(entry.pack, entry.word) : null;
    if (!full) return entry;
    const merged = { ...full };
    for (const [key, value] of Object.entries(entry)) if (!unset(value)) merged[key] = value;
    return merged;
  }

  function lang(word) {
    for (const map of Object.values(ENTRIES)) {
      const hit = map.get(String(word).trim().toLowerCase());
      if (hit && hit.lang) return hit.lang;
    }
    return "";
  }

  // ---- loading ----
  const loading = {};
  function load(id) {
    if (DATA[id]) return Promise.resolve();
    if (loading[id]) return loading[id];
    const pack = info(id);
    if (!pack) return Promise.reject(new Error("Unknown word pack."));
    loading[id] = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = pack.file + (VERSION ? `?${VERSION}` : "");
      script.onload = () => resolve();
      script.onerror = () => { delete loading[id]; script.remove(); reject(new Error("Could not load these words. Check your connection and try again.")); };
      document.head.append(script);
    });
    return loading[id];
  }

  function markUsed(id) {
    try {
      const used = JSON.parse(localStorage.getItem(USED_KEY)) || [];
      if (!used.includes(id)) localStorage.setItem(USED_KEY, JSON.stringify([...used, id]));
    } catch (e) { /* storage unavailable: the pack simply loads when it is needed */ }
  }

  // After a backup, a sync or a first visit, words may refer to a pack this device has not loaded yet.
  let scanTimer = 0;
  function ensureStored() {
    const wanted = new Set(SpellLearning.packsInUse());
    const progress = app && typeof app.progress === "function" ? app.progress() : null;
    for (const rec of Object.values((progress && progress.srs) || {})) if (rec.entry && rec.entry.pack) wanted.add(rec.entry.pack);
    for (const id of wanted) {
      if (!info(id) || DATA[id]) continue;
      markUsed(id);
      load(id).catch(() => {}); // the words show in full again once they arrive (register() announces it)
    }
  }
  const scheduleScan = () => { clearTimeout(scanTimer); scanTimer = setTimeout(ensureStored, 600); };

  // ---- lists ----
  const findList = (name) => SpellLearning.lists().find((l) => l.name === name) || null;

  // Add entries to the list with this name (creating it), skipping words already in it, up to the
  // 100-word limit. Returns how many were new and where they went.
  function addToList(name, newEntries) {
    const existing = findList(name);
    const have = new Map((existing ? existing.entries : []).map((e) => [e.word, e]));
    let added = 0;
    for (const entry of newEntries) {
      if (have.has(entry.word) || have.size >= MAX_LIST) continue;
      have.set(entry.word, entry);
      added++;
    }
    const listId = SpellLearning.saveList(existing ? existing.id : null, name, [...have.values()]);
    return { listId, added, total: have.size, full: have.size >= MAX_LIST };
  }

  async function addTheme(packId, themeId) {
    await load(packId);
    const pack = info(packId), theme = pack.themes.find((t) => t.id === themeId);
    const result = addToList(listName(pack, theme), themeWords(packId, themeId));
    markUsed(packId);
    return result;
  }

  function practice(listId) {
    const list = SpellLearning.lists().find((l) => l.id === listId);
    if (!list || !list.entries.length) return;
    app.start(SpellLearning.seededOrder(list.entries, crypto.randomUUID()), { kind: "custom", title: list.name });
  }

  // ---- Learn tab ----
  const node = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const button = (text, className, onClick) => {
    const b = node("button", className, text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  };

  const openPacks = new Set(); // cards whose theme list is open, kept open when the cards redraw
  const notes = {};            // pack id -> last message

  function render() {
    const host = document.getElementById("packs-list");
    if (!host) return;
    host.replaceChildren();
    for (const pack of INDEX) {
      const total = pack.themes.reduce((n, t) => n + t.count, 0);
      const card = node("article", "pack-card");
      const head = node("div", "pack-head");
      head.append(node("h3", "", pack.title), node("span", "menu-badge", `${total} words`));
      const note = node("p", "pack-note", notes[pack.id] || "");
      note.setAttribute("role", "status");

      const missing = pack.themes.filter((t) => !findList(listName(pack, t)));
      const actions = node("div", "pack-actions");
      if (missing.length) {
        const label = missing.length === pack.themes.length ? `Add all ${pack.themes.length} lists` : `Add the other ${missing.length}`;
        actions.append(button(label, "btn btn-primary", async () => {
          try {
            for (const theme of missing) await addTheme(pack.id, theme.id);
            notes[pack.id] = `Added ${missing.length} ${missing.length === 1 ? "list" : "lists"} to My lists.`;
          } catch (error) { notes[pack.id] = error.message; }
          render();
        }));
      }

      const details = node("details", "pack-themes");
      details.open = openPacks.has(pack.id);
      details.addEventListener("toggle", () => { if (details.open) openPacks.add(pack.id); else openPacks.delete(pack.id); });
      details.append(node("summary", "", `Choose a theme (${pack.themes.length})`));
      for (const theme of pack.themes) {
        const list = findList(listName(pack, theme));
        const row = node("div", "pack-theme");
        const text = node("span", "pack-theme-text");
        text.append(node("strong", "", theme.title), node("small", "", `${theme.count} words`));
        row.append(text, list
          ? button("Practise", "btn btn-primary", () => practice(list.id))
          : button("Add", "btn btn-ghost", async () => {
            try { await addTheme(pack.id, theme.id); notes[pack.id] = `Added “${theme.title}” to My lists.`; } catch (error) { notes[pack.id] = error.message; }
            render();
          }));
        details.append(row);
      }
      card.append(head, node("p", "pack-blurb", pack.blurb), actions, details, note);
      host.append(card);
    }
  }

  function init(adapter) {
    app = adapter;
    window.addEventListener("spellit-change", () => { render(); scheduleScan(); });
    render();
    ensureStored();
  }

  if (window.SpellLearning && SpellLearning.setCodec) SpellLearning.setCodec({ slim, hydrate });
  window.SpellPacks = { init, render, register, load, INDEX, entryFor, addToList, addTheme, practice, slim, hydrate, lang, lookup, themeWords };
})();
