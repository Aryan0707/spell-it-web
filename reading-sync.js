// Reading progress in backups and sync. Pure rules, exported in Node for tests.
// The trainer keeps its progress in the browser (see sanitize in reading.js); this file turns that
// state into something safe to put in a backup, and merges two copies from two devices.
(() => {
  "use strict";

  const MAX_RESULTS = 100;
  const MAX_READ = 500;
  const ID_PATTERN = /^[A-Za-z0-9_-]{1,60}$/;
  const reading = () => (typeof window === "undefined" ? require("./reading.js") : window.SpellReading);

  // One result, rebuilt from known fields only. null when it cannot be trusted.
  function cleanResult(r) {
    if (!r || typeof r !== "object") return null;
    const levels = reading().LEVELS.length;
    if (!Number.isFinite(r.at) || r.at < 0 || !Number.isInteger(r.level) || r.level < 1 || r.level > levels) return null;
    if (!Number.isFinite(r.share) || r.share < 0 || r.share > 1) return null;
    return {
      at: r.at, level: r.level,
      passage: typeof r.passage === "string" && ID_PATTERN.test(r.passage) ? r.passage : "",
      wpm: Number.isFinite(r.wpm) && r.wpm >= 0 ? r.wpm : 0,
      share: r.share, passed: r.passed === true,
    };
  }

  // The canonical form: sanitized, only known fields, results oldest first, passage ids sorted.
  // Backups, snapshots and merges all end up here, so equal progress always looks identical.
  function clean(raw) {
    const base = reading().sanitize(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null);
    const results = (Array.isArray(raw?.results) ? raw.results : []).map(cleanResult).filter(Boolean);
    const byTime = new Map();
    for (const r of results) if (!byTime.has(r.at)) byTime.set(r.at, r);
    base.results = [...byTime.values()].sort((a, b) => a.at - b.at).slice(-MAX_RESULTS);
    const read = {};
    for (const id of Object.keys(base.read).filter((key) => ID_PATTERN.test(key)).sort().slice(0, MAX_READ)) read[id] = base.read[id];
    base.read = read;
    return base;
  }

  // A backup with a reading section must have a plain object there; anything inside is cleaned.
  function validate(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("The backup contains invalid reading data.");
    return clean(raw);
  }

  // Is there anything worth saving? Untouched trainers stay out of snapshots, so devices that have
  // never used the trainer keep producing the same backups as before.
  const hasProgress = (state) => state.results.length > 0 || Object.keys(state.read).length > 0 || Boolean(state.baseline);

  const newestAt = (state, level) => state.results.reduce((max, r) => (r.level === level ? Math.max(max, r.at) : max), -1);

  function merge(a, b) {
    if (!a && !b) return null;
    const left = clean(a), right = clean(b);
    if (!a) return right;
    if (!b) return left;
    const R = reading();
    const out = clean({ results: [...left.results, ...right.results] });
    for (const id of new Set([...Object.keys(left.read), ...Object.keys(right.read)])) out.read[id] = Math.max(left.read[id] || 0, right.read[id] || 0);
    out.unlocked = Math.max(left.unlocked, right.unlocked);
    // The starting speed is the first passing read of level 1, from whichever device it happened on.
    const first = out.results.find((r) => r.level === 1 && r.passed && r.wpm > 0 && r.wpm <= R.MAX_WPM);
    if (first) out.baseline = R.sanitize({ baseline: first.wpm }).baseline;
    else if (left.baseline && right.baseline) out.baseline = Math.min(left.baseline, right.baseline);
    else out.baseline = left.baseline || right.baseline || null;
    // A level's pace follows whichever device read that level most recently.
    for (const level of R.LEVELS) {
      const x = left.targets[level.n], y = right.targets[level.n];
      if (x === undefined && y === undefined) continue;
      if (x === undefined || y === undefined) { out.targets[level.n] = x === undefined ? y : x; continue; }
      const dx = newestAt(left, level.n), dy = newestAt(right, level.n);
      out.targets[level.n] = dx > dy ? x : dy > dx ? y : Math.max(x, y);
    }
    // One more pass through sanitize: unlocked drops back to 1 if there is still no baseline.
    return clean(out);
  }

  const api = { clean, validate, merge, hasProgress, cleanResult };
  if (typeof window === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    return;
  }
  window.SpellReadingSync = api;
})();
