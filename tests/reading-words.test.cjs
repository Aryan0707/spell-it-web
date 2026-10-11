const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../reading-words.js');
const { PASSAGES } = require('../reading-passages.js');

test('tapped words are lowercased, stripped of edge punctuation and kept only as plain letters', () => {
  assert.equal(W.normaliseWord('Bees,'), 'bees');
  assert.equal(W.normaliseWord('“Remarkable.”'), 'remarkable');
  assert.equal(W.normaliseWord('(honeycomb);'), 'honeycomb');
  assert.equal(W.normaliseWord('RHYTHM'), 'rhythm');
});

test('words that cannot be practised are refused', () => {
  for (const bad of ['of', 'a', '', '1990', 'don\'t', 'well-known', 'café', 'x1y2z', '—', null, undefined, 'a'.repeat(25)]) {
    assert.equal(W.normaliseWord(bad), '', String(bad));
  }
  assert.equal(W.normaliseWord('a'.repeat(24)), 'a'.repeat(24));
});

test('a paragraph splits into pieces, each with its saveable word or none', () => {
  const t = W.tokenize('In the 1990s, bees\n fly.');
  assert.deepEqual(t.map(x => x.text), ['In', 'the', '1990s,', 'bees', 'fly.']);
  assert.deepEqual(t.map(x => x.word), ['', 'the', '', 'bees', 'fly']);
  assert.deepEqual(W.tokenize(''), []);
});

test('every shipped passage can be tokenised and offers saveable words', () => {
  for (const p of PASSAGES) {
    const words = p.paragraphs.flatMap(W.tokenize).filter(x => x.word);
    assert.ok(words.length > 50, p.id);
  }
});

test('planAdd skips duplicates, refuses bad words and stops at the list limit', () => {
  assert.deepEqual(W.planAdd(['bees'], 'Honey.'), { status: 'added', word: 'honey' });
  assert.deepEqual(W.planAdd(['bees'], 'bees,'), { status: 'duplicate', word: 'bees' });
  assert.deepEqual(W.planAdd([], 'it'), { status: 'invalid', word: '' });
  const full = Array.from({ length: W.MAX_LIST }, (_, i) => `w${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}x`);
  assert.equal(W.planAdd(full, 'honey').status, 'full');
  assert.equal(W.planAdd(full, full[3]).status, 'duplicate');
  assert.equal(W.planAdd(['one', 'two'], 'three', 2).status, 'full');
});

test('an entry carries what the word bank knows and is otherwise empty but valid', () => {
  assert.deepEqual(W.makeEntry('honey'), { word: 'honey', hint: '', syllables: '' });
  const known = { word: 'honey', hint: 'a sweet food', syllables: 'hon-ey', difficulty: 'easy' };
  assert.deepEqual(W.makeEntry('honey', known), known);
});

test('removing a word leaves the others in order', () => {
  const entries = [{ word: 'ant' }, { word: 'bee' }, { word: 'cow' }];
  assert.deepEqual(W.withoutWord(entries, 'bee').map(e => e.word), ['ant', 'cow']);
  assert.equal(W.withoutWord(entries, 'zzz').length, 3);
});

test('the summary line uses plain counts', () => {
  assert.equal(W.summaryText(0, 0), '');
  assert.equal(W.summaryText(0, 3), '3 words in “From reading”.');
  assert.equal(W.summaryText(1, 1), 'Saved 1 word from this read. 1 in “From reading”.');
  assert.equal(W.summaryText(2, 7), 'Saved 2 words from this read. 7 in “From reading”.');
});
