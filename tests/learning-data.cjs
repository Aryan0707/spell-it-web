const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { webcrypto } = require('node:crypto');

function setup() {
  const storage = new Map();
  const context = vm.createContext({ localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) }, crypto: webcrypto, window: { dispatchEvent() {} }, Event, Date });
  for (const file of ['words.js', 'practice-content.js', 'learning.js']) vm.runInContext(readFileSync(file, 'utf8'), context);
  return { api: context.window.SpellLearning, context };
}
const progress = () => ({ bestStreak: 0, curStreak: 0, learned: [], missed: {}, srs: {}, sessionsCompleted: 0, patternMistakes: {} });
const clone = x => JSON.parse(JSON.stringify(x));

test('learning path covers every word once, advances in order and requires a complete unassisted lesson', () => {
  const { api, context } = setup();
  const lessons = api.pathLessons();
  const words = lessons.flatMap(l => l.entries.map(w => w.word));
  assert.equal(words.length, vm.runInContext('WORD_LIST.length', context));
  assert.equal(new Set(words).size, words.length);
  assert.equal(api.pathStatus().next.level, 1);
  assert.equal(lessons.at(-1).level, 5);
  assert.ok(lessons.every(l => l.entries.length > 0 && l.entries.length <= 5));
  const pass = (lesson, id) => api.completeSession(id, { pathLesson: lesson.id,
    independent: lesson.entries.length, assisted: 0, total: lesson.entries.length }, 1);
  pass(lessons[1], 'later');
  assert.equal(api.pathStatus().completed, 0, 'out-of-order results do not skip the first lesson');
  api.completeSession('hinted', { pathLesson: lessons[0].id, independent: 4, assisted: 1, total: 5 }, 2);
  api.completeSession('short', { pathLesson: lessons[0].id, independent: 1, assisted: 0, total: 1 }, 3);
  api.completeSession('free', { independent: 5, assisted: 0, total: 5 }, 4);
  assert.equal(api.pathStatus().completed, 0);
  pass(lessons[0], 'first');
  assert.equal(api.pathStatus().completed, 2);
  for (const lesson of lessons.slice(2)) pass(lesson, lesson.id);
  assert.equal(api.pathStatus().completed, lessons.length);
  assert.equal(api.pathStatus().next, null);
  const restored = setup().api;
  restored.replace(restored.validateSnapshot(api.snapshot(progress())).learning);
  assert.equal(restored.pathStatus().next, null, 'completion survives backup roundtrip');
  restored.reset();
  assert.equal(restored.pathStatus().next.level, 1);
});

test('learning path merges offline completions and rejects malformed lesson metadata', () => {
  const { api } = setup();
  const [first, second] = api.pathLessons();
  const a = api.snapshot(progress()), b = api.snapshot(progress());
  a.learning.sessions.a = { at: 1, pathLesson: first.id, independent: 5, assisted: 0, total: 5 };
  b.learning.sessions.b = { at: 2, pathLesson: second.id, independent: 5, assisted: 0, total: 5 };
  api.replace(api.validateSnapshot(api.mergeSnapshots(a, b)).learning);
  assert.equal(api.pathStatus().completed, 2);
  a.learning.sessions.a.pathLesson = '<script>bad</script>';
  assert.throws(() => api.validateSnapshot(a), /path lesson/);
});

test('custom lists parse delimiters, keep optional clues, deduplicate and reject invalid words', () => {
  const { api } = setup();
  const parsed = api.parseWords('cat, dog cat\nbeautiful | Lovely to look at | beau-ti-ful');
  assert.equal(parsed.entries.length, 3);
  assert.equal(parsed.entries[2].syllables, 'beau-ti-ful');
  assert.equal(parsed.errors.length, 0);
  assert.ok(api.parseWords('bad-word').errors.length);
  assert.ok(api.parseWords('cat | A pet | ca-at').errors.length);
  assert.ok(api.parseWords('  ').errors.length);
});
test('daily plan is five unique words, prioritises two due words and survives refresh', () => {
  const { api } = setup(), p = progress();
  p.srs.cat = { dueAt: 1, reps: 0, interval: 0 };
  p.srs.dog = { dueAt: 2, reps: 0, interval: 0 };
  const plan = api.dailyPlan(p, x => x, '2026-09-10');
  assert.equal(plan.words.length, 5);
  assert.equal(new Set(plan.words.map(w => w.word)).size, 5);
  assert.equal(plan.reviewCount, 2);
  const before = JSON.stringify(plan.words);
  api.dailyResult('2026-09-10', plan.words[0], { clean: false, assisted: true });
  assert.equal(JSON.stringify(api.dailyPlan(progress(), x => x, '2026-09-10').words), before);
  for (const entry of plan.words.slice(1)) api.dailyResult('2026-09-10', entry, { clean: true, assisted: false });
  assert.ok(api.get().daily['2026-09-10'].completedAt);
  assert.equal(api.dailyPlan(progress(), x => x, '2026-09-11').results.cat, undefined);
});
test('sync merges offline sessions, notes and deletions without double-counting', () => {
  const { api } = setup();
  let a = clone(api.snapshot(progress())), b = clone(a);
  a.learning.sessions.a = { at: 1, independent: 3, assisted: 1, total: 5 };
  b.learning.sessions.b = { at: 2, independent: 5, assisted: 0, total: 5 };
  a.progress.sessionsCompleted = b.progress.sessionsCompleted = 1;
  a.learning.lists.list = { id: 'list', name: 'School', entries: [{ word: 'cat' }], deleted: false, updatedAt: 1 };
  b.learning.lists.list = { ...a.learning.lists.list, deleted: true, updatedAt: 2 };
  a.learning.notebook.cat = { word: 'cat', entry: { word: 'cat' }, attempts: [{ id: 'a', text: 'kat', at: 1 }], note: 'Old', noteAt: 1, updatedAt: 1 };
  b.learning.notebook.cat = { ...a.learning.notebook.cat, attempts: [{ id: 'b', text: 'cut', at: 2 }], note: 'New reminder', noteAt: 3, updatedAt: 2 };
  const merged = api.mergeSnapshots(a, b);
  assert.equal(merged.progress.sessionsCompleted, 2);
  assert.equal(merged.learning.lists.list.deleted, true);
  assert.equal(merged.learning.notebook.cat.attempts.length, 2);
  assert.equal(merged.learning.notebook.cat.note, 'New reminder');
  assert.deepEqual(clone(api.mergeSnapshots(a, b)), clone(api.mergeSnapshots(b, a)));
  assert.deepEqual(clone(api.mergeSnapshots(merged, merged)), clone(merged));
  api.validateSnapshot(merged);
});
test('a later progress reset wins over an old device snapshot', () => {
  const { api } = setup();
  const old = api.snapshot(progress()); old.progress.learned = ['cat'];
  api.reset(); const fresh = api.snapshot(progress());
  assert.equal(api.mergeSnapshots(old, fresh).progress.learned.length, 0);
});
test('backup validation rejects malformed, unsafe and credential-bearing data', () => {
  const { api } = setup();
  api.validateSnapshot(api.snapshot(progress()));
  for (const mutate of [
    x => { x.progress.bestStreak = 'oops'; },
    x => { x.learning.lists = []; },
    x => { x.apiKey = 'must-never-sync'; },
    x => { x.learning.notebook.cat = { word: 'cat' }; },
    x => { x.progress.srs = JSON.parse('{"__proto__":{}}'); },
  ]) {
    const value = api.snapshot(progress()); mutate(value);
    assert.throws(() => api.validateSnapshot(value));
  }
});

test('backups keep AI study-card extras and still reject malformed or unknown entry fields', () => {
  const { api } = setup();
  const withEntry = entry => {
    const snap = clone(api.snapshot(progress()));
    snap.learning.notebook.fern = { word: 'fern', entry, attempts: [], note: '', noteAt: 0, updatedAt: 1 };
    return snap;
  };
  const extras = { word: 'fern', hint: 'A leafy plant', examples: ['A {word} grew here.'], meaning: 'noun | A green plant. | plant', sounds: 'fern | FURN | /fɝn/' };
  api.validateSnapshot(withEntry(extras));
  for (const bad of [
    { ...extras, examples: 'not a list' },
    { ...extras, examples: ['a', 'b', 'c', 'd'] },
    { ...extras, examples: ['x'.repeat(201)] },
    { ...extras, meaning: 'x'.repeat(501) },
    { ...extras, sounds: { not: 'a string' } },
    { ...extras, apiKey: 'sk-secret' },
  ]) assert.throws(() => api.validateSnapshot(withEntry(bad)), /invalid/i, JSON.stringify(bad).slice(0, 60));
});
