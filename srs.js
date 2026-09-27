// Spaced-review scheduling.
//
// Pure functions, no DOM. Exposed on window.SpellSRS in the browser and via
// module.exports in Node for tests. Callers pass explicit `now` (ms) and a
// canIncrementMastery(word, rec) predicate so this module never touches the
// clock or coach state itself.

(function (root) {
  const MASTERY_REPS = 3;
  const DEFAULT_EASE = 2.5;
  const MIN_EASE = 1.3;
  const MAX_EASE = 3.2;
  const EASE_BONUS = 0.05;
  const EASE_PENALTY = 0.2;
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

  // Return a NEW record (does not mutate `rec`).
  //   rec        — existing SRS record or undefined
  //   wasClean   — true for a first-try, unassisted correct answer
  //   now        — Date.now() (ms)
  //   canBumpMastery(word, rec) — predicate, true unless it's a same-day repeat
  //   word       — the SRS key, only used for the mastery predicate
  function schedule({ rec, wasClean, now, word, canBumpMastery }) {
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

  function isMastered(rec) {
    return !!rec && rec.reps >= MASTERY_REPS;
  }

  const api = {
    MASTERY_REPS,
    DEFAULT_EASE,
    MIN_EASE,
    MAX_EASE,
    MAX_INTERVAL_DAYS,
    DAY_MS,
    makeRecord,
    schedule,
    weight,
    isDue,
    isMastered,
    overdueDays,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SpellSRS = api;
})(typeof window !== "undefined" ? window : null);
