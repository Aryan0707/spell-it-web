const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../reading-daily.js');

const mk = (...days) => ({ ...D.emptyState(), days });

test('addDays moves by calendar days across month, year and leap boundaries', () => {
  assert.equal(D.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(D.addDays('2028-03-01', -1), '2028-02-29');
  assert.equal(D.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(D.addDays('2026-01-01', -1), '2025-12-31');
});

test('dayKey uses local date parts', () => {
  assert.equal(D.dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(D.dayKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('streak counts consecutive days ending today', () => {
  assert.equal(D.readingStreak(mk('2026-10-09', '2026-10-10', '2026-10-11'), '2026-10-11'), 3);
  assert.equal(D.readingStreak(mk('2026-10-09', '2026-10-11'), '2026-10-11'), 1);
  assert.equal(D.readingStreak(D.emptyState(), '2026-10-11'), 0);
});

test('not having read yet today does not break yesterday\'s streak', () => {
  assert.equal(D.readingStreak(mk('2026-10-09', '2026-10-10'), '2026-10-11'), 2);
  assert.equal(D.readingStreak(mk('2026-10-08', '2026-10-09'), '2026-10-11'), 0);
});

test('streak and week are unaffected by daylight saving changes', () => {
  // US spring forward 2026-03-08, fall back 2026-11-01; EU 2026-03-29 and 2026-10-25.
  for (const [start, end] of [['2026-03-06', '2026-03-10'], ['2026-10-30', '2026-11-03'], ['2026-03-27', '2026-03-31'], ['2026-10-23', '2026-10-27']]) {
    const days = [];
    for (let d = start; d <= end; d = D.addDays(d, 1)) days.push(d);
    assert.equal(days.length, 5, `${start}..${end}`);
    assert.equal(D.readingStreak(mk(...days), end), 5);
    assert.deepEqual(D.weekView(mk(...days), end).map(d => d.read), [false, false, true, true, true, true, true]);
  }
});

test('week view lists seven days ending today with read marks', () => {
  const week = D.weekView(mk('2026-10-06', '2026-10-09', '2026-10-11'), '2026-10-11');
  assert.deepEqual(week.map(d => d.day), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  assert.deepEqual(week.map(d => d.read), [false, true, false, false, true, false, true]);
  assert.deepEqual(week.map(d => d.today), [false, false, false, false, false, false, true]);
});

test('marking a read counts the day once and tracks passes for today', () => {
  let s = D.emptyState();
  assert.equal(D.readToday(s, '2026-10-11'), false);
  s = D.markRead(s, true, '2026-10-11');
  s = D.markRead(s, false, '2026-10-11');
  assert.deepEqual(s.days, ['2026-10-11']);
  assert.equal(D.readToday(s, '2026-10-11'), true);
  assert.deepEqual(D.todayCounts(s, '2026-10-11'), { reads: 2, passed: 1 });
  // A new day resets the counts but keeps the old day mark.
  s = D.markRead(s, false, '2026-10-12');
  assert.deepEqual(s.days, ['2026-10-11', '2026-10-12']);
  assert.deepEqual(D.todayCounts(s, '2026-10-12'), { reads: 1, passed: 0 });
  assert.deepEqual(D.todayCounts(s, '2026-10-13'), { reads: 0, passed: 0 });
  assert.equal(D.readingStreak(s, '2026-10-12'), 2);
});

test('markRead does not change the state it was given', () => {
  const s = D.emptyState();
  D.markRead(s, true, '2026-10-11');
  assert.deepEqual(s.days, []);
});

test('only the last 120 days are kept', () => {
  let s = D.emptyState();
  let day = '2026-01-01';
  for (let i = 0; i < 130; i++) { s = D.markRead(s, true, day); day = D.addDays(day, 1); }
  assert.equal(s.days.length, 120);
  assert.equal(s.days[119], D.addDays('2026-01-01', 129));
});

test('sanitize drops bad data and clamps counts', () => {
  assert.deepEqual(D.sanitize(null), D.emptyState());
  assert.deepEqual(D.sanitize({ days: 'x' }).days, []);
  const s = D.sanitize({ days: ['2026-10-11', 'nope', 5, '2026-10-11', '2026-10-09'], today: { day: '2026-10-11', reads: 2, passed: 9 } });
  assert.deepEqual(s.days, ['2026-10-09', '2026-10-11']);
  assert.deepEqual(s.today, { day: '2026-10-11', reads: 2, passed: 2 });
  assert.deepEqual(D.sanitize({ today: { day: 'bad', reads: 3 } }).today, { day: '', reads: 0, passed: 0 });
});
