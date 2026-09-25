// Learning records, portable backups, and deterministic daily challenges.
(() => {
  "use strict";
  const KEY = "spellit_learning_v1";
  const wordPattern = /^[a-z]{2,24}$/;
  const copy = value => JSON.parse(JSON.stringify(value));
  const empty = () => ({ version: 1, resetAt: 0, lists: {}, notebook: {}, daily: {}, sessions: {}, legacySessions: 0 });
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || empty(); } catch { state = empty(); }
  for (const key of ["lists", "notebook", "daily", "sessions"]) state[key] ||= {};
  const id = () => crypto.randomUUID();
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  function persist() {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("spellit-change"));
  }
  function parseWords(text) {
    const entries = [], errors = [], seen = new Set();
    for (const [i, line] of text.split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      // Plain comma-separated words, or one word | definition | syllables per line.
      const pieces = line.includes("|") ? [line] : line.split(/[,;\s]+/);
      for (const piece of pieces.filter(p => p.trim())) {
        const [raw, hint = "", syllables = ""] = piece.split("|").map(s => s.trim());
        const word = raw.toLowerCase();
        if (!wordPattern.test(word)) { errors.push(`Line ${i + 1}: “${raw.slice(0, 30)}” needs 2–24 letters, without spaces or punctuation.`); continue; }
        if (syllables && (syllables.replace(/-/g, "").toLowerCase() !== word || !/^[a-z]+(?:-[a-z]+)*$/i.test(syllables))) {
          errors.push(`Line ${i + 1}: syllables must join to spell “${word}”.`); continue;
        }
        if (seen.has(word)) continue;
        seen.add(word);
        const known = WORD_LIST.find(w => w.word === word || Object.values(w.variants || {}).includes(word));
        entries.push({ ...(known || {}), word, hint: hint.slice(0, 240) || known?.hint || "", syllables: syllables.toLowerCase() || known?.syllables || "" });
      }
    }
    if (entries.length > 100) errors.push("Keep each list to 100 words or fewer.");
    if (!entries.length && !errors.length) errors.push("Add at least one word.");
    return { entries: entries.slice(0, 100), errors };
  }
  function saveList(listId, name, entries) {
    if (!name.trim()) throw new Error("Give your list a name.");
    if (!listId && lists().length >= 50) throw new Error("You can save up to 50 lists.");
    listId ||= id();
    state.lists[listId] = { id: listId, name: name.trim().slice(0, 60), entries: copy(entries), updatedAt: Date.now(), deleted: false };
    persist();
    return listId;
  }
  const lists = () => Object.values(state.lists).filter(l => !l.deleted).sort((a, b) => b.updatedAt - a.updatedAt);
  function deleteList(listId) {
    if (!state.lists[listId]) return;
    state.lists[listId] = { ...state.lists[listId], deleted: true, updatedAt: Date.now() };
    persist();
  }
  function recordAttempt(entry, attempt) {
    const rec = state.notebook[entry.word] || { word: entry.word, attempts: [], note: "", noteAt: 0 };
    rec.entry = copy(entry);
    rec.attempts.push({ id: id(), text: attempt || "Skipped", at: Date.now() });
    rec.attempts = rec.attempts.slice(-20);
    rec.updatedAt = Date.now();
    state.notebook[entry.word] = rec;
    persist();
  }
  function saveNote(word, note) {
    if (!state.notebook[word]) return;
    state.notebook[word].note = note.slice(0, 500);
    state.notebook[word].noteAt = Date.now();
    persist();
  }
  function seededOrder(entries, seed) {
    const hash = str => { let n = 2166136261; for (const char of str) { n ^= char.charCodeAt(0); n = Math.imul(n, 16777619); } return n >>> 0; };
    return [...entries].sort((a, b) => hash(seed + a.word) - hash(seed + b.word) || a.word.localeCompare(b.word));
  }
  function dailyPlan(progress, variant, date = dayKey()) {
    if (state.daily[date]) return state.daily[date];
    const due = Object.entries(progress.srs).filter(([, rec]) => rec.dueAt <= Date.now()).sort((a, b) => a[1].dueAt - b[1].dueAt).slice(0, 2)
      .map(([word, rec]) => ({ ...(rec.entry || WORD_LIST.find(w => w.word === word) || {}), word }));
    const seen = new Set(due.map(w => w.word));
    const fresh = seededOrder(WORD_LIST.map(variant).filter(w => !seen.has(w.word) && !progress.srs[w.word]), date);
    const fallback = seededOrder(WORD_LIST.map(variant).filter(w => !seen.has(w.word)), date);
    const words = [...due];
    for (const entry of [...fresh, ...fallback]) {
      if (words.length === 5) break;
      if (!seen.has(entry.word)) { words.push(entry); seen.add(entry.word); }
    }
    state.daily[date] = { date, words, reviewCount: due.length, results: {}, completedAt: 0, updatedAt: Date.now() };
    persist();
    return state.daily[date];
  }
  function dailyResult(date, entry, result) {
    const plan = state.daily[date];
    if (!plan || plan.completedAt) return;
    plan.results[entry.word] = { ...result, at: Date.now() };
    if (plan.words.every(w => plan.results[w.word])) plan.completedAt = Date.now();
    plan.updatedAt = Date.now();
    persist();
  }
  function completeSession(sessionId, result, legacyCount) {
    // Preserve old totals once; new sessions merge by ID across devices.
    state.legacySessions = Math.max(state.legacySessions || 0, legacyCount - Object.keys(state.sessions).length - 1, 0);
    state.sessions[sessionId] = { ...result, at: Date.now() };
    persist();
  }
  function reset() { state = { ...empty(), resetAt: Date.now() }; persist(); }
  function latest(a, b, key = "updatedAt") {
    if (!a) return b;
    if (!b) return a;
    const delta = (a[key] || 0) - (b[key] || 0);
    return delta > 0 || (delta === 0 && JSON.stringify(a) >= JSON.stringify(b)) ? a : b;
  }
  function mergeMap(a = {}, b = {}, merge = latest) {
    return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map(key => [key, merge(a[key], b[key])]));
  }
  function mergeSnapshots(a, b) {
    if ((a.learning.resetAt || 0) !== (b.learning.resetAt || 0)) return copy(a.learning.resetAt > b.learning.resetAt ? a : b);
    const learning = empty();
    learning.resetAt = a.learning.resetAt || 0;
    learning.lists = mergeMap(a.learning.lists, b.learning.lists);
    learning.sessions = mergeMap(a.learning.sessions, b.learning.sessions, (x, y) => latest(x, y, "at"));
    learning.notebook = mergeMap(a.learning.notebook, b.learning.notebook, (x, y) => {
      if (!x || !y) return x || y;
      const notes = latest(x, y, "noteAt");
      const attempts = [...new Map([...x.attempts, ...y.attempts].map(item => [item.id, item])).values()].sort((c, d) => c.at - d.at || c.id.localeCompare(d.id)).slice(-20);
      return { ...latest(x, y), note: notes.note, noteAt: notes.noteAt, attempts };
    });
    learning.daily = mergeMap(a.learning.daily, b.learning.daily, (x, y) => {
      if (!x || !y) return x || y;
      const plan = latest(x, y);
      const results = mergeMap(x.results, y.results, (c, d) => latest(c, d, "at"));
      const completedAt = plan.words.every(w => results[w.word]) ? Math.max(x.completedAt, y.completedAt, ...Object.values(results).map(r => r.at)) : 0;
      return { ...plan, results, completedAt };
    });
    learning.legacySessions = Math.max(a.learning.legacySessions || 0, b.learning.legacySessions || 0,
      (a.progress.sessionsCompleted || 0) - Object.keys(a.learning.sessions).length,
      (b.progress.sessionsCompleted || 0) - Object.keys(b.learning.sessions).length);
    const srs = mergeMap(a.progress.srs, b.progress.srs);
    const progress = {
      bestStreak: Math.max(a.progress.bestStreak, b.progress.bestStreak), curStreak: 0,
      learned: [...new Set([...a.progress.learned, ...b.progress.learned])].sort(), srs,
      missed: mergeMap(a.progress.missed, b.progress.missed, (x, y) => Math.max(x || 0, y || 0)),
      patternMistakes: mergeMap(a.progress.patternMistakes, b.progress.patternMistakes, (x, y) => Math.max(x || 0, y || 0)),
      sessionsCompleted: learning.legacySessions + Object.keys(learning.sessions).length,
    };
    // Merge coach data: use latest assessment state (by level), merge mastery dates
    // conservatively (keep the earlier date so same-day protection is maintained),
    // and merge recentPerformance by ID (at timestamp + word) to avoid double-counting.
    let coach = null;
    if (a.coach || b.coach) {
      const ca = a.coach || {}, cb = b.coach || {};
      const useA = (ca.level || 0) >= (cb.level || 0) && (ca.assessmentDone || !cb.assessmentDone);
      coach = {
        level: useA ? (ca.level || 0) : (cb.level || 0),
        assessmentDone: ca.assessmentDone || cb.assessmentDone || false,
        assessmentWords: useA ? (ca.assessmentWords || []) : (cb.assessmentWords || []),
        assessmentResults: useA ? (ca.assessmentResults || {}) : (cb.assessmentResults || {}),
        firstTryCorrect: Math.max(ca.firstTryCorrect || 0, cb.firstTryCorrect || 0),
        firstTryTotal: Math.max(ca.firstTryTotal || 0, cb.firstTryTotal || 0),
        sessionsSinceAssess: Math.max(ca.sessionsSinceAssess || 0, cb.sessionsSinceAssess || 0),
        // Merge lastMasteryDates: keep the EARLIER date to preserve same-day protection.
        lastMasteryDates: mergeMap(ca.lastMasteryDates || {}, cb.lastMasteryDates || {},
          (x, y) => (!x || !y) ? (x || y) : (x < y ? x : y)),
        // Merge dailyMasteryIncrements: union per date, deduplicate words.
        dailyMasteryIncrements: (() => {
          const merged = {};
          for (const src of [ca.dailyMasteryIncrements || {}, cb.dailyMasteryIncrements || {}]) {
            for (const [date, words] of Object.entries(src)) {
              if (!merged[date]) merged[date] = [];
              for (const w of words) if (!merged[date].includes(w)) merged[date].push(w);
            }
          }
          return merged;
        })(),
        // Merge levelHistory: deduplicate by from/to/at, keep both sides' events.
        levelHistory: (() => {
          const seen = new Set();
          const merged = [];
          for (const h of [...(ca.levelHistory || []), ...(cb.levelHistory || [])]) {
            const key = `${h.from}|${h.to}|${h.at}`;
            if (!seen.has(key)) { seen.add(key); merged.push(h); }
          }
          return merged.sort((x, y) => (x.at || 0) - (y.at || 0)).slice(-30);
        })(),
        // Merge recentPerformance: deduplicate by (word + at) to avoid double-counting.
        recentPerformance: (() => {
          const seen = new Set();
          const merged = [];
          for (const perf of [...(ca.recentPerformance || []), ...(cb.recentPerformance || [])]) {
            const key = `${perf.word}|${perf.at}`;
            if (!seen.has(key)) { seen.add(key); merged.push(perf); }
          }
          return merged.sort((x, y) => (x.at || 0) - (y.at || 0)).slice(-30);
        })(),
      };
    }
    const result = copy({ format: "spellit-backup", version: 1, progress, learning });
    if (coach) result.coach = coach;
    return result;
  }
  function validateSnapshot(raw) {
    // Reject unknown fields/credentials rather than storing arbitrary imported objects.
    if (!raw || raw.format !== "spellit-backup" || raw.version !== 1) throw new Error("This is not a supported Spell It backup.");
    if (JSON.stringify(raw).length > 1_500_000) throw new Error("This backup is too large.");
    function object(value, allowed) {
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => ["__proto__", "prototype", "constructor"].includes(k) || (allowed && !allowed.includes(k)))) throw new Error("The backup contains invalid data.");
    }
    function num(value) { if (!Number.isFinite(value) || value < 0) throw new Error("The backup contains an invalid number."); }
    function str(value, max) { if (typeof value !== "string" || value.length > max) throw new Error("The backup contains invalid text."); }
    function word(value) { if (typeof value !== "string" || !wordPattern.test(value)) throw new Error("The backup contains an invalid word."); }
    function entry(e) {
      object(e, ["word", "hint", "syllables", "difficulty", "category", "rule", "variants", "sentence"]); word(e.word);
      for (const k of ["hint", "sentence", "syllables", "difficulty", "category", "rule"]) if (e[k] !== undefined) str(e[k], 500);
      if (e.variants) { object(e.variants); for (const v of Object.values(e.variants)) word(v); }
    }
    object(raw, ["format", "version", "progress", "learning", "coach", "exportedAt"]);
    const p = raw.progress, l = raw.learning;
    object(p, ["bestStreak", "curStreak", "learned", "missed", "srs", "sessionsCompleted", "patternMistakes"]);
    for (const k of ["bestStreak", "curStreak", "sessionsCompleted"]) num(p[k]);
    if (!Array.isArray(p.learned)) throw new Error("Missing learned words.");
    p.learned.forEach(word);
    for (const k of ["missed", "patternMistakes"]) { object(p[k]); Object.values(p[k]).forEach(num); }
    object(p.srs);
    for (const [w, r] of Object.entries(p.srs)) {
      word(w); object(r, ["reps", "interval", "ease", "dueAt", "entry", "updatedAt", "assistedReviews"]);
      for (const k of ["reps", "interval", "dueAt"]) num(r[k]);
      if (r.ease !== undefined) num(r.ease);
      if (r.updatedAt !== undefined) num(r.updatedAt);
      if (r.assistedReviews !== undefined) num(r.assistedReviews);
      if (r.entry) entry(r.entry);
    }
    object(l, ["version", "resetAt", "lists", "notebook", "daily", "sessions", "legacySessions"]);
    if (l.version !== 1) throw new Error("Unsupported learning data version.");
    num(l.resetAt); num(l.legacySessions || 0);
    for (const k of ["lists", "notebook", "daily", "sessions"]) object(l[k]);
    for (const [listId, list] of Object.entries(l.lists)) {
      object(list, ["id", "name", "entries", "updatedAt", "deleted"]); str(list.id, 100); str(list.name, 60); num(list.updatedAt);
      if (list.id !== listId) throw new Error("Invalid word list identifier.");
      if (typeof list.deleted !== "boolean" || !Array.isArray(list.entries) || list.entries.length > 100) throw new Error("Invalid word list.");
      list.entries.forEach(entry);
    }
    for (const [w, rec] of Object.entries(l.notebook)) {
      word(w); object(rec, ["word", "entry", "attempts", "note", "noteAt", "updatedAt"]); entry(rec.entry); str(rec.note, 500); num(rec.noteAt); num(rec.updatedAt);
      if (rec.word !== w || rec.entry.word !== w) throw new Error("Invalid notebook word.");
      if (!Array.isArray(rec.attempts) || rec.attempts.length > 20) throw new Error("Invalid notebook attempts.");
      for (const a of rec.attempts) { object(a, ["id", "text", "at"]); str(a.id, 100); str(a.text, 100); num(a.at); }
    }
    for (const [date, plan] of Object.entries(l.daily)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid challenge date.");
      object(plan, ["date", "words", "reviewCount", "results", "completedAt", "updatedAt"]);
      if (!Array.isArray(plan.words) || plan.words.length !== 5) throw new Error("Invalid daily challenge.");
      if (plan.date !== date || new Set(plan.words.map(w => w.word)).size !== 5) throw new Error("Invalid daily challenge words.");
      plan.words.forEach(entry); num(plan.reviewCount); num(plan.completedAt); num(plan.updatedAt); object(plan.results);
      for (const [w, r] of Object.entries(plan.results)) { word(w); object(r, ["clean", "assisted", "at"]); num(r.at); if (typeof r.clean !== "boolean" || typeof r.assisted !== "boolean") throw new Error("Invalid daily result."); }
    }
    for (const rec of Object.values(l.sessions)) {
      object(rec, ["at", "independent", "assisted", "total"]);
      for (const field of ["at", "independent", "assisted", "total"]) num(rec[field]);
      if (rec.independent + rec.assisted > rec.total) throw new Error("Invalid session totals.");
    }
    // Validate optional coach field (backward-compatible: absent coach is fine).
    if (raw.coach !== undefined) {
      const c = raw.coach;
      object(c, ["level", "assessmentDone", "assessmentWords", "assessmentResults",
        "recentPerformance", "firstTryCorrect", "firstTryTotal", "sessionsSinceAssess",
        "lastMasteryDates", "dailyMasteryIncrements", "levelHistory"]);
      if (typeof c.level !== "number" || c.level < 0 || c.level > 5) throw new Error("Invalid coach level.");
      if (typeof c.assessmentDone !== "boolean") throw new Error("Invalid coach assessment flag.");
      if (!Array.isArray(c.assessmentWords)) throw new Error("Invalid coach assessment words.");
      c.assessmentWords.forEach(w => word(w));
      if (c.assessmentResults) {
        object(c.assessmentResults);
        for (const [w, r] of Object.entries(c.assessmentResults)) {
          word(w); object(r, ["clean", "assisted"]);
          if (typeof r.clean !== "boolean" || typeof r.assisted !== "boolean") throw new Error("Invalid coach assessment result.");
        }
      }
      if (!Array.isArray(c.recentPerformance) || c.recentPerformance.length > 50) throw new Error("Invalid coach recent performance.");
      for (const perf of c.recentPerformance) {
        object(perf, ["word", "clean", "level", "at"]);
        word(perf.word);
        if (typeof perf.clean !== "boolean") throw new Error("Invalid coach performance entry.");
        num(perf.level); num(perf.at);
      }
      num(c.firstTryCorrect); num(c.firstTryTotal); num(c.sessionsSinceAssess);
      if (c.lastMasteryDates) {
        if (typeof c.lastMasteryDates !== "object" || Array.isArray(c.lastMasteryDates)) throw new Error("Invalid coach mastery dates.");
        for (const [w, d] of Object.entries(c.lastMasteryDates)) { word(w); str(d, 10); }
      }
      if (c.dailyMasteryIncrements) {
        if (typeof c.dailyMasteryIncrements !== "object" || Array.isArray(c.dailyMasteryIncrements)) throw new Error("Invalid coach daily increments.");
        for (const [date, words] of Object.entries(c.dailyMasteryIncrements)) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid coach daily increment date.");
          if (!Array.isArray(words) || words.length > 100) throw new Error("Invalid coach daily increment list.");
          words.forEach(w => word(w));
        }
      }
      if (!Array.isArray(c.levelHistory) || c.levelHistory.length > 30) throw new Error("Invalid coach level history.");
      for (const h of c.levelHistory) {
        object(h, ["from", "to", "at", "reason"]);
        num(h.from); num(h.to); num(h.at); str(h.reason || "", 200);
      }
    }
    return copy(raw);
  }
  function snapshot(progress) {
    const snap = { format: "spellit-backup", version: 1, progress: copy(progress), learning: copy(state) };
    if (window.SpellCoach) snap.coach = window.SpellCoach.getCoachData();
    return snap;
  }
  function replace(value) { state = copy(value); persist(); }
  window.SpellLearning = { get: () => copy(state), snapshot, replace, parseWords, saveList, deleteList, lists, recordAttempt, saveNote, dailyPlan, dailyResult, completeSession, dayKey, seededOrder, mergeSnapshots, validateSnapshot, reset };
})();
