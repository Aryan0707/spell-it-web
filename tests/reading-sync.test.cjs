const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { webcrypto } = require('node:crypto');
const S = require('../reading-sync.js');

const res = (at, level, extra = {}) => ({ at, level, passage: 'bees', wpm: 250, share: 1, passed: true, ...extra });
const state = (over = {}) => ({ v: 1, baseline: null, unlocked: 1, targets: {}, results: [], read: {}, ...over });

test('merge unions results by timestamp, drops duplicates and keeps the newest 100', () => {
  const a = state({ results: [res(1, 1), res(2, 1)] });
  const b = state({ results: [res(2, 1), res(3, 1)] });
  assert.deepEqual(S.merge(a, b).results.map(r => r.at), [1, 2, 3]);
  const many = (from) => state({ results: Array.from({ length: 100 }, (_, i) => res(from + i, 1, { passed: false })) });
  const merged = S.merge(many(1), many(51));
  assert.equal(merged.results.length, 100);
  assert.equal(merged.results[0].at, 51);
  assert.equal(merged.results.at(-1).at, 150);
});

test('merge takes the larger read count per passage and the larger unlocked level', () => {
  const a = state({ baseline: 250, unlocked: 3, read: { bees: 4, octopus: 1 } });
  const b = state({ baseline: 250, unlocked: 2, read: { bees: 2, lighthouse: 5 } });
  const m = S.merge(a, b);
  assert.deepEqual(m.read, { bees: 4, lighthouse: 5, octopus: 1 });
  assert.equal(m.unlocked, 3);
});

test('baseline comes from the earliest passing level-1 result, else from the existing state', () => {
  const a = state({ baseline: 300, results: [res(50, 1, { wpm: 300 })] });
  const b = state({ baseline: 220, results: [res(10, 1, { wpm: 220 })] });
  assert.equal(S.merge(a, b).baseline, 220);
  assert.equal(S.merge(b, a).baseline, 220);
  // A failed read or a different level never sets the baseline.
  const failed = state({ results: [res(5, 1, { passed: false, wpm: 100 }), res(6, 2, { wpm: 400 })] });
  assert.equal(S.merge(failed, a).baseline, 300);
  // No result to read it from: keep the one that exists, and the lower when both exist.
  assert.equal(S.merge(state({ baseline: 280 }), state()).baseline, 280);
  assert.equal(S.merge(state({ baseline: 280 }), state({ baseline: 240 })).baseline, 240);
  assert.equal(S.merge(state(), state()).baseline, null);
});

test('each level takes the pace from the side with the newer result for that level', () => {
  const a = state({ baseline: 250, targets: { 4: 330, 5: 400 }, results: [res(10, 1), res(100, 4, { wpm: 330 })] });
  const b = state({ baseline: 250, targets: { 4: 360, 6: 500 }, results: [res(10, 1), res(200, 4, { wpm: 360 })] });
  const m = S.merge(a, b);
  assert.equal(m.targets[4], 360);
  assert.equal(m.targets[5], 400);
  assert.equal(m.targets[6], 500);
  assert.deepEqual(S.merge(b, a), m);
});

test('merge is commutative and idempotent, and a side with no reading data passes through', () => {
  const a = state({ baseline: 250, unlocked: 2, targets: { 4: 330 }, read: { bees: 2 }, results: [res(1, 1), res(5, 4, { wpm: 330 })] });
  const b = state({ baseline: 250, unlocked: 3, targets: { 4: 340 }, read: { bees: 3 }, results: [res(1, 1), res(9, 4, { wpm: 340 })] });
  assert.deepEqual(S.merge(a, b), S.merge(b, a));
  const m = S.merge(a, b);
  assert.deepEqual(S.merge(m, a), m);
  assert.deepEqual(S.merge(m, m), m);
  assert.equal(S.merge(undefined, undefined), null);
  assert.deepEqual(S.merge(a, undefined), S.clean(a));
  assert.deepEqual(S.merge(undefined, a), S.clean(a));
});

test('validate cleans bad data instead of storing it, and rejects non-objects', () => {
  const dirty = {
    baseline: 99999, unlocked: 99, evil: { x: 1 },
    targets: { 4: 'fast', 5: 400, 99: 300 },
    read: { bees: 2, 'bad id!': 3, __proto__: 7, octopus: -1, lighthouse: 1.5 },
    results: [res(1, 1), { at: 'now', level: 1, share: 1 }, { at: 2, level: 99, share: 1 }, { at: 3, level: 1, share: 7 }, null, 'x',
      { ...res(4, 2), extra: '<script>', passage: '<b>' }],
  };
  const clean = S.validate(dirty);
  assert.equal(clean.baseline, 1000);
  assert.equal(clean.unlocked, 7);
  assert.equal(clean.evil, undefined);
  assert.deepEqual(clean.targets, { 5: 400 });
  assert.deepEqual(clean.read, { bees: 2 });
  assert.deepEqual(clean.results.map(r => r.at), [1, 4]);
  assert.deepEqual(Object.keys(clean.results[1]).sort(), ['at', 'level', 'passage', 'passed', 'share', 'wpm']);
  assert.equal(clean.results[1].passage, '');
  for (const bad of [null, 'x', 5, [], undefined]) assert.throws(() => S.validate(bad), /reading data/);
  assert.equal(S.validate({}).baseline, null);
});

test('only trainers with some progress are worth saving', () => {
  assert.equal(S.hasProgress(S.clean(null)), false);
  assert.equal(S.hasProgress(S.clean(state({ read: { bees: 1 } }))), true);
});

// ---- the same rules through the real snapshot, merge and validation code ----
function setup(reading) {
  const storage = new Map();
  const R = require('../reading.js');
  const win = { dispatchEvent() {}, SpellReading: { ...R, getState: () => reading, applyState() {} } };
  const context = vm.createContext({ localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) }, crypto: webcrypto, window: win, Event, Date, require });
  win.SpellReadingSync = S;
  for (const file of ['words.js', 'practice-content.js', 'learning.js']) vm.runInContext(readFileSync(file, 'utf8'), context);
  return win.SpellLearning;
}
const progress = () => ({ bestStreak: 0, curStreak: 0, learned: [], missed: {}, srs: {}, sessionsCompleted: 0, patternMistakes: {} });

test('snapshots carry reading progress, merge it, and validate it; old backups still import', () => {
  const mine = state({ baseline: 250, unlocked: 2, read: { bees: 1 }, results: [res(10, 1)] });
  const api = setup(mine);
  const snap = api.snapshot(progress());
  assert.deepEqual(snap.reading, S.clean(mine));
  assert.deepEqual(api.validateSnapshot(JSON.parse(JSON.stringify(snap))).reading, snap.reading);

  const other = JSON.parse(JSON.stringify(snap));
  other.reading = S.clean(state({ baseline: 250, unlocked: 3, read: { bees: 4 }, results: [res(20, 2)] }));
  const merged = api.mergeSnapshots(snap, other);
  assert.equal(merged.reading.unlocked, 3);
  assert.equal(merged.reading.read.bees, 4);
  assert.deepEqual(merged.reading.results.map(r => r.at), [10, 20]);

  // A backup from before this feature has no reading section, on either side.
  const old = JSON.parse(JSON.stringify(snap)); delete old.reading;
  assert.equal(api.validateSnapshot(old).reading, undefined);
  assert.deepEqual(api.mergeSnapshots(snap, old).reading, snap.reading);
  assert.equal(api.mergeSnapshots(old, old).reading, undefined);

  // Bad reading data is rejected or cleaned, never stored as is.
  const bad = JSON.parse(JSON.stringify(snap)); bad.reading = 'nope';
  assert.throws(() => api.validateSnapshot(bad));
  const messy = JSON.parse(JSON.stringify(snap)); messy.reading.extra = 1; messy.reading.results.push({ at: 1, level: 1, share: 'x' });
  assert.deepEqual(api.validateSnapshot(messy).reading, snap.reading);
});

test('a trainer that was never used adds nothing to the snapshot', () => {
  assert.equal(setup(state()).snapshot(progress()).reading, undefined);
});
