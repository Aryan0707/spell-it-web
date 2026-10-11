const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../reading-listen.js');
const { PASSAGES } = require('../reading-passages.js');

test('sentences split at . ! ? and keep abbreviations, initials and decimals whole', () => {
  assert.deepEqual(L.splitSentences('It rained. We stayed in! Why not?'), ['It rained.', 'We stayed in!', 'Why not?']);
  assert.deepEqual(L.splitSentences('Dr. Smith met Mr. Jones. They talked.'), ['Dr. Smith met Mr. Jones.', 'They talked.']);
  assert.deepEqual(L.splitSentences('The ratio was 3.5 to 1. It held.'), ['The ratio was 3.5 to 1.', 'It held.']);
  assert.deepEqual(L.splitSentences('J. R. R. Tolkien wrote it. Fine.'), ['J. R. R. Tolkien wrote it.', 'Fine.']);
  assert.deepEqual(L.splitSentences('Fruit, e.g. apples, is good. Eat it.'), ['Fruit, e.g. apples, is good.', 'Eat it.']);
});

test('closing quotes and brackets stay with their sentence, and an ellipsis ends one', () => {
  assert.deepEqual(L.splitSentences('She said "Go home." Then she left.'), ['She said "Go home."', 'Then she left.']);
  assert.deepEqual(L.splitSentences('He asked (quietly.) Nobody answered.'), ['He asked (quietly.)', 'Nobody answered.']);
  assert.deepEqual(L.splitSentences('Well… maybe not.'), ['Well…', 'maybe not.']);
  assert.deepEqual(L.splitSentences('Made in the U.S. The end.'), ['Made in the U.S.', 'The end.']);
  assert.deepEqual(L.splitSentences('The U.S. army grew.'), ['The U.S. army grew.']);
});

test('text without a final stop, and empty text, still split sensibly', () => {
  assert.deepEqual(L.splitSentences('No stop here'), ['No stop here']);
  assert.deepEqual(L.splitSentences('   '), []);
  assert.deepEqual(L.splitSentences(null), []);
});

test('every built-in passage splits into sentences that rebuild it word for word', () => {
  for (const p of PASSAGES) {
    const sentences = L.sentencesOf(p.paragraphs);
    const words = sentences.flatMap((s) => s.words);
    assert.deepEqual(words, p.paragraphs.join(' ').split(/\s+/).filter(Boolean), p.id);
    sentences.forEach((s, i) => {
      assert.equal(s.first, sentences.slice(0, i).reduce((n, x) => n + x.words.length, 0));
      assert.equal(s.text, s.words.join(' '));
    });
    assert.ok(sentences.length >= 6 && sentences.length <= 20, `${p.id} has ${sentences.length} sentences`);
  }
});

test('word time grows with letters, and a comma adds a pause', () => {
  assert.ok(L.wordMs('extraordinary') > L.wordMs('cat'));
  assert.ok(L.wordMs('cat,') > L.wordMs('cat'));
  assert.equal(L.wordMs('cat.'), L.wordMs('cat'));
  assert.ok(L.wordMs('...') > 0);
});

test('a schedule runs in order, scales with speed and factor, and starts after the lead', () => {
  const words = ['The', 'octopus,', 'quietly', 'left.'];
  const a = L.buildSchedule(words);
  assert.equal(a.words[0].start, 0);
  a.words.forEach((w, i) => { assert.ok(w.end > w.start); if (i) assert.equal(w.start, a.words[i - 1].end); });
  assert.equal(a.total, a.words[3].end);
  const fast = L.buildSchedule(words, { speed: 1.2 });
  const slow = L.buildSchedule(words, { speed: 0.8 });
  assert.ok(fast.total < a.total && a.total < slow.total);
  assert.ok(Math.abs(fast.total - a.total / 1.2) < 1e-6);
  assert.ok(Math.abs(L.buildSchedule(words, { factor: 2 }).total - a.total * 2) < 1e-6);
  const led = L.buildSchedule(words, { lead: 300 });
  assert.equal(led.words[0].start, 300);
  assert.ok(Math.abs(led.total - (a.total + 300)) < 1e-6);
});

test('the word at a time: none before the lead, the right one inside, the last one after the end', () => {
  const s = L.buildSchedule(['one', 'two', 'three'], { lead: 100 });
  assert.equal(L.wordAt(s, 0), -1);
  assert.equal(L.wordAt(s, 100), 0);
  assert.equal(L.wordAt(s, s.words[1].start + 1), 1);
  assert.equal(L.wordAt(s, s.words[2].start), 2);
  assert.equal(L.wordAt(s, s.total + 5000), 2);
  assert.equal(L.wordAt({ words: [], total: 0 }, 10), -1);
});

test('the timeline finds the sentence and word at a time, with gaps between sentences', () => {
  const sentences = L.sentencesOf(['One two three. Four five six seven.']);
  const t = L.buildTimeline(sentences, { gap: 200 });
  assert.equal(t.sentences.length, 2);
  assert.equal(t.sentences[1].start, t.sentences[0].end + 200);
  assert.equal(t.total, t.sentences[1].end);
  assert.deepEqual(L.locate(t, 0, sentences), { sentence: 0, word: 0, globalWord: 0 });
  const second = t.sentences[1];
  const mid = L.locate(t, second.start + second.schedule.words[2].start + 1, sentences);
  assert.deepEqual(mid, { sentence: 1, word: 2, globalWord: 5 });
  const gap = L.locate(t, t.sentences[0].end + 100, sentences);
  assert.deepEqual(gap, { sentence: 0, word: 2, globalWord: 2 });
  assert.equal(L.locate(t, -1, sentences), null);
  assert.equal(L.locate(t, t.total + 1, sentences), null);
  assert.equal(L.locate({ sentences: [], total: 0 }, 0), null);
});

test('a word-boundary character position maps to the word it falls in', () => {
  const words = ['The', 'octopus', 'left.'];   // spoken as "The octopus left."
  assert.equal(L.wordAtChar(words, 0), 0);
  assert.equal(L.wordAtChar(words, 3), 0);
  assert.equal(L.wordAtChar(words, 4), 1);
  assert.equal(L.wordAtChar(words, 12), 2);
  assert.equal(L.wordAtChar(words, 999), 2);
  assert.equal(L.wordAtChar([], 3), 0);
});

test('calibration moves toward the measured pace, is bounded, and ignores noise', () => {
  assert.equal(L.calibrate(1, 1000, 1000), 1);
  const slower = L.calibrate(1, 1000, 1500);
  assert.ok(slower > 1 && slower < 1.5);
  const faster = L.calibrate(1, 1000, 700);
  assert.ok(faster < 1 && faster > 0.7);
  assert.ok(L.calibrate(1, 1000, 100000) <= 2.5, 'one wild sentence is capped');
  let f = 1;
  for (let i = 0; i < 30; i++) f = L.calibrate(f, 1000, 100000);
  assert.equal(f, 2.5);
  for (let i = 0; i < 60; i++) f = L.calibrate(f, 1000, 1);
  assert.equal(f, 0.5);
  assert.equal(L.calibrate(1, 1000, 5000, 2), 1, 'two-word sentences are too short to learn from');
  assert.equal(L.calibrate(1.3, 0, 500), 1.3);
  assert.equal(L.calibrate(1.3, 500, 0), 1.3);
});

test('a tapped word is spoken without quotes or edge punctuation', () => {
  assert.equal(L.cleanWord('"Hello,"'), 'Hello');
  assert.equal(L.cleanWord("octopus's"), "octopus's");
  assert.equal(L.cleanWord('well-known.'), 'well-known');
  assert.equal(L.cleanWord('...'), '');
  assert.equal(L.cleanWord(undefined), '');
});

test('the three speeds are 0.8x, 1x and 1.2x', () => {
  assert.deepEqual(L.SPEEDS, [0.8, 1, 1.2]);
});
