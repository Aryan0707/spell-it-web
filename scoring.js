// Pure scoring + distractor rules for Spell It.
// No DOM, no localStorage, no clock. Exposed as window.SpellScoring in the browser and
// via module.exports in Node so tests can hold these rules without a browser.
//
// WHY THIS FILE EXISTS
// Two rules that were previously implicit in app.js:
//
// 1. RECALL GATING. Only a mode where the learner PRODUCES the spelling may advance
//    spaced-repetition mastery. Letter tiles require ordering real letters; typing
//    requires generating them. Multiple choice only requires RECOGNISING the word
//    among four options, which is not spelling and must never promote a word to
//    Learned or Mastered. Before this, a choice answer fed wasClean:true into
//    SRS.schedule(), so a learner who never typed the word reached "Mastered" in
//    four passes (reps 1/2/3/4, interval 1/3/8/21 days).
//
// 2. RULE-AWARE DISTRACTORS. A distractor for a word tagged ie_ei must be the
//    classic misspelling that rule produces (receive -> recieve). Randomly doubling
//    or dropping an unrelated letter tests nothing: the wrong option is wrong for a
//    reason the learner was never taught. Words with no rule fall back to the
//    original corruption heuristic.

(function (root) {
  "use strict";

  // Modes where the learner constructs the spelling themselves.
  const RECALL_MODES = ["tiles", "type"];

  // True when this answer mode may advance SRS mastery.
  // `tiles` counts: assembling the tile rack is genuine, effortful recall.
  // `choice` does not: it is recognition.
  function isRecallMode(answerMode) {
    return RECALL_MODES.indexOf(answerMode) !== -1;
  }

  // Decide the scoring outcome of one round.
  //   answerMode — "tiles" | "type" | "choice"
  //   hadError   — learner made at least one wrong attempt this round
  //   assisted   — learner revealed any hint
  // Returns { independent, countsForRecall, neutral, assisted, hadError }.
  //
  // `independent` keeps its original meaning for the session score and streak: a
  // first-try, unassisted correct answer. That drives the visible "Correct" count,
  // so a choice answer still scores.
  //
  // `countsForRecall` is the narrower gate the SRS scheduler consults, so recognition
  // can raise your score but never your mastery.
  //
  // `neutral` marks a CORRECT recognition: it carries no recall evidence at all, so the
  // scheduler must leave the word exactly as it was — not advance it, and not punish it.
  function scoreRound({ answerMode, hadError, assisted }) {
    const independent = !hadError && !assisted;
    const recall = isRecallMode(answerMode);
    return {
      independent,
      assisted: !!assisted,
      hadError: !!hadError,
      countsForRecall: independent && recall,
      // Correct, unassisted, but produced by recognition rather than recall.
      neutral: independent && !recall,
    };
  }

  // ---------- rule-aware distractor generation ----------

  // The classic misspelling each rule teaches about, expressed as an edit over the
  // word. Each entry returns candidate strings; empty result falls through to the
  // generic corruption heuristic.
  const RULE_MUTATIONS = {
    // receive -> recieve, believe -> beleive, friend -> freind
    ie_ei: (word) => {
      const out = [];
      // Swap an "ie"/"ei" pair for its opposite.
      out.push(word.replace(/ie/, "ei").replace(/ei/, "ie") === word ? word.replace(/([aei])([ae])/, "$2$1") : word.replace(/ie/, "ei").replace(/ei/, "ie"));
      // i-before-e broken into the wrong order at each eligible position.
      const m = /([a-z])i([a-z])e([a-z])/g;
      let hit;
      while ((hit = m.exec(word))) out.push(word.slice(0, hit.index) + hit[1] + "ei" + hit[3] + word.slice(hit.index + 4));
      return out;
    },
    // necessary -> neccessary / necesary, tomorrow -> tommorow, embarrass -> embarass
    double_consonant: (word) => {
      const out = [];
      // Drop ONE letter of an existing double. Slice from d.index + 1 so the second
      // copy survives — slicing from + 2 removes both ("necessary" -> "neceary").
      const d = /([a-z])\1/.exec(word);
      if (d) out.push(word.slice(0, d.index + 1) + word.slice(d.index + 2));
      // Double a single consonant mid-word. Capture group is 1, and the match index
      // is where the letter sits; insert a copy right after it.
      const s = /([bcdfglmnprstz])(?=[a-z]{2})/g;
      let hit;
      while ((hit = s.exec(word))) {
        out.push(word.slice(0, hit.index + 1) + hit[1] + word.slice(hit.index + 1));
        break; // one doubling option is enough
      }
      return out;
    },
    // though -> thow, knowledge -> nowledge, rhythm -> rithm
    silent_letter: (word) => {
      const out = [];
      const patterns = [
        [/^kn/, "n"], [/^wr/, "r"], [/^gn/, "n"], [/^ps/, "s"],
        [/mb$/, ""], [/^rhythm/, "ythm"], [/mn$/, "m"], [/gh/, ""], [/^sc(?=[ei])/, "s"],
      ];
      for (const [re, rep] of patterns) if (re.test(word)) out.push(word.replace(re, rep));
      // Drop the consonant right before a silent terminal "e".
      if (/[^aeiou][a-z]e$/.test(word)) out.push(word.replace(/([a-z])e$/, ""));
      return out;
    },
    // definitely -> definitly / definitelly, environment -> enviroment / environmant
    tricky_ending: (word) => {
      const out = [];
      const n = word.length;
      // The taught rule is "the ending isn't spelled the way it sounds", so the
      // canonical slips drop or double a letter inside the final syllable.
      // Positions run over the last 5 letters: the ending, not the stem.
      const start = Math.max(1, n - 5);
      for (let i = start; i < n - 1; i++) out.push(word.slice(0, i) + word.slice(i + 1));
      for (let i = start; i < n; i++) out.push(word.slice(0, i) + word[i] + word.slice(i));
      // Familiar ending swaps that produce a real near-word.
      const pairs = [
        [/ery$/, "ary"], [/ary$/, "ery"],
        [/ous$/, "us"], [/ment$/, "mant"], [/ent$/, "ant"], [/ant$/, "ent"],
        [/ful$/, "full"], [/ly$/, "ley"], [/ence$/, "ance"], [/ance$/, "ence"],
      ];
      for (const [re, rep] of pairs) if (re.test(word)) out.push(word.replace(re, rep));
      return out;
    },
    // separate -> seperate, calendar -> calender, evening -> evning
    vowel_confusion: (word) => {
      const out = [];
      // The taught rule is "look closely at each vowel". Offer ONE option per vowel
      // position: the most likely confusion for that vowel. That is exactly the class
      // of slip the rule names, and it makes separate -> seperate (the 'a' -> 'e').
      // Emitting every alternative vowel per position buries the canonical slip under
      // noise, because buildDistractors keeps only the first three.
      const CONFUSE = { a: "e", e: "a", i: "e", o: "a", u: "o" };
      for (let i = 0; i < word.length; i++) {
        const to = CONFUSE[word[i]];
        if (to) out.push(word.slice(0, i) + to + word.slice(i + 1));
      }
      // Drop a silent medial vowel: evening -> evning, beautiful -> beatiful.
      const mv = /([a-z]{2})[aeiou](?=[a-z]{2}(?:ing|ed|ful|ly)\b)/.exec(word);
      if (mv) out.push(word.slice(0, mv.index + 2) + word.slice(mv.index + 3));
      return out;
    },
  };

  // Generic heuristic for words with no `rule` tag (custom lists, AI words).
  // Random swap / double / drop / vowel-change.
  //
  // The vowel branch picks a DIFFERENT vowel by construction. An earlier version used
  // `do { repl = vowels[floor(rand() * 5)] } while (repl === w[i])`, which spins forever
  // when the RNG keeps returning the current letter's index — e.g. word "rain" with a
  // constant 0.5 generator. Never put an unbounded retry loop in the answer path.
  function corruptWord(word, rand) {
    const r = rand || Math.random;
    const w = word.split("");
    const vowels = "aeiou";
    const i = Math.floor(r() * w.length);
    const type = Math.floor(r() * 4);
    if (type === 0 && w.length > 3) {
      const j = Math.min(i + 1, w.length - 1);
      [w[i], w[j]] = [w[j], w[i]];
    } else if (type === 1) {
      w.splice(i, 0, w[i]);
    } else if (type === 2 && w.length > 4) {
      w.splice(i, 1);
    } else if (vowels.indexOf(w[i]) !== -1) {
      // Offset from the current vowel by a non-zero step mod 5: always different.
      const from = vowels.indexOf(w[i]);
      const step = 1 + Math.floor(r() * (vowels.length - 1));
      w[i] = vowels[(from + step) % vowels.length];
    } else {
      w.splice(i, 0, w[i]);
    }
    return w.join("");
  }

  function isSane(candidate, word) {
    return typeof candidate === "string"
      && candidate !== word
      && /^[a-z]{2,24}$/.test(candidate)
      && Math.abs(candidate.length - word.length) <= 4;
  }

  // Build `count` wrong options for one round.
  //   entry — { word, rule? }
  //   rand  — injectable RNG (0..1), so tests are deterministic
  // Rule-tagged words yield that rule's classic misspellings first; anything left is
  // filled by the generic heuristic. Never returns the word itself or a duplicate.
  function buildDistractors(entry, count, rand) {
    const word = String(entry.word || "").toLowerCase();
    const r = rand || Math.random;
    const seen = { [word]: true };
    const result = [];

    const push = (c) => {
      const v = typeof c === "string" ? c.toLowerCase() : c;
      if (result.length < count && isSane(v, word) && !seen[v]) { seen[v] = true; result.push(v); }
    };

    const rule = entry.rule && RULE_MUTATIONS[entry.rule];
    if (rule) for (const c of rule(word)) push(c);

    let attempts = 0;
    while (result.length < count && attempts < 40) {
      attempts++;
      push(corruptWord(word, r));
    }
    // Last-resort filler keeps the option count correct for very short words.
    while (result.length < count) {
      const filler = word + "e".repeat(result.length + 1);
      if (!seen[filler]) { seen[filler] = true; result.push(filler); } else break;
    }
    return result;
  }

  const api = {
    RECALL_MODES,
    isRecallMode,
    scoreRound,
    buildDistractors,
    corruptWord,
    RULE_MUTATIONS,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SpellScoring = api;
})(typeof window !== "undefined" ? window : null);