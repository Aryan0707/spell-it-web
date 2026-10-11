const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../reading-a11y.js');

test('text size is clamped to the four steps', () => {
  assert.equal(A.SIZE_STEPS.length, 4);
  assert.equal(A.clampSize(0), 1);
  assert.equal(A.clampSize(9), 4);
  assert.equal(A.clampSize('3'), 3);
  assert.equal(A.clampSize(2.6), 3);
  assert.equal(A.clampSize('big'), 1);
  assert.equal(A.clampSize(undefined), 1);
  assert.equal(A.stepSize(4, 1), 4);
  assert.equal(A.stepSize(1, -1), 1);
  assert.equal(A.stepSize(2, 1), 3);
});

test('prefs are sanitised', () => {
  assert.deepEqual(A.sanitizePrefs(null), { size: 1, slowStart: false });
  assert.deepEqual(A.sanitizePrefs({ size: 7, slowStart: 'yes' }), { size: 4, slowStart: false });
  assert.deepEqual(A.sanitizePrefs({ size: 2, slowStart: true, extra: 1 }), { size: 2, slowStart: true });
  assert.deepEqual(A.sanitizePrefs('x'), { size: 1, slowStart: false });
});

test('arrow keys move by word and stop at the ends', () => {
  assert.equal(A.nextWordIndex(0, 'ArrowRight', 5), 1);
  assert.equal(A.nextWordIndex(4, 'ArrowRight', 5), 4);
  assert.equal(A.nextWordIndex(0, 'ArrowLeft', 5), 0);
  assert.equal(A.nextWordIndex(3, 'ArrowUp', 5), 2);
  assert.equal(A.nextWordIndex(3, 'ArrowDown', 5), 4);
  assert.equal(A.nextWordIndex(3, 'Home', 5), 0);
  assert.equal(A.nextWordIndex(1, 'End', 5), 4);
  assert.equal(A.nextWordIndex(1, 'a', 5), 1);
  assert.equal(A.nextWordIndex(0, 'ArrowRight', 0), 0);
  assert.equal(A.nextWordIndex(99, 'ArrowLeft', 5), 3);
});

test('page keys jump by paragraph', () => {
  const starts = [0, 10, 25];
  assert.equal(A.nextWordIndex(3, 'PageDown', 40, starts), 10);
  assert.equal(A.nextWordIndex(25, 'PageDown', 40, starts), 25);
  assert.equal(A.nextWordIndex(12, 'PageUp', 40, starts), 10);
  assert.equal(A.nextWordIndex(10, 'PageUp', 40, starts), 0);
  assert.equal(A.nextWordIndex(0, 'PageUp', 40, starts), 0);
});

test('a typed answer finds its first word, ignoring case and punctuation', () => {
  const words = 'Bees fly about 3 miles, then dance.'.split(' ');
  assert.equal(A.findTyped(words, 'about 3 MILES'), 2);
  assert.equal(A.findTyped(words, 'dance'), 6);
  assert.equal(A.findTyped(words, 'miles then'), 4);
  assert.equal(A.findTyped(words, 'five miles'), -1);
  assert.equal(A.findTyped(words, '   '), -1);
});

test('scan messages say what happened and where the answer was', () => {
  assert.match(A.scanMessage({ hit: true, answer: '3 miles' }), /^Right/);
  assert.equal(A.scanMessage({ hit: false, picked: 'dance', answer: '3 miles' }), 'Not that one: dance. The answer was: 3 miles.');
  assert.equal(A.scanMessage({ hit: false, picked: '', answer: '3 miles' }), 'Time is up. The answer was: 3 miles.');
});

test('sprint pace: more than three words a second is flagged', () => {
  assert.equal(A.flashesPerSecond(180), 3);
  assert.equal(A.exceedsFlashLimit(180), false);
  assert.equal(A.exceedsFlashLimit(300), true);
  assert.equal(A.leadMs('flash', { slowStart: true }), 3000);
  assert.equal(A.leadMs('flash', { slowStart: false }), 800);
  assert.equal(A.leadMs('inline', { slowStart: true }), 400);
});
