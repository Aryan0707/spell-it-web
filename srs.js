// Spaced-review scheduling.
//
// Pure functions, no DOM. Exposed on window.SpellSRS in the browser and via
// module.exports in Node for tests. Callers pass explicit `now` (ms) and a
// canIncrementMastery(word, rec) predicate so this module never touches the
// clock or coach state itself.

(function (root) {
  // Two tiers. "Learned" is the early milestone: clean recalls on three different days.
  // "Mastered" also needs the review interval to have reached three weeks, which means the
  // word was recalled correctly after a ~8-day gap and is now scheduled well beyond it.
  const LEARNED_REPS = 3;
  const MASTERED_INTERVAL_DAYS = 21;
  const DEFAULT_EASE = 2.5;
  const MIN_EASE = 1.3;
  const MAX_EASE = 3.2;
  const EASE_BONUS = 0.05;
  const EASE_PENALTY = 0.2;
  // A one-letter slip is a lapse, not a blank: halve the penalty, keep half the reps.
  const NEAR_MISS_EASE_PENALTY = 0.1;
  // On a 3-letter word one edit is a third of the word, so it is not "nearly right".
  const NEAR_MISS_MIN_LENGTH = 5;
  const MAX_INTERVAL_DAYS = 90;
  const DAY_MS = 86400000;

  function makeRecord() {
    return { reps: 0, interval: 0, ease: DEFAULT_EASE };
  }

  function nextIntervalDays(reps, currentInterval, ease) {
    if (reps <= 1) return 1;
    if (reps === 2) return 3;
    return Math.min(MAX_INTERVAL_DAYS, Math.round((currentInterval || 1) * ease));
  }

  // True when `a` and `b` differ by exactly one insertion, deletion, substitution or swap of
  // two adjacent letters (so "recieve" is one edit from "receive").
  function isOneEditApart(a, b) {
    if (a === b) return false;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0;
    while (i < la && i < lb && a[i] === b[i]) i++;
    if (la === lb) {
      if (a.slice(i + 1) === b.slice(i + 1)) return true;
      return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
    }
    const [long, short] = la > lb ? [a, b] : [b, a];
    return long.slice(i + 1) === short.slice(i);
  }

  // True when every wrong attempt at `word` was a single slip away from it. One far-off
  // attempt (or a timeout string) makes the whole round an ordinary miss.
  function isNearMiss(word, attempts) {
    const target = String(word || "").trim().toLowerCase();
    if (target.length < NEAR_MISS_MIN_LENGTH || !Array.isArray(attempts) || !attempts.length) return false;
    return attempts.every((a) => typeof a === "string" && isOneEditApart(target, a.trim().toLowerCase()));
  }

  // Return a NEW record (does not mutate `rec`).
  //   rec        — existing SRS record or undefined
  //   wasClean   — true for a first-try, unassisted correct answer
  //   nearMiss   — for a non-clean result: the slip was one letter, with no hint used
  //   now        — Date.now() (ms)
  //   canBumpMastery(word, rec) — predicate, true unless it's a same-day repeat
  //   word       — the SRS key, only used for the mastery predicate
  function schedule({ rec, wasClean, nearMiss, now, word, canBumpMastery }) {
    const base = rec ? { ...rec } : makeRecord();
    if (base.ease === undefined) base.ease = DEFAULT_EASE;

    if (wasClean) {
      const bump = typeof canBumpMastery === "function" ? canBumpMastery(word, base) : true;
      if (bump) {
        base.reps += 1;
        base.interval = nextIntervalDays(base.reps, base.interval, base.ease);
        base.ease = Math.min(MAX_EASE, base.ease + EASE_BONUS);
        base.dueAt = now + base.interval * DAY_MS;
      }
      // Same-day repeat: schedule stays exactly where it was.
    } else if (nearMiss) {
      base.reps = Math.floor(base.reps / 2);
      base.interval = 1;
      base.ease = Math.max(MIN_EASE, base.ease - NEAR_MISS_EASE_PENALTY);
      base.dueAt = now + DAY_MS;
    } else {
      base.reps = 0;
      base.interval = 0;
      base.ease = Math.max(MIN_EASE, base.ease - EASE_PENALTY);
      base.dueAt = now;
    }
    base.updatedAt = now;
    return base;
  }

  function isDue(rec, now) {
    return !!rec && rec.dueAt <= now;
  }

  function overdueDays(rec, now) {
    if (!isDue(rec, now)) return 0;
    return (now - rec.dueAt) / DAY_MS;
  }

  // Weight for picking which word to practise next.
  function weight(rec, now) {
    if (!rec) return 1;
    if (isDue(rec, now)) return 4 + Math.min(overdueDays(rec, now), 10);
    return 0.2;
  }

  function isLearned(rec) {
    return !!rec && rec.reps >= LEARNED_REPS;
  }

  // Learned is a prerequisite so a record synced from elsewhere with a long interval but
  // too few reps is not counted.
  function isMastered(rec) {
    return isLearned(rec) && rec.interval >= MASTERED_INTERVAL_DAYS;
  }

  const api = {
    LEARNED_REPS,
    MASTERED_INTERVAL_DAYS,
    NEAR_MISS_MIN_LENGTH,
    DEFAULT_EASE,
    MIN_EASE,
    MAX_EASE,
    MAX_INTERVAL_DAYS,
    DAY_MS,
    makeRecord,
    schedule,
    weight,
    isDue,
    isLearned,
    isMastered,
    isNearMiss,
    overdueDays,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SpellSRS = api;
})(typeof window !== "undefined" ? window : null);
