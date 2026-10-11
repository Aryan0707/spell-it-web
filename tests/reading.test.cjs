const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../reading.js');
const { PASSAGES } = require('../reading-passages.js');

const pass = { wpm: 250, share: 1 };
const fail = { wpm: 400, share: 1 / 3 };

test('passages are a fair, comparable set with three well-formed questions each', () => {
  const ids = new Set();
  for (const p of PASSAGES) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    const words = R.countWords(p.paragraphs.join(' '));
    assert.ok(words >= 150 && words <= 260, `${p.id} has ${words} words`);
    assert.deepEqual(p.questions.map(q => q.kind), ['gist', 'fact', 'inference']);
    for (const q of p.questions) {
      assert.equal(q.options.length, 4);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
    }
  }
  assert.ok(PASSAGES.length >= 8);
});

test('speed is words per minute, and effective speed discounts what was not understood', () => {
  assert.equal(R.wordsPerMinute(250, 60000), 250);
  assert.equal(R.wordsPerMinute(250, 30000), 500);
  assert.equal(R.wordsPerMinute(250, 0), 0);
  assert.equal(R.effectiveWpm(300, 2 / 3), 200);
});

test('phrases end at punctuation and a sentence end lingers a little longer', () => {
  const chunks = R.makeChunks('In the morning, the bees fly out. They return'.split(' '), 3);
  assert.deepEqual(chunks.map(c => c.words.join(' ')), ['In the morning,', 'the bees fly', 'out.', 'They return']);
  assert.equal(chunks[2].weight, 1.5);
  assert.equal(chunks[1].weight, 3);
});

test('the baseline is set by the first passing read only, then stays fixed', () => {
  let s = R.emptyState();
  s = R.recordResult(s, 1, fail, 'bees').state;
  assert.equal(s.baseline, null);
  assert.equal(s.unlocked, 1);
  const first = R.recordResult(s, 1, pass, 'salt');
  assert.equal(first.state.baseline, 250);
  assert.equal(first.state.unlocked, 2);
  assert.ok(first.unlockedNew);
  s = R.recordResult(first.state, 1, { wpm: 400, share: 1 }, 'tides').state;
  assert.equal(s.baseline, 250, 'a later check-in does not move the starting point');
});

test('a read faster than anyone can understand counts as skimming and sets no baseline', () => {
  const skim = R.recordResult(R.emptyState(), 1, { wpm: R.MAX_WPM + 1, share: 1 }, 'salt');
  assert.equal(skim.passed, false);
  assert.equal(skim.state.baseline, null);
  assert.equal(R.stats(skim.state).bestEffective, 0);
});

test('paced levels start from the baseline and need two of three answers right to unlock the next', () => {
  let s = R.recordResult(R.emptyState(), 1, pass, 'salt').state;
  assert.equal(R.targetFor(s, 2), Math.round(250 * 1.15));
  assert.equal(R.recordResult(s, 2, { wpm: 288, share: 1 / 3 }, 'bees').state.unlocked, 2);
  s = R.recordResult(s, 2, { wpm: 288, share: 2 / 3 }, 'bees').state;
  assert.equal(s.unlocked, 3);
  // Passing an earlier level again does not skip ahead.
  assert.equal(R.recordResult(s, 1, pass, 'tides').state.unlocked, 3);
});

test('the mastery test needs both the speed goal and understanding', () => {
  const s = { ...R.recordResult(R.emptyState(), 1, pass, 'salt').state, unlocked: 7 };
  const goal = R.targetFor(s, 7);
  assert.equal(goal, Math.round(250 * R.MASTERY_GOAL));
  assert.equal(R.recordResult(s, 7, { wpm: goal - 1, share: 1 }, 'bees').passed, false);
  assert.equal(R.recordResult(s, 7, { wpm: goal, share: 1 / 3 }, 'bees').passed, false);
  assert.equal(R.recordResult(s, 7, { wpm: goal, share: 2 / 3 }, 'bees').passed, true);
});

test('the next passage is one read least often and never the one just read', () => {
  const passages = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  let s = R.emptyState();
  s.read = { a: 2, b: 1, c: 1 };
  s.results = [{ level: 1, share: 1, passage: 'b' }];
  for (let i = 0; i < 5; i++) assert.equal(R.pickPassage(s, passages, Math.random).id, 'c');
});

test('saved progress is cleaned: bad values are dropped and levels stay locked without a baseline', () => {
  const s = R.sanitize({ baseline: 'fast', unlocked: 6, targets: { 2: 99999, 3: 'x' }, results: [{ level: 1 }, { level: 2, share: 1 }], read: { a: -1, b: 2 } });
  assert.equal(s.baseline, null);
  assert.equal(s.unlocked, 1);
  assert.deepEqual(s.targets, { 2: 1000 });
  assert.equal(s.results.length, 1);
  assert.deepEqual(s.read, { b: 2 });
  assert.deepEqual(R.sanitize(null), R.emptyState());
});

const L = require('../reading-lesson.js');

test('the eye sees about seven letters sharply and previews further to the right than the left', () => {
  assert.equal(L.zoneFor(0), 'fix');
  assert.equal(L.zoneFor(-3), 'sharp');
  assert.equal(L.zoneFor(3), 'sharp');
  assert.equal(L.zoneFor(-4), 'preview');
  assert.equal(L.zoneFor(-5), 'hidden');
  assert.equal(L.zoneFor(14), 'preview');
  assert.equal(L.zoneFor(15), 'hidden');
});

test('a skilled reader only moves forward and skips short words; going back costs extra stops', () => {
  const skilled = L.planFixations(L.DEMO_TEXT);
  const words = L.DEMO_TEXT.split(/\s+/).length;
  assert.ok(skilled.fixations.length < words, 'some short words are skipped');
  assert.ok(skilled.fixations.every((f, i) => i === 0 || f > skilled.fixations[i - 1]), 'never goes back');
  assert.equal(skilled.backs, 0);
  const slow = L.planFixations(L.DEMO_TEXT, { regressions: true });
  assert.ok(slow.backs > 0);
  assert.ok(slow.fixations.length > skilled.fixations.length);
  // Each stop lands on a letter, never on a space.
  for (const f of skilled.fixations) assert.match(L.DEMO_TEXT[f], /[A-Za-z]/);
});
