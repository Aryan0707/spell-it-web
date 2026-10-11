const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../reading.js');
const { PASSAGES, ADVANCED_PASSAGES } = require('../reading-passages.js');

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

test('advanced passages are longer, with five questions and three findable scanning targets each', () => {
  const ids = new Set(PASSAGES.map(p => p.id));
  assert.ok(ADVANCED_PASSAGES.length >= 6);
  for (const p of ADVANCED_PASSAGES) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    const words = R.countWords(p.paragraphs.join(' '));
    assert.ok(words >= 220 && words <= 340, `${p.id} has ${words} words`);
    assert.deepEqual(p.questions.map(q => q.kind), ['gist', 'fact', 'fact', 'inference', 'inference']);
    for (const q of p.questions) {
      assert.equal(q.options.length, 4);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
    }
    assert.equal(p.scans.length, 3);
    // A tap is judged against the answer's position, so each answer must appear exactly once.
    for (const scan of p.scans) assert.equal(R.findSpans(p, scan.find).length, 1, `${p.id}: "${scan.find}"`);
  }
});

test('levels 5 to 7 read the advanced texts; the rest read the basic ones', () => {
  const sets = { PASSAGES, ADVANCED_PASSAGES };
  for (const level of R.LEVELS) {
    assert.equal(R.passagesFor(level, sets), level.n >= 5 ? ADVANCED_PASSAGES : PASSAGES, `level ${level.n}`);
  }
});

test('phrases are found by word position, ignoring case and punctuation at the edges', () => {
  const passage = { paragraphs: ['The Mid-Atlantic Ridge, found in 1950.', 'It lies about 20,000 kilometres away.'] };
  assert.deepEqual(R.findSpans(passage, 'mid-atlantic ridge'), [{ first: 1, last: 2 }]);
  assert.deepEqual(R.findSpans(passage, '1950'), [{ first: 5, last: 5 }]);
  assert.deepEqual(R.findSpans(passage, '20,000 kilometres'), [{ first: 9, last: 10 }]);
  assert.deepEqual(R.findSpans(passage, 'ocean'), []);
});

test('the sprint lines each word up on a letter a little left of its middle', () => {
  assert.deepEqual(R.orpSplit('a'), ['', 'a', '']);
  assert.deepEqual(R.orpSplit('read'), ['r', 'e', 'ad']);
  assert.deepEqual(R.orpSplit('reading'), ['re', 'a', 'ding']);
  assert.deepEqual(R.orpSplit('"Consequently,'), ['"Con', 's', 'equently,']);
  assert.equal(R.orpSplit('antibiotics.').join(''), 'antibiotics.');
});

test('long words and the ends of clauses and sentences stay up longer in the sprint', () => {
  assert.equal(R.flashWeight('the'), 1);
  assert.equal(R.flashWeight('word,'), 1.5);
  assert.equal(R.flashWeight('end.'), 2);
  assert.equal(R.flashWeight('magnetometers.'), 2.4);
});

test('on five questions, the mastery test needs four right', () => {
  const s = { ...R.recordResult(R.emptyState(), 1, pass, 'salt').state, unlocked: 7 };
  const goal = R.targetFor(s, 7);
  assert.equal(R.recordResult(s, 7, { wpm: goal, share: 3 / 5 }, 'gps').passed, false);
  assert.equal(R.recordResult(s, 7, { wpm: goal, share: 4 / 5 }, 'gps').passed, true);
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

test('the trainer exposes an extension hook for other modules', () => {
  // The DOM half only exists in a browser; here we check the source wires the hook end to end.
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'reading.js'), 'utf8');
  assert.match(src, /register: \(ext\) =>/);
  assert.match(src, /id="rd-extras"/);
  assert.match(src, /bindExtensions\(\);/);
});

test('paced levels speed up after a perfect read, hold after a pass, and ease off after a fail', () => {
  assert.equal(R.adaptTarget(300, { wpm: 300, share: 1 }), 315);
  assert.equal(R.adaptTarget(300, { wpm: 300, share: 4 / 5 }), 300);
  assert.equal(R.adaptTarget(300, { wpm: 300, share: 2 / 3 }), 300);
  assert.equal(R.adaptTarget(300, { wpm: 300, share: 3 / 5 }), 276);
  assert.equal(R.adaptTarget(300, { wpm: 300, share: 0 }), 276);
  // The new pace is what the next read of that level starts at, kept within the allowed range.
  let s = R.recordResult(R.emptyState(), 1, { wpm: 250, share: 1 }, 'salt').state;
  const first = R.targetFor(s, 2);
  s = R.recordResult(s, 2, { wpm: first, share: 1 }, 'bees').state;
  assert.equal(R.targetFor(s, 2), Math.round(first * 1.05));
  s = R.recordResult(s, 2, { wpm: R.targetFor(s, 2), share: 0 }, 'tides').state;
  assert.ok(R.targetFor(s, 2) < Math.round(first * 1.05));
});

test('a short word ending within reach to the right can be recognised whole; further right is only a preview', () => {
  assert.equal(L.zoneFor(4), 'recognise');
  assert.equal(L.zoneFor(7), 'recognise');
  assert.equal(L.zoneFor(8), 'preview');
  assert.equal(L.zoneFor(-4), 'preview'); // the left side has no recognition zone
});

test('stops last longer on long and rare words and shorter on predictable ones, within real ranges', () => {
  assert.ok(L.fixationMs('the') < L.fixationMs('laboratory'));
  assert.ok(L.fixationMs('octopuses') > L.fixationMs('readers')); // rare vs common, similar length
  assert.ok(L.fixationMs('umbrella', { predictable: true }) < L.fixationMs('umbrella'));
  for (const w of ['a', 'the', 'surprisingly', 'extraordinarily']) {
    const ms = L.fixationMs(w);
    assert.ok(ms >= 150 && ms <= 420, `${w}: ${ms} ms`);
  }
  assert.ok(L.saccadeMs(8) >= 20 && L.saccadeMs(8) <= 40);
});

test('the skilled model reads like an adult: about a quarter of words skipped, 200-250 ms stops, few jumps back', () => {
  const plan = L.planReading(L.DEMO_TEXT, { profile: 'skilled' });
  const words = L.DEMO_TEXT.split(/\s+/).length;
  const skipRate = plan.skipped.length / words;
  assert.ok(skipRate >= 0.15 && skipRate <= 0.4, `skip rate ${skipRate}`);
  const mean = plan.fixations.reduce((s, f) => s + f.ms, 0) / plan.fixations.length;
  assert.ok(mean >= 200 && mean <= 250, `mean ${mean}`);
  const race = L.planReading(L.RACE_TEXT, { profile: 'skilled' });
  assert.ok(race.backs / race.fixations.length <= 0.15, 'jumps back stay rare for a skilled reader');
});

test('a developing reader fixates every word, stops longer and goes back more, so takes over twice as long', () => {
  const skilled = L.planReading(L.RACE_TEXT, { profile: 'skilled' });
  const dev = L.planReading(L.RACE_TEXT, { profile: 'developing' });
  assert.equal(dev.skipped.length, 0);
  assert.ok(dev.backs > skilled.backs);
  assert.ok(dev.totalMs > 2 * skilled.totalMs);
  assert.ok(dev.fixations.some((f) => f.kind === 'refix'), 'long words get a second stop');
});

test('the jump to a new line lands too far right, then a short jump left corrects it', () => {
  const plan = L.planReading(L.DEMO_TEXT, { lineStarts: [40, 80, 120] });
  const i = plan.fixations.findIndex((f) => f.kind === 'return');
  assert.ok(i > 0);
  assert.equal(plan.fixations[i + 1].kind, 'correct');
  assert.ok(plan.fixations[i + 1].at < plan.fixations[i].at, 'the correction goes left');
  assert.ok(plan.fixations[i].at >= 40, 'it lands on the new line');
});

test('guessable words in context get shorter stops or are skipped, compared with the same words scrambled', () => {
  const inContext = L.planReading(L.CONTEXT.natural, { predictable: L.CONTEXT.predictable });
  const scrambled = L.planReading(L.CONTEXT.scrambled);
  assert.ok(inContext.totalMs < scrambled.totalMs);
  const msFor = (plan, text, word) => {
    const k = text.split(/\s+/).findIndex((w) => w.replace(/[^A-Za-z]/g, '').toLowerCase() === word);
    return plan.fixations.filter((f) => f.word === k).reduce((s, f) => s + f.ms, 0);
  };
  for (const word of ['rain', 'umbrella', 'home']) {
    assert.ok(msFor(inContext, L.CONTEXT.natural, word) < msFor(scrambled, L.CONTEXT.scrambled, word), word);
  }
});
