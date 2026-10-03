// Scoring rules: recall gating and rule-aware distractors.
// These lock the two behaviours that previously let a multiple-choice answer
// promote a word to "Mastered", and that generated distractors unrelated to the
// word's spelling rule.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Scoring = require(path.join(__dirname, "..", "scoring.js"));
const SRS = require(path.join(__dirname, "..", "srs.js"));

const DAY = SRS.DAY_MS;
const T0 = 1_700_000_000_000;
const alwaysBump = () => true;

// ---------- recall gating ----------

test("tiles count as recall: arranging the rack is genuine production", () => {
  const r = Scoring.scoreRound({ answerMode: "tiles", hadError: false, assisted: false });
  assert.equal(r.countsForRecall, true);
  assert.equal(r.independent, true);
});

test("typed answers count as recall", () => {
  const r = Scoring.scoreRound({ answerMode: "type", hadError: false, assisted: false });
  assert.equal(r.countsForRecall, true);
});

test("multiple choice is recognition: scores, but never advances mastery", () => {
  const r = Scoring.scoreRound({ answerMode: "choice", hadError: false, assisted: false });
  assert.equal(r.independent, true, "still counts toward the visible session score");
  assert.equal(r.countsForRecall, false, "must never advance spaced repetition");
  assert.equal(r.neutral, true, "a correct recognition carries no recall evidence at all");
});

test("a recalled answer is never neutral", () => {
  for (const mode of ["tiles", "type"]) {
    const r = Scoring.scoreRound({ answerMode: mode, hadError: false, assisted: false });
    assert.equal(r.neutral, false, mode + " must carry recall evidence");
  }
});

test("a failed round is a miss, not neutral", () => {
  const r = Scoring.scoreRound({ answerMode: "choice", hadError: true, assisted: false });
  assert.equal(r.neutral, false, "a wrong answer is real evidence and must count against");
});

test("a wrong choice answer is neither independent nor recall", () => {
  const r = Scoring.scoreRound({ answerMode: "choice", hadError: true, assisted: false });
  assert.equal(r.independent, false);
  assert.equal(r.countsForRecall, false);
});

test("a hinted recall attempt scores but does not advance mastery", () => {
  const r = Scoring.scoreRound({ answerMode: "type", hadError: false, assisted: true });
  assert.equal(r.independent, false);
  assert.equal(r.countsForRecall, false);
});

// THE REGRESSION: four perfect multiple-choice passes must NOT reach Mastered.
test("four perfect choice rounds never reach Mastered (the original bug)", () => {
  const word = "necessary";
  let rec;
  for (let i = 0; i < 4; i++) {
    const outcome = Scoring.scoreRound({ answerMode: "choice", hadError: false, assisted: false });
    rec = SRS.schedule({
      rec,
      // This is the wiring app.js must use, not `independent`.
      wasClean: outcome.countsForRecall,
      neutral: outcome.neutral,
      now: T0 + i * DAY * 40,
      word,
      canBumpMastery: alwaysBump,
    });
  }
  assert.equal(rec.reps, 0, "recognition must not build repetition count");
  assert.equal(rec.interval, 0);
  assert.equal(rec.ease, SRS.DEFAULT_EASE, "recognition must not raise ease");
  assert.equal(SRS.isLearned(rec), false);
  assert.equal(SRS.isMastered(rec), false);
});

test("recognition neither destroys mastery the learner already earned", () => {
  // A learner masters "cat" by typing it, then meets it in multiple choice.
  // The recognition must leave that earned state intact — not reset it, not advance it.
  let rec;
  for (let i = 0; i < 4; i++) {
    const o = Scoring.scoreRound({ answerMode: "type", hadError: false, assisted: false });
    rec = SRS.schedule({ rec, wasClean: o.countsForRecall, neutral: o.neutral, now: T0 + i * DAY * 40, word: "cat", canBumpMastery: alwaysBump });
  }
  assert.equal(SRS.isMastered(rec), true);
  const earned = JSON.parse(JSON.stringify(rec));

  for (let i = 0; i < 6; i++) {
    const o = Scoring.scoreRound({ answerMode: "choice", hadError: false, assisted: false });
    rec = SRS.schedule({ rec, wasClean: o.countsForRecall, neutral: o.neutral, now: T0 + (10 + i) * DAY * 40, word: "cat", canBumpMastery: alwaysBump });
  }
  assert.deepEqual(
    { reps: rec.reps, interval: rec.interval, ease: rec.ease },
    { reps: earned.reps, interval: earned.interval, ease: earned.ease },
    "six correct multiple-choice rounds must not change a mastered word"
  );
  assert.equal(SRS.isMastered(rec), true);
});

test("a neutral round is still stamped as reviewed (updatedAt moves)", () => {
  const earned = SRS.schedule({ rec: undefined, wasClean: true, now: T0, word: "cat", canBumpMastery: alwaysBump });
  const after = SRS.schedule({ rec: earned, wasClean: false, neutral: true, now: T0 + 999, word: "cat", canBumpMastery: alwaysBump });
  assert.equal(after.updatedAt, T0 + 999);
});

test("four perfect typed rounds DO reach Mastered (fix does not break the real path)", () => {
  const word = "necessary";
  let rec;
  for (let i = 0; i < 4; i++) {
    const outcome = Scoring.scoreRound({ answerMode: "type", hadError: false, assisted: false });
    rec = SRS.schedule({ rec, wasClean: outcome.countsForRecall, now: T0 + i * DAY * 40, word, canBumpMastery: alwaysBump });
  }
  assert.equal(SRS.isLearned(rec), true);
  assert.equal(SRS.isMastered(rec), true);
});

test("tiles and type reach the same mastery state as each other", () => {
  const build = (mode) => {
    let rec;
    for (let i = 0; i < 4; i++) {
      const o = Scoring.scoreRound({ answerMode: mode, hadError: false, assisted: false });
      rec = SRS.schedule({ rec, wasClean: o.countsForRecall, now: T0 + i * DAY * 40, word: "cat", canBumpMastery: alwaysBump });
    }
    return rec;
  };
  assert.deepEqual(build("tiles"), build("type"));
});

// ---------- rule-aware distractors ----------

test("ie_ei words offer the classic ie/ei swap", () => {
  const d = Scoring.buildDistractors({ word: "receive", rule: "ie_ei" }, 3);
  assert.ok(d.includes("recieve"), "expected recieve in " + JSON.stringify(d));
  assert.ok(!d.includes("receive"), "never offer the answer as a distractor");
});

test("double_consonant words offer a dropped or doubled letter", () => {
  // Classic slips: necesary (one s) / neccessary (doubled c).
  const d = Scoring.buildDistractors({ word: "necessary", rule: "double_consonant" }, 3);
  assert.ok(d.includes("necesary"), "expected necesary in " + JSON.stringify(d));
  const imm = Scoring.buildDistractors({ word: "immediately", rule: "double_consonant" }, 3);
  assert.ok(imm.includes("imediately"), "expected imediately in " + JSON.stringify(imm));
});

test("silent_letter words drop the silent letter", () => {
  const d = Scoring.buildDistractors({ word: "knowledge", rule: "silent_letter" }, 3);
  assert.ok(d.includes("nowledge"), "expected nowledge in " + JSON.stringify(d));
});

test("tricky_ending words drop or double a letter in the ending", () => {
  // The taught rule is "the ending isn't spelled the way it sounds", so the canonical
  // slips are definitly (dropped i) and definitelly (doubled l).
  const d = Scoring.buildDistractors({ word: "definitely", rule: "tricky_ending" }, 3);
  assert.ok(d.includes("definitly"), "expected definitly in " + JSON.stringify(d));
  const env = Scoring.buildDistractors({ word: "environment", rule: "tricky_ending" }, 3);
  assert.ok(env.includes("enviroment"), "expected enviroment in " + JSON.stringify(env));
});

test("vowel_confusion words use the taught open/close pair", () => {
  const d = Scoring.buildDistractors({ word: "separate", rule: "vowel_confusion" }, 3);
  assert.ok(d.includes("seperate"), "expected seperate in " + JSON.stringify(d));
});

test("distractors never contain the answer and never repeat", () => {
  const rules = ["ie_ei", "double_consonant", "silent_letter", "tricky_ending", "vowel_confusion"];
  const words = {
    ie_ei: ["smile", "believe", "receive", "different", "achieve", "friend"],
    double_consonant: ["necessary", "immediately", "occasion", "embarrass", "tomorrow", "beginner"],
    silent_letter: ["though", "rhythm", "knowledge", "island", "climb", "write"],
    tricky_ending: ["definitely", "environment", "jewelry", "library", "schedule", "weather"],
    vowel_confusion: ["separate", "calendar", "vacuum", "evening", "teacher", "difficult"],
  };
  for (const rule of rules) {
    for (const word of words[rule]) {
      const d = Scoring.buildDistractors({ word, rule }, 3, () => 0.42);
      assert.ok(!d.includes(word), `${word} offered itself as a distractor`);
      assert.equal(new Set(d).size, d.length, `${word} produced a duplicate: ${d}`);
      assert.ok(d.length >= 1, `${word} produced no distractor`);
      for (const c of d) assert.match(c, /^[a-z]+$/, `${word} -> "${c}" is not plain lowercase`);
    }
  }
});

test("words with no rule still get generic distractors (custom and AI lists)", () => {
  const d = Scoring.buildDistractors({ word: "zyzzyva" }, 3, () => 0.3);
  assert.ok(d.length >= 1);
  assert.ok(!d.includes("zyzzyva"));
});

test("buildDistractors is deterministic when a RNG is injected", () => {
  const a = Scoring.buildDistractors({ word: "receive", rule: "ie_ei" }, 3, () => 0.7);
  const b = Scoring.buildDistractors({ word: "receive", rule: "ie_ei" }, 3, () => 0.7);
  assert.deepEqual(a, b);
});

test("every built-in word yields a sane distractor set", () => {
  // Load WORD_LIST the same way the browser does.
  const vm = require("node:vm");
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "..", "words.js"), "utf8");
  const ctx = vm.createContext({});
  vm.runInContext(src + "\n;globalThis.__WL = WORD_LIST;", ctx);
  const list = ctx.__WL;
  assert.ok(list.length > 200);
  for (const e of list) {
    const d = Scoring.buildDistractors(e, 3, () => 0.5);
    assert.ok(!d.includes(e.word), `${e.word} offered itself`);
    for (const c of d) {
      assert.match(c, /^[a-z]+$/, `${e.word} -> "${c}" not plain lowercase`);
      assert.notEqual(c, e.word);
    }
  }
});