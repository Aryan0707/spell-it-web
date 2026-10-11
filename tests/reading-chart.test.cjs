const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../reading-chart.js');

const r = (wpm, share, passed = true, level = 1) => ({ at: 0, level, passage: 'p', wpm, share, passed });

test('series keeps real, non-skimming reads and the last 30', () => {
  const s = C.chartSeries([r(0, 1), r(300, 1), r(1500, 1), r(1000, 0.5), r(250, 2 / 3, false)], { maxWpm: 1000 });
  assert.deepEqual(s.map((p) => p.eff), [300, 500, 167]);
  assert.deepEqual(s.map((p) => p.read), [1, 2, 3]);
  assert.equal(s[2].passed, false);
  const many = C.chartSeries(Array.from({ length: 45 }, (_, i) => r(200 + i, 1)));
  assert.equal(many.length, 30);
  assert.equal(many[0].read, 16);
  assert.equal(many[29].read, 45);
  assert.deepEqual(C.chartSeries(null), []);
});

test('niceTicks gives round steps that cover the range', () => {
  const t = C.niceTicks(0, 437);
  assert.deepEqual(t.ticks, [0, 100, 200, 300, 400, 500]);
  assert.equal(t.max, 500);
  assert.deepEqual(C.niceTicks(0, 100).ticks, [0, 20, 40, 60, 80, 100]);
  const flat = C.niceTicks(300, 300);
  assert.ok(flat.min < 300 && flat.max > 300);
  assert.ok(C.niceTicks(NaN, 5).ticks.length >= 2);
  for (const [lo, hi] of [[0, 7], [0, 1234], [120, 410], [0, 99]]) {
    const n = C.niceTicks(lo, hi);
    assert.ok(n.min <= lo && n.max >= hi && n.ticks.length <= 8, `${lo}-${hi}`);
  }
});

test('summarize: best, latest, change from the starting speed or the first read', () => {
  const s = C.chartSeries([r(200, 1), r(300, 1), r(280, 1)]);
  assert.deepEqual(C.summarize(s, 180), { count: 3, best: 300, latest: 280, start: 180, change: 100, changePct: 56 });
  const noBase = C.summarize(s, null);
  assert.equal(noBase.start, 200);
  assert.equal(noBase.change, 80);
  assert.equal(C.summarize(s.slice(0, 1), null).change, null);
  const empty = C.summarize([], 200);
  assert.equal(empty.latest, null);
  assert.equal(empty.change, null);
  assert.equal(C.summarize(C.chartSeries([r(150, 1)]), 200).change, -50);
});

test('layout keeps points, start and goal inside the plot', () => {
  const s = C.chartSeries([r(200, 1), r(300, 1), r(250, 1)]);
  const g = C.layout(s, { baseline: 200, goal: 260 });
  const { plot } = g;
  for (const p of g.points) {
    assert.ok(p.x >= plot.left && p.x <= plot.right && p.y >= plot.top - 0.1 && p.y <= plot.bottom + 0.1);
  }
  assert.ok(g.points[1].y < g.points[0].y, 'faster is higher');
  assert.ok(g.goalY < g.baselineY);
  assert.ok(g.axis.max >= 300);
  const one = C.layout(C.chartSeries([r(300, 1)]), {});
  assert.equal(one.points[0].x, (plot.left + plot.right) / 2);
  assert.equal(one.baselineY, null);
  const high = C.layout(C.chartSeries([r(500, 1), r(520, 1)]), {});
  assert.ok(high.axis.min > 0, 'a high cluster does not squash against zero');
});

test('signed uses a real minus', () => {
  assert.equal(C.signed(12), '+12');
  assert.equal(C.signed(-7), '−7');
  assert.equal(C.signed(0), '0');
});

test('change since start compares effective speed with the effective speed of the read that set the baseline', () => {
  // The first read ran at 250 wpm with 2 of 3 right (effective 167) and set the baseline. A later read at
  // 250 wpm with everything right is a real gain, not a drop from 250 to 250.
  const series = C.chartSeries([
    { at: 1, level: 1, wpm: 250, share: 2 / 3, passed: true },
    { at: 2, level: 2, wpm: 250, share: 1, passed: true },
  ]);
  const sum = C.summarize(series, 250);
  assert.equal(sum.start, 167);
  assert.equal(sum.change, 83);
});
