// Spell Coach: personalised session planning, adaptive levelling, mistake feedback,
// same-day mastery protection, and progress analytics. Load after words.js, before app.js.
(() => {
  "use strict";

  const COACH_KEY = "spellit_coach_v2";

  // Inject coach stylesheet (browser only)
  (function injectCoachCSS() {
    if (typeof document === "undefined" || !document.createElement) return;
    if (document.getElementById("coach-css")) return;
    const link = document.createElement("link");
    link.id = "coach-css";
    link.rel = "stylesheet";
    link.href = "coach.css?v=22";
    document.head.appendChild(link);
  })();

  // ---------- level system ----------
  // 0 = unassessed, 1 = beginner, 2 = easy, 3 = medium, 4 = hard, 5 = expert
  const LEVEL_NAMES = ["unassessed", "beginner", "easy", "medium", "hard", "expert"];
  const DIFFICULTY_ORDER = ["beginner", "easy", "medium", "hard", "expert"];

  function loadCoach() {
    try {
      const raw = localStorage.getItem(COACH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Normalise: merge with defaults so missing fields don't break.
        const base = defaultCoach();
        const merged = { ...base, ...parsed };
        // Validate critical fields.
        if (typeof merged.level !== "number" || merged.level < 0 || merged.level > 5) merged.level = base.level;
        if (!Array.isArray(merged.recentPerformance)) merged.recentPerformance = base.recentPerformance;
        if (!Array.isArray(merged.levelHistory)) merged.levelHistory = base.levelHistory;
        if (typeof merged.lastMasteryDates !== "object" || Array.isArray(merged.lastMasteryDates)) merged.lastMasteryDates = base.lastMasteryDates;
        if (typeof merged.dailyMasteryIncrements !== "object" || Array.isArray(merged.dailyMasteryIncrements)) merged.dailyMasteryIncrements = base.dailyMasteryIncrements;
        if (typeof merged.firstTryCorrect !== "number") merged.firstTryCorrect = base.firstTryCorrect;
        if (typeof merged.firstTryTotal !== "number") merged.firstTryTotal = base.firstTryTotal;
        if (typeof merged.sessionsSinceAssess !== "number") merged.sessionsSinceAssess = base.sessionsSinceAssess;
        return merged;
      }
    } catch { /* fall through to default */ }
    return defaultCoach();
  }

  function defaultCoach() {
    return {
      level: 0,                // assessed level, 0 = not yet assessed
      assessmentDone: false,
      assessmentWords: [],     // words used in last assessment
      assessmentResults: {},   // word -> clean|assisted|wrong
      recentPerformance: [],   // last 20 results: { clean: bool, level: number, at: timestamp }
      firstTryCorrect: 0,      // running count of first-try unassisted correct
      firstTryTotal: 0,        // running count of total first attempts
      sessionsSinceAssess: 0,
      lastMasteryDates: {},    // word -> last date (YYYY-MM-DD) mastery rep was incremented
      dailyMasteryIncrements: {}, // date -> words that got a mastery rep that day
      levelHistory: [],        // [{ from: level, to: level, at: timestamp, reason: "..." }]
    };
  }

  function saveCoach(state) {
    localStorage.setItem(COACH_KEY, JSON.stringify(state));
  }

  let coach = loadCoach();

  // ---------- level assessment ----------
  // Pick one word from each difficulty, return 5-word assessment set
  function assessmentWords(wordList, variantFn) {
    const seen = new Set();
    const words = [];
    for (const diff of DIFFICULTY_ORDER) {
      const candidates = wordList.filter(w => w.difficulty === diff && !seen.has(w.word));
      if (!candidates.length) continue;
      // Pick a representative word: prefer ones with rules, medium length
      candidates.sort((a, b) => {
        const aScore = (a.rule ? 1 : 0) + (a.word.length >= 5 && a.word.length <= 10 ? 1 : 0);
        const bScore = (b.rule ? 1 : 0) + (b.word.length >= 5 && b.word.length <= 10 ? 1 : 0);
        return bScore - aScore || a.word.length - b.word.length;
      });
      const entry = variantFn ? variantFn(candidates[0]) : candidates[0];
      words.push(entry);
      seen.add(entry.word);
    }
    return words;
  }

  // Determine level from assessment results.
  // Must earn each level: the word AT that level must be clean and unassisted,
  // AND at least half of all words at or below that level must be clean.
  function assessLevel(results) {
    // results: { word: { clean: bool, assisted: bool } }
    // Build a difficulty-ordered list of assessment words with their results.
    const ordered = DIFFICULTY_ORDER
      .map(diff => {
        const entry = WORD_LIST.find(e => e.difficulty === diff && results[e.word]);
        if (!entry) return null;
        const r = results[entry.word];
        return { word: entry.word, difficulty: diff, clean: r.clean && !r.assisted };
      })
      .filter(Boolean);

    let bestLevel = 0;
    for (let level = 1; level <= ordered.length; level++) {
      const atThisLevel = ordered[level - 1];
      // Must have the word at this exact level correct.
      if (!atThisLevel || !atThisLevel.clean) break;
      // And at least half of all words up to this level must be correct.
      const atOrBelow = ordered.slice(0, level);
      const correct = atOrBelow.filter(w => w.clean).length;
      if (correct >= Math.ceil(atOrBelow.length * 0.5)) {
        bestLevel = level;
      } else {
        break; // can't advance further if cumulative ratio fails
      }
    }
    return Math.max(1, bestLevel); // never stay at 0 after assessment
  }

  function getLevel() { return coach.level; }
  function getLevelName() { return LEVEL_NAMES[coach.level] || "beginner"; }
  function isAssessed() { return coach.assessmentDone; }

  function setLevel(level, reason) {
    const from = coach.level;
    coach.level = Math.max(1, Math.min(5, level));
    if (from !== coach.level) {
      coach.levelHistory.push({ from, to: coach.level, at: Date.now(), reason });
      if (coach.levelHistory.length > 20) coach.levelHistory = coach.levelHistory.slice(-20);
    }
    saveCoach(coach);
  }

  function didAssessment() {
    return coach.assessmentDone;
  }

  function recordAssessment(words, results) {
    coach.assessmentWords = words.map(w => w.word);
    coach.assessmentResults = results;
    coach.assessmentDone = true;
    coach.level = assessLevel(results);
    coach.levelHistory.push({ from: 0, to: coach.level, at: Date.now(), reason: "Initial assessment" });
    saveCoach(coach);
  }

  // ---------- session planning ----------
  // Priority: due reviews > weak words > fresh words at appropriate level
  function planSession(sessionLength, progress, wordList, variantFn, options = {}) {
    const entries = [];
    const seen = new Set();
    const now = Date.now();

    // Helper: look up a canonical entry for a word, applying variant only to fresh words.
    function lookupEntry(word) {
      return wordList.find(w => w.word === word || (w.variants && Object.values(w.variants).includes(word)));
    }

    // 1. Due SRS reviews (most overdue first)
    // Preserve the EXACT practised spelling from the SRS key — do NOT re-apply variantFn.
    const dueWords = Object.entries(progress.srs || {})
      .filter(([, rec]) => rec.dueAt <= now)
      .sort((a, b) => a[1].dueAt - b[1].dueAt)
      .map(([word, rec]) => {
        const canonical = rec.entry || lookupEntry(word) || {};
        // Use the SRS key as the authoritative spelling; strip planning metadata.
        return { ...canonical, word, _source: "due" };
      });

    for (const entry of dueWords) {
      if (entries.length >= sessionLength) break;
      if (!seen.has(entry.word)) {
        entries.push(entry);
        seen.add(entry.word);
      }
    }

    // 2. Weak words (high miss count > 0, not yet mastered)
    if (entries.length < sessionLength) {
      const mastered = new Set(
        Object.entries(progress.srs || {})
          .filter(([, rec]) => rec.reps >= 3)
          .map(([w]) => w)
      );
      const weakWords = Object.entries(progress.missed || {})
        .filter(([word, count]) => count > 0 && !seen.has(word) && !mastered.has(word))
        .sort((a, b) => b[1] - a[1])
        .slice(0, sessionLength - entries.length)
        .map(([word]) => {
          const rec = progress.srs?.[word];
          const canonical = rec?.entry || lookupEntry(word) || {};
          // Preserve the exact SRS key as the spelling.
          return { ...canonical, word, _source: "weak" };
        });

      for (const entry of weakWords) {
        if (entries.length >= sessionLength) break;
        if (!seen.has(entry.word)) {
          entries.push(entry);
          seen.add(entry.word);
        }
      }
    }

    // 3. Fresh words at appropriate level
    if (entries.length < sessionLength) {
      const targetLevel = coach.level || 1;
      // Get difficulty band: target level ± 1, weighted toward target
      const activeLevels = new Set();
      activeLevels.add(DIFFICULTY_ORDER[targetLevel - 1] || "beginner");
      if (targetLevel > 1) activeLevels.add(DIFFICULTY_ORDER[targetLevel - 2]);
      if (targetLevel < 5) activeLevels.add(DIFFICULTY_ORDER[targetLevel]);

      // Collect fresh words: not in SRS yet, not recently seen
      const freshWords = wordList
        .map(e => variantFn ? variantFn(e) : e)
        .filter(w => !seen.has(w.word) && !progress.srs?.[w.word] && activeLevels.has(w.difficulty));

      // Shuffle deterministically with date seed for variety
      const seeded = seededShuffle(freshWords, new Date().toISOString().slice(0, 10));
      const strongFirst = [
        ...seeded.filter(w => w.difficulty === DIFFICULTY_ORDER[targetLevel - 1]),
        ...seeded.filter(w => w.difficulty !== DIFFICULTY_ORDER[targetLevel - 1]),
      ];

      for (const entry of strongFirst) {
        if (entries.length >= sessionLength) break;
        if (!seen.has(entry.word)) {
          entries.push({ ...entry, _source: "fresh" });
          seen.add(entry.word);
        }
      }

      // Fallback: if we still need words, grab from active levels first,
      // then any level — but prioritise lower difficulties for safety.
      if (entries.length < sessionLength) {
        const fallbackPool = wordList
          .map(e => variantFn ? variantFn(e) : e)
          .filter(w => !seen.has(w.word));
        // Sort by difficulty proximity to target level, then shuffle within bands.
        const byProximity = [...fallbackPool].sort((a, b) => {
          const aIdx = DIFFICULTY_ORDER.indexOf(a.difficulty);
          const bIdx = DIFFICULTY_ORDER.indexOf(b.difficulty);
          return Math.abs(aIdx - (targetLevel - 1)) - Math.abs(bIdx - (targetLevel - 1));
        });
        // Take from closest difficulty bands first.
        const closest = byProximity.filter(w =>
          Math.abs(DIFFICULTY_ORDER.indexOf(w.difficulty) - (targetLevel - 1)) <= 1
        );
        const rest = byProximity.filter(w =>
          Math.abs(DIFFICULTY_ORDER.indexOf(w.difficulty) - (targetLevel - 1)) > 1
        );
        const combined = shuffleArray([...closest]).concat(shuffleArray([...rest]));
        for (const entry of combined) {
          if (entries.length >= sessionLength) break;
          entries.push(entry);
          seen.add(entry.word);
        }
      }
    }

    // Strip internal planning metadata before returning.
    const cleanEntries = entries.slice(0, sessionLength).map(({ _source, ...rest }) => rest);

    return {
      entries: cleanEntries,
      breakdown: {
        due: entries.filter(e => e._source === "due").length,
        weak: entries.filter(e => e._source === "weak").length,
        fresh: entries.filter(e => e._source === "fresh" || !e._source).length,
      },
    };
  }

  // ---------- adaptive level adjustment ----------
  function recordResult(word, entry, wasClean, wasAssisted, firstAttempt) {
    // Use the entry's actual difficulty, not the coach's current level.
    // This prevents easy review repeats from advancing expert difficulty.
    const entryLevel = entry && entry.difficulty
      ? (DIFFICULTY_ORDER.indexOf(entry.difficulty) + 1)
      : coach.level;
    coach.recentPerformance.push({
      word,
      clean: wasClean && !wasAssisted,
      level: entryLevel,
      at: Date.now(),
    });
    if (coach.recentPerformance.length > 30) {
      coach.recentPerformance = coach.recentPerformance.slice(-30);
    }
    if (firstAttempt) {
      coach.firstTryTotal++;
      if (wasClean && !wasAssisted) coach.firstTryCorrect++;
    }
    coach.sessionsSinceAssess++;
    saveCoach(coach);
    maybeAdjustLevel();
  }

  function maybeAdjustLevel() {
    const recent = coach.recentPerformance.slice(-20);
    if (recent.length < 10) return;

    const cleanRate = recent.filter(r => r.clean).length / recent.length;

    // Level up: >80% clean on first-attempt unassisted for last 10+ words at current level
    if (cleanRate >= 0.8 && coach.level < 5 && recent.length >= 10) {
      const atCurrentLevel = recent.filter(r => r.level === coach.level);
      if (atCurrentLevel.length >= 8 && atCurrentLevel.filter(r => r.clean).length / atCurrentLevel.length >= 0.8) {
        setLevel(coach.level + 1, `Consistent ${Math.round(cleanRate * 100)}% accuracy at ${LEVEL_NAMES[coach.level]}`);
      }
    }

    // Level down: <40% clean for last 10+ words
    if (cleanRate < 0.4 && coach.level > 1 && recent.length >= 10) {
      const atCurrentLevel = recent.filter(r => r.level === coach.level);
      if (atCurrentLevel.length >= 6 && atCurrentLevel.filter(r => r.clean).length / atCurrentLevel.length < 0.4) {
        setLevel(coach.level - 1, `Struggling at ${LEVEL_NAMES[coach.level]} — ${Math.round(cleanRate * 100)}% accuracy`);
      }
    }
  }

  // ---------- same-day mastery protection ----------
  function canIncrementMastery(word, srsRecord) {
    // Check that the last mastery increment was on a different calendar day
    const today = dayKey();
    const lastDate = coach.lastMasteryDates[word];

    if (!lastDate) {
      // First time: allow
      coach.lastMasteryDates[word] = today;
      coach.dailyMasteryIncrements[today] = coach.dailyMasteryIncrements[today] || [];
      if (!coach.dailyMasteryIncrements[today].includes(word)) {
        coach.dailyMasteryIncrements[today].push(word);
      }
      saveCoach(coach);
      return true;
    }

    if (lastDate === today) {
      // Same day: do NOT increment mastery
      // But still record this was a clean recall for stats
      return false;
    }

    // Different day: allow
    coach.lastMasteryDates[word] = today;
    coach.dailyMasteryIncrements[today] = coach.dailyMasteryIncrements[today] || [];
    if (!coach.dailyMasteryIncrements[today].includes(word)) {
      coach.dailyMasteryIncrements[today].push(word);
    }
    saveCoach(coach);
    return true;
  }

  function getWordsMasteredToday() {
    const today = dayKey();
    return coach.dailyMasteryIncrements[today] || [];
  }

  function dayKey(date) {
    const d = date ? new Date(date) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // ---------- mistake feedback ----------
  // Compare attempted and correct strings using edit-distance alignment.
  // Returns highlighted DOM-safe HTML diff with accurate mistake positions.
  function diffSpelling(correct, attempted) {
    if (!attempted) return { html: `<span class="coach-correct">${esc(correct)}</span>`, mistakes: correct.length };
    const c = correct.toLowerCase();
    const a = attempted.toLowerCase();

    // Compute Levenshtein distance matrix.
    const m = c.length, n = a.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (c[i - 1] === a[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    // Backtrack to build aligned result.
    const result = [];
    const mistakes = [];
    let i = m, j = n;
    const revOps = []; // reverse-order operations

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && c[i - 1] === a[j - 1]) {
        revOps.push({ type: "match", c: c[i - 1], pos: i - 1 });
        i--; j--;
      } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
        // substitution
        revOps.push({ type: "sub", correct: c[i - 1], attempted: a[j - 1], pos: i - 1 });
        i--; j--;
      } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
        // insertion in attempted (extra char)
        revOps.push({ type: "ins", attempted: a[j - 1], pos: i });
        j--;
      } else {
        // deletion from correct (missing char)
        revOps.push({ type: "del", correct: c[i - 1], pos: i - 1 });
        i--;
      }
    }

    // Build HTML forward.
    for (let k = revOps.length - 1; k >= 0; k--) {
      const op = revOps[k];
      switch (op.type) {
        case "match":
          // Collect consecutive matches into runs.
          let run = "";
          while (k >= 0 && revOps[k].type === "match") {
            run = revOps[k].c + run;
            k--;
          }
          k++; // overshot
          result.push(`<span class="coach-match">${esc(run)}</span>`);
          break;
        case "sub":
          result.push(`<span class="coach-wrong">${esc(op.attempted)}</span>`);
          result.push(`<span class="coach-correct-char">${esc(op.correct)}</span>`);
          mistakes.push({ pos: op.pos, correct: op.correct, attempted: op.attempted });
          break;
        case "ins":
          result.push(`<span class="coach-extra">${esc(op.attempted)}</span>`);
          mistakes.push({ pos: op.pos, correct: "", attempted: op.attempted });
          break;
        case "del":
          result.push(`<span class="coach-missing">${esc(op.correct)}</span>`);
          mistakes.push({ pos: op.pos, correct: op.correct, attempted: "" });
          break;
      }
    }

    return { html: result.join(""), mistakes };
  }

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Generate a mnemonic tip for a word
  function getMnemonic(word, entry) {
    // Curated mnemonics for common tricky words
    const curated = CURATED_MNEMONICS[word.toLowerCase()];
    if (curated) return curated;

    // Build an honest tip from the word structure
    const tips = [];

    // Check for double letters
    const doubles = word.match(/([a-z])\1/g);
    if (doubles) {
      for (const d of doubles) {
        tips.push(`Remember the double '${d[0]}' — two of them, right next to each other.`);
      }
    }

    // Check for silent letters — only at word start where they're actually silent.
    const silentPatterns = [
      { pattern: /^kn/i, hint: "The 'k' is silent in 'kn' at the start — your mouth doesn't say it, but your pen must." },
      { pattern: /^gn/i, hint: "The 'g' is silent in 'gn' at the start — a sneaky letter that hides when you speak." },
      { pattern: /^wr/i, hint: "The 'w' is silent in 'wr' — it's there on paper but not in your voice." },
      { pattern: /mb$/i, hint: "The 'b' at the end is silent — don't let your ears fool you." },
      { pattern: /gh/i, hint: "The 'gh' can be silent or sound like 'f' — check which one this is." },
    ];
    for (const { pattern, hint: silentHint } of silentPatterns) {
      if (pattern.test(word) && !tips.some(t => t.includes("silent"))) {
        tips.push(silentHint);
        break;
      }
    }

    // Check for vowel patterns
    if (/ie/.test(word) && !tips.length) tips.push("i before e — picture it: i then e.");
    if (/ei/.test(word) && !tips.length) tips.push("e before i — an exception to the usual rule. Say 'ee-eye' to remember.");

    // Check for tricky endings
    const endings = [
      { pattern: "tion", hint: "It's t-i-o-n, not t-i-o-n-g. The 'n' closes it quietly." },
      { pattern: "sion", hint: "s-i-o-n — think 'vision' to remember the s." },
      { pattern: "able", hint: "a-b-l-e — if you can do it, it's 'able'." },
      { pattern: "ible", hint: "i-b-l-e — fewer words use this ending. Think 'possible'." },
      { pattern: "ough", hint: "'ough' has many sounds — this one you just need to memorise." },
    ];
    for (const { pattern, hint: endHint } of endings) {
      if (word.toLowerCase().endsWith(pattern) && !tips.length) {
        tips.push(endHint);
        break;
      }
    }

    // Build a visualisation tip
    if (!tips.length) {
      tips.push(`Name each letter as you copy it: ${word.toUpperCase().split("").join(" · ")}. Then cover the word and try from memory.`);
    }

    return tips.slice(0, 2).join(" ");
  }

  function getFeedbackHTML(word, attempt, entry) {
    const diff = diffSpelling(word, attempt);
    const mnemonic = getMnemonic(word, entry);

    let html = `<div class="coach-feedback">`;
    html += `<div class="coach-word">Correct spelling: <strong>${esc(word)}</strong></div>`;
    if (attempt && attempt !== "(timeout)" && attempt !== "Skipped") {
      html += `<div class="coach-diff">Your answer: ${diff.html}</div>`;
    }
    html += `<div class="coach-tip">💡 ${esc(mnemonic)}</div>`;
    html += `</div>`;
    return html;
  }

  // ---------- progress stats ----------
  function getStats(progress, srs, coachData) {
    const c = coachData || coach;
    const now = Date.now();
    const today = dayKey();

    // First-try accuracy
    const firstTryAccuracy = c.firstTryTotal > 0
      ? Math.round((c.firstTryCorrect / c.firstTryTotal) * 100)
      : null;

    // Words recalled on later days: the SRS record's updatedAt is on a different
    // calendar day than when the word was first seen.  Use lastMasteryDates as the
    // trustworthy cross-device source; fall back to SRS updatedAt for legacy data.
    let recalledLater = 0;
    const srsEntries = Object.entries(srs || progress.srs || {});
    for (const [word, rec] of srsEntries) {
      const masteryDate = c.lastMasteryDates?.[word];
      if (masteryDate) {
        // Word was mastered (or at least had a clean recall) on masteryDate.
        // Check if it has been practised on a later day.
        if (rec.updatedAt && dayKey(rec.updatedAt) !== masteryDate) {
          recalledLater++;
        }
      } else if (rec.interval > 0 && rec.updatedAt) {
        // Legacy: no mastery date available.  Conservatively count only when
        // the word has been reviewed on multiple days according to updatedAt
        // vs the first-recorded date (proxied by the dueAt calculation).
        // A word with interval>0 AND reps>=2 has survived at least one spacing gap.
        if (rec.reps >= 2) recalledLater++;
      }
    }

    // Words mastered (reps >= 3)
    const mastered = Object.values(srs || progress.srs || {})
      .filter(rec => rec.reps >= 3).length;

    // Words practiced (ever appeared in SRS)
    const totalPracticed = Object.keys(srs || progress.srs || {}).length;

    // Due today
    const dueToday = Object.values(srs || progress.srs || {})
      .filter(rec => rec.dueAt <= now).length;

    // Today's mastery increments
    const masteredToday = (c.dailyMasteryIncrements?.[today] || []).length;

    // Sessions completed
    const sessions = progress.sessionsCompleted || 0;

    // Current level
    const level = c.level || 0;
    const levelName = LEVEL_NAMES[level] || "unassessed";

    return {
      firstTryAccuracy,
      recalledLater,
      mastered,
      totalPracticed,
      dueToday,
      masteredToday,
      sessions,
      level,
      levelName,
      isAssessed: c.assessmentDone || false,
    };
  }

  // ---------- helpers ----------
  function seededShuffle(arr, seed) {
    const hash = str => { let n = 2166136261; for (const char of str) { n ^= char.charCodeAt(0); n = Math.imul(n, 16777619); } return n >>> 0; };
    const result = [...arr];
    let h = hash(seed);
    for (let i = result.length - 1; i > 0; i--) {
      h = hash(h.toString() + i);
      const j = h % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- curated mnemonics ----------
  const CURATED_MNEMONICS = {
    "because": "Big Elephants Can Always Understand Small Elephants — the first letters spell 'because'.",
    "beautiful": "Big Elephants Are Ugly? That's Impossible! It ends with just one 'l': b-e-a-u-t-i-f-u-l.",
    "necessary": "Never Eat Crisps, Eat Salad Sandwiches And Remain Young — one 'c', two 's's.",
    "separate": "There's 'a rat' in sep-a-rat-e — don't spell it 'seperate'.",
    "definitely": "If you spell it with an 'a', the 'nite' will be finite — de-finite-ly.",
    "friend": "A friend is there 'fri' till the 'end' — i before e, then 'end'.",
    "believe": "Never believe a lie — i before e, with 'lie' hidden inside.",
    "receive": "i before e except after c — 'receive' follows the rule after 'c'.",
    "rhythm": "Rhythm Helps Your Two Hips Move — the first letters give you the consonants.",
    "restaurant": "Rest‑au‑rant: the 'au' is French, like 'restaurant' in Paris.",
    "tomorrow": "Tom or row? One 'm', two 'r's — tom‑or‑row.",
    "vacuum": "Vac‑u‑um: two 'u's, like a U‑shaped vacuum hose.",
    "weird": "It's weird because it breaks the i‑before‑e rule — w‑e‑i‑r‑d.",
    "embarrass": "Two 'r's and two 's's — you might feel embarrassed if you forget one.",
    "occasion": "Two 'c's and one 's' — oc‑ca‑sion, like an 'occasion' for cake.",
    "accommodate": "Two 'c's and two 'm's — big enough to accommodate all those letters.",
    "environment": "En‑vi‑ron‑ment: 'ron' is in the middle, not 'ronm' or 'roin'.",
    "government": "Govern‑ment: the 'n' is silent-ish but always there.",
    "experience": "Ex‑pe‑ri‑ence: don't forget the 'ri' in the middle.",
    "calendar": "Cal‑en‑dar: 'dar' at the end, not 'der' — think 'day' → 'dar'.",
    "schedule": "Sch‑ed‑ule: the 'sch' is like 'school' — same start.",
    "pronunciation": "Pro‑nun‑ci‑a‑tion: the 'nun' is like a nun in a church, not 'noun'.",
    "maintenance": "Main‑ten‑ance: 'ten' in the middle, not 'tain' — think of 'ten' people in maintenance.",
    "mischievous": "Mis‑chie‑vous: three syllables, not four — 'chie' like 'chief'.",
    "silhouette": "Sil‑hou‑ette: think of a 'silent hou‑ette' — the 'h' is silent.",
    "camouflage": "Cam‑ou‑flage: the 'ou' is French — like 'you' said in a French accent.",
    "bureaucracy": "Bureau‑cracy: a 'bureau' is a desk — French, with 'eau'.",
    "conscience": "Con‑science: science of right and wrong — 'science' is the second half.",
  };

  // ---------- reset ----------
  function reset() {
    coach = defaultCoach();
    saveCoach(coach);
  }

  // ---------- snapshot/merge support ----------
  function getCoachData() { return { ...coach }; }
  function replaceCoachData(data) { coach = { ...defaultCoach(), ...data }; saveCoach(coach); }

  window.SpellCoach = {
    getLevel, getLevelName, isAssessed, didAssessment, setLevel,
    assessmentWords, assessLevel, recordAssessment,
    planSession, recordResult, maybeAdjustLevel,
    canIncrementMastery, getWordsMasteredToday,
    diffSpelling, getMnemonic, getFeedbackHTML,
    getStats,
    getCoachData, replaceCoachData, reset,
    dayKey,
    LEVEL_NAMES, DIFFICULTY_ORDER,
  };
})();
