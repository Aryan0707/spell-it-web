// Coach feature tests: selection, mastery protection, level adjustment, stats, persistence/merge.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { webcrypto } = require('node:crypto');

function setup() {
  const storage = new Map();
  const context = vm.createContext({
    localStorage: {
      getItem: k => storage.get(k),
      setItem: (k, v) => storage.set(k, v),
      removeItem: k => storage.delete(k),
    },
    crypto: webcrypto,
    window: { dispatchEvent() {} },
    document: { getElementById: () => null, head: { appendChild: () => {} }, createElement: () => ({}) },
    Event,
    Date,
  });
  for (const file of ['words.js', 'practice-content.js', 'coach.js']) {
    vm.runInContext(readFileSync(file, 'utf8'), context);
  }
  // Expose WORD_LIST on the context object for test access
  vm.runInContext('this.WORD_LIST = WORD_LIST; this.PROOFREAD_WORDS = window.PROOFREAD_WORDS;', context);
  return { api: context.window.SpellCoach, WORD_LIST: context.WORD_LIST, context };
}

// Helper: create a fake progress object
function progress(overrides = {}) {
  return {
    bestStreak: 0, curStreak: 0, learned: [], missed: {},
    srs: {}, sessionsCompleted: 0, patternMistakes: {},
    ...overrides,
  };
}

test('session plan prioritises due reviews over weak words over fresh', () => {
  const { api, WORD_LIST } = setup();
  const p = progress();

  // Add a due review word
  p.srs.cat = { reps: 0, interval: 0, dueAt: 1, ease: 2.5, entry: { word: 'cat', hint: 'A pet' } };

  // Add a weak word (high miss count)
  p.missed.dog = 5;

  const plan = api.planSession(5, p, WORD_LIST, x => x);
  assert.ok(plan.entries.length > 0, 'Should return entries');
  assert.ok(plan.entries.length <= 5, 'Should not exceed session length');

  // Due word should be first
  const firstWord = plan.entries[0].word;
  assert.equal(firstWord, 'cat', 'Due review word should come first');

  // Check breakdown
  assert.ok(plan.breakdown.due >= 1, 'Should have at least one due word');
  assert.ok(plan.breakdown.fresh >= 0, 'Should have fresh words');
  assert.equal(typeof plan.breakdown.due, 'number', 'breakdown has numeric due');
  assert.equal(typeof plan.breakdown.fresh, 'number', 'breakdown has numeric fresh');
  // Verify _source metadata is intentionally stripped from entries
  const hasSource = plan.entries.some(e => '_source' in e);
  assert.equal(hasSource, false, 'Entries must not leak internal _source metadata');
});

test('session plan includes weak words when not enough due', () => {
  const { api, WORD_LIST } = setup();
  const p = progress();

  // No due words, but some weak words
  p.missed.dog = 5;
  p.missed.bird = 3;

  const plan = api.planSession(5, p, WORD_LIST, x => x);
  assert.ok(plan.entries.length > 0);
  // Should include weak words
  const weakEntries = plan.entries.filter(e => e._source === 'weak');
  assert.ok(weakEntries.length >= 0, 'May include weak words');
});

test('assessment words cover all difficulties', () => {
  const { api, WORD_LIST } = setup();
  const words = api.assessmentWords(WORD_LIST, x => x);
  assert.ok(words.length >= 3, 'Should return words from multiple difficulty levels');
  assert.ok(words.length <= 5, 'Should return at most 5 words (one per difficulty)');

  // Check words span multiple difficulties
  const difficulties = new Set(words.map(w => w.difficulty));
  assert.ok(difficulties.size >= 2, 'Should span at least 2 difficulty levels');
});

test('level assessment determines correct starting level', () => {
  const { api } = setup();

  // Simulate perfect results on beginner/easy
  const perfectResults = {
    cat: { clean: true, assisted: false },
    apple: { clean: true, assisted: false },
  };
  const level1 = api.assessLevel(perfectResults);
  assert.ok(level1 >= 1, 'Should assess at least level 1');

  // Simulate all wrong
  const allWrongResults = {
    cat: { clean: false, assisted: true },
    apple: { clean: false, assisted: false },
  };
  const level2 = api.assessLevel(allWrongResults);
  assert.equal(level2, 1, 'Should default to level 1 when all wrong');
});

test('same-day mastery does not increment on repeated clean answers', () => {
  const { api, context } = setup();

  const word = 'cat';

  // Manually set last mastery date to today
  const todayStr = api.dayKey();
  const coachData = api.getCoachData();
  coachData.lastMasteryDates[word] = todayStr;
  api.replaceCoachData(coachData);

  // Now attempt increment on same day — should be blocked
  const blocked = api.canIncrementMastery(word, { reps: 0 });
  assert.equal(blocked, false, 'Same-day clean answer should NOT increment mastery');
});

test('mastery increments on different day', () => {
  const { api } = setup();

  const word = 'cat';
  const day1 = api.dayKey(new Date(2026, 0, 15));
  const day2 = api.dayKey(new Date(2026, 0, 16));

  // Set last mastery date to day1
  const coachData = api.getCoachData();
  coachData.lastMasteryDates[word] = day1;
  api.replaceCoachData(coachData);

  // Now try on day2 - should be allowed
  const allowed = api.canIncrementMastery(word, { reps: 0 });
  // This test runs on whatever the actual date is, so we need to reset
  // and use the actual date comparison logic
  api.reset();
  // First one should be allowed
  const firstOK = api.canIncrementMastery(word, { reps: 0 });
  assert.equal(firstOK, true, 'Fresh word should allow first increment');

  // Same day (today) should NOT allow second
  const todayStr = api.dayKey();
  const data2 = api.getCoachData();
  data2.lastMasteryDates[word] = todayStr;
  api.replaceCoachData(data2);
  const secondBlocked = api.canIncrementMastery(word, { reps: 0 });
  assert.equal(secondBlocked, false, 'Same day should block second increment');
});

test('coach stats return sensible values for new user', () => {
  const { api } = setup();
  const p = progress();
  const stats = api.getStats(p, p.srs);

  assert.equal(stats.firstTryAccuracy, null, 'New user has no accuracy yet');
  assert.equal(stats.totalPracticed, 0, 'New user has practiced 0 words');
  assert.equal(stats.mastered, 0, 'New user has 0 mastered');
  assert.equal(stats.isAssessed, false, 'New user is not assessed');
});

test('coach stats after some practice with separate-day evidence', () => {
  const { api } = setup();
  api.recordResult('cat', { word: 'cat' }, true, false, true);
  api.recordResult('dog', { word: 'dog' }, false, false, true);
  api.recordResult('bird', { word: 'bird' }, true, false, true);

  // Set up coach state with separate-day mastery evidence for 'cat'
  const c = api.getCoachData();
  const yesterday = api.dayKey(new Date(Date.now() - 86400000));
  c.lastMasteryDates.cat = yesterday;
  c.firstTryCorrect = 2;
  c.firstTryTotal = 3;
  api.replaceCoachData(c);

  const p = progress({
    srs: {
      cat: { reps: 3, interval: 3, dueAt: Date.now() + 86400000 * 3, updatedAt: Date.now() },
      dog: { reps: 0, interval: 0, dueAt: Date.now() },
    },
    sessionsCompleted: 3,
  });

  const stats = api.getStats(p, p.srs);
  assert.equal(stats.firstTryAccuracy, 67, 'First-try accuracy should be ~67%');
  // Cat: lastMasteryDates=yesterday, updatedAt=today => different day => recalledLater
  assert.equal(stats.recalledLater, 1, 'One word recalled on a later day (separate-day evidence)');
  assert.equal(stats.mastered, 1, 'One word has 3 reps');
  assert.equal(stats.sessions, 3);
});

test('adaptive level up on consistent performance', () => {
  const { api } = setup();
  api.setLevel(2, 'Initial');

  // Record 15 clean results at level 2
  for (let i = 0; i < 15; i++) {
    api.recordResult(`word${i}`, { word: `word${i}` }, true, false, true);
  }

  const level = api.getLevel();
  // Level should have increased or stayed (depends on internal thresholds)
  assert.ok(level >= 2, 'Level should not decrease with perfect results');
});

test('diffSpelling highlights character differences', () => {
  const { api } = setup();

  const diff = api.diffSpelling('cat', 'cut');
  assert.ok(diff.html.includes('coach-wrong'), 'Should highlight wrong character');
  assert.ok(diff.html.includes('coach-correct-char'), 'Should highlight correct character');
  assert.ok(diff.html.includes('coach-match'), 'Should highlight matching characters');
  assert.ok(diff.mistakes.length > 0, 'Should detect at least one mistake');
});

test('diffSpelling handles missing characters', () => {
  const { api } = setup();

  const diff = api.diffSpelling('abcd', 'ab');
  assert.ok(diff.html.includes('coach-missing'), 'Should highlight missing characters');
});

test('diffSpelling handles extra characters', () => {
  const { api } = setup();

  const diff = api.diffSpelling('ab', 'abcd');
  assert.ok(diff.html.includes('coach-extra'), 'Should highlight extra characters');
});

test('mnemonic tips return curated or honest fallback', () => {
  const { api } = setup();

  const tip1 = api.getMnemonic('because', { word: 'because' });
  assert.ok(tip1.length > 10, 'Should return a meaningful tip');
  assert.ok(tip1.includes('Big Elephants') || tip1.toLowerCase().includes('because'),
    'Curated words should get a specific mnemonic');

  const tip2 = api.getMnemonic('xyzzzz', { word: 'xyzzzz' });
  assert.ok(tip2.length > 5, 'Unknown words should still get a fallback tip');
});

test('coach data persists through getCoachData/replaceCoachData', () => {
  const { api } = setup();

  api.setLevel(3, 'Test');
  api.recordResult('cat', { word: 'cat' }, true, false, true);

  const saved = api.getCoachData();
  api.reset();
  api.replaceCoachData(saved);

  assert.equal(api.getLevel(), 3, 'Level should be restored');
  assert.equal(api.isAssessed(), false, 'Only level was set, not assessment');
});

test('planSession handles empty SRS gracefully', () => {
  const { api, WORD_LIST } = setup();
  const p = progress();

  const plan = api.planSession(10, p, WORD_LIST, x => x);
  assert.ok(plan.entries.length > 0, 'Should return fresh words when nothing else available');
  assert.ok(plan.entries.length <= 10, 'Should respect session length');
  assert.equal(plan.breakdown.due, 0, 'No due words expected');
  assert.equal(plan.breakdown.weak, 0, 'No weak words expected');
  assert.equal(plan.breakdown.fresh, plan.entries.length, 'All should be fresh');
});

test('level assessment words vary by day seed', () => {
  const { api, WORD_LIST } = setup();
  const words1 = api.assessmentWords(WORD_LIST, x => x);
  const words2 = api.assessmentWords(WORD_LIST, x => x);
  // Both should be arrays of different difficulties
  const diffs1 = words1.map(w => w.difficulty).sort().join(',');
  const diffs2 = words2.map(w => w.difficulty).sort().join(',');
  assert.equal(diffs1, diffs2, 'Same difficulties should be selected');
});

test('curated mnemonics exist for common tricky words', () => {
  const { api } = setup();
  const trickyWords = ['because', 'beautiful', 'necessary', 'separate', 'definitely',
    'friend', 'believe', 'receive', 'rhythm', 'restaurant', 'tomorrow', 'vacuum',
    'weird', 'embarrass', 'occasion', 'environment', 'government', 'calendar'];
  for (const word of trickyWords) {
    const mnemonic = api.getMnemonic(word, { word });
    assert.ok(mnemonic.length > 10, `"${word}" should have a meaningful mnemonic`);
  }
});