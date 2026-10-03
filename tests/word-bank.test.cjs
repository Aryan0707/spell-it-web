"use strict";
// Data contract for every built-in word. The study card, sound guide, practice hints and the
// course all read these tables, so a missing or malformed row for ONE word shows up as a blank
// card or a broken lesson. Add words freely; this test says what a complete word looks like.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { readFileSync } = require("node:fs");

function load() {
  const context = vm.createContext({ window: {} });
  for (const file of ["words.js", "meanings.js", "sounds.js"]) vm.runInContext(readFileSync(file, "utf8"), context);
  vm.runInContext("this.WORDS = WORD_LIST; this.EXAMPLES = WORD_EXAMPLES; this.CATS = WORD_CATEGORIES; this.TIPS = RULE_TIPS; this.LABELS = RULE_LABELS;", context);
  const { window: w, WORDS, EXAMPLES, CATS, TIPS, LABELS } = context;
  return { WORDS, EXAMPLES, CATS, TIPS, LABELS, meanings: w.SpellMeanings, sounds: w.SpellSounds };
}

const LEVELS = ["beginner", "easy", "medium", "hard", "expert"];
const has = (text, word) => new RegExp(`\\b${word}\\b`, "i").test(text);

test("every word is well-formed and unique", () => {
  const { WORDS, CATS, TIPS, LABELS } = load();
  const seen = new Set();
  // A hint is shown to US and UK learners alike, so it may not use a spelling that differs.
  const dialect = WORDS.flatMap((w) => (w.variants ? [w.word, ...Object.values(w.variants)] : []));
  const categories = new Set(CATS.map((c) => c.value));
  for (const w of WORDS) {
    assert.match(w.word, /^[a-z]+$/, `${w.word}: lowercase letters only`);
    assert.ok(!seen.has(w.word), `${w.word}: duplicate`);
    seen.add(w.word);
    assert.ok(LEVELS.includes(w.difficulty), `${w.word}: unknown difficulty ${w.difficulty}`);
    assert.ok(categories.has(w.category), `${w.word}: unknown category ${w.category}`);
    if (w.rule) assert.ok(TIPS[w.rule] && LABELS[w.rule], `${w.word}: unknown rule ${w.rule}`);
    assert.ok(typeof w.hint === "string" && w.hint.length >= 8 && w.hint.length <= 90, `${w.word}: hint length`);
    assert.ok(!has(w.hint, w.word), `${w.word}: the hint gives the answer away`);
    for (const other of dialect) if (other !== w.word) assert.ok(!has(w.hint, other), `${w.word}: the hint uses the dialect spelling "${other}"`);
    for (const uk of Object.values(w.variants || {})) {
      assert.match(uk, /^[a-z]+$/, `${w.word}: variant spelling`);
      assert.notEqual(uk, w.word);
      assert.ok(!seen.has(uk), `${w.word}: variant ${uk} collides with another word`);
      assert.ok(!has(w.hint, uk), `${w.word}: the hint contains the variant`);
    }
  }
});

test("every word has a meaning, a sound guide and three examples, and no orphan rows exist", () => {
  const { WORDS, EXAMPLES, meanings, sounds } = load();
  const bank = new Set(WORDS.map((w) => w.word));
  // Spellings that differ between US and UK may only appear through the {word} placeholder.
  const dialect = WORDS.flatMap((w) => Object.values(w.variants || {}).concat(w.variants ? [w.word] : []));
  // Collect every problem so one run lists them all instead of stopping at the first.
  const problems = [];
  const check = (ok, message) => { if (!ok) problems.push(message); };
  for (const w of WORDS) {
    const m = meanings.rows[w.word];
    check(m, `${w.word}: no row in meanings.js`);
    if (m) {
      check(meanings.fromRow(w.word, m), `${w.word}: meanings row fails the checks the app applies to AI rows -> ${m}`);
      for (const other of dialect) check(!has(m, other), `${w.word}: meaning uses the dialect spelling "${other}"`);
    }
    const s = sounds.rows[w.word];
    check(s, `${w.word}: no row in sounds.js`);
    if (s) check(sounds.fromRow(w.word, s), `${w.word}: sound row invalid (syllables must spell the word, same number of spoken parts, one stressed part) -> ${s}`);

    const ex = EXAMPLES[w.word];
    check(Array.isArray(ex) && ex.length === 3, `${w.word}: needs exactly three examples`);
    if (!Array.isArray(ex)) continue;
    check(new Set(ex).size === ex.length, `${w.word}: examples must differ`);
    for (const sentence of ex) {
      check(sentence.split("{word}").length === 2, `${w.word}: exactly one {word} -> ${sentence}`);
      check(sentence.length <= 120, `${w.word}: sentence too long -> ${sentence}`);
      check(/[.!?]$/.test(sentence), `${w.word}: sentence needs end punctuation -> ${sentence}`);
      const plain = sentence.replace("{word}", " ");
      check(!has(plain, w.word), `${w.word}: the word appears twice -> ${sentence}`);
      for (const other of dialect) check(!has(plain, other), `${w.word}: sentence uses the dialect spelling "${other}" -> ${sentence}`);
    }
  }
  for (const key of Object.keys(meanings.rows)) check(bank.has(key), `meanings.js has a row for a word that is not in the bank: ${key}`);
  for (const key of Object.keys(sounds.rows)) check(bank.has(key), `sounds.js has a row for a word that is not in the bank: ${key}`);
  for (const key of Object.keys(EXAMPLES)) check(bank.has(key), `WORD_EXAMPLES has a key that is not in the bank: ${key}`);
  assert.deepEqual(problems, []);
});

test("a level never has a trailing lesson of one or two words in the NEW wave", () => {
  // Waves are chunked per level in fives. Keep each new wave's level a multiple of five so the
  // course doesn't end a level on a stub lesson. (The frozen first wave predates this rule.)
  const context = vm.createContext({ window: {} });
  vm.runInContext(readFileSync("words.js", "utf8") + ";this.WAVES = typeof WORD_WAVES === 'undefined' ? [] : WORD_WAVES;", context);
  for (const wave of context.WAVES.slice(1)) {
    for (const level of LEVELS) {
      const n = wave.filter((w) => w.difficulty === level).length;
      assert.equal(n % 5, 0, `wave has ${n} ${level} words; use a multiple of five`);
    }
  }
});
