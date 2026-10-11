const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../reading-custom.js');

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const sentences = (n) => Array.from({ length: n }, (_, i) => `This is sentence number ${i} of the text.`).join(' ');
const goodQuestions = () => ({ questions: [
  { kind: 'gist', q: 'What is the text mainly about?', options: ['Bees', 'Boats', 'Bread', 'Birds'], answer: 0 },
  { kind: 'fact', q: 'How many legs does a bee have?', options: ['Four', 'Six', 'Eight', 'Ten'], answer: 1 },
  { kind: 'inference', q: 'Why do bees dance in the hive?', options: ['To keep warm', 'To share where food is', 'To sleep', 'To scare wasps'], answer: 1 },
] });

test('clean-up strips HTML, markdown and link noise and keeps the words', () => {
  const html = '<h1>Title</h1><p>Hello <b>big</b> &amp; small <a href="x">world</a>.</p><script>alert(1)</script><!-- note --><p>Second&nbsp;one &#39;ok&#39;</p>';
  assert.equal(C.cleanText(html), "Title\n\nHello big & small world.\n\nSecond one 'ok'");
  const md = '# Heading\n\n**Bold** and *italic* and _under_ and `code`.\n\n- item one\n- item two\n\n> quoted\n\n[a link](https://example.com/x) and ![pic](p.png) see https://example.com/y[3]\n\n---\n\n12';
  assert.equal(C.cleanText(md), 'Heading\n\nBold and italic and under and code.\n\nitem one item two\n\nquoted\n\na link and see');
});

test('clean-up fixes whitespace and wrapped lines', () => {
  assert.equal(C.cleanText('  one\t\ttwo   three \r\nfour\r\n\r\n\r\n\r\n five    six​'), 'one two three four\n\nfive six');
  assert.equal(C.cleanText('the exam-\nple was long'), 'the example was long');
  assert.equal(C.cleanText('a well-known fact'), 'a well-known fact');
  assert.equal(C.cleanText(null), '');
  assert.equal(C.cleanText('a < b and c > d'), 'a < b and c > d');
});

test('limits: too short and too long are rejected with a clear message, in range is accepted', () => {
  assert.equal(C.validateText('   ').reason, 'empty');
  const short = C.validateText(words(149));
  assert.equal(short.ok, false);
  assert.equal(short.reason, 'short');
  assert.match(short.message, /149 words.*at least 150/);
  const long = C.validateText(words(3001));
  assert.equal(long.reason, 'long');
  assert.match(long.message, /3,001 words.*3,000/);
  assert.equal(C.validateText(words(150)).ok, true);
  assert.equal(C.validateText(words(3000)).ok, true);
  // the limit applies to the cleaned text, not to the markup around it
  assert.equal(C.validateText('<p>' + words(150) + '</p><div class="x"></div>').words, 150);
});

test('paragraphs: blank lines split, and a long unbroken block is cut at sentence ends', () => {
  assert.deepEqual(C.splitParagraphs('One here.\n\nTwo here.'), ['One here.', 'Two here.']);
  const parts = C.splitParagraphs(sentences(60));
  assert.ok(parts.length >= 3);
  for (const p of parts) assert.ok(/[.]$/.test(p), p);
  assert.equal(parts.join(' '), sentences(60));
  assert.equal(C.splitParagraphs(sentences(10)).length, 1);
});

test('title comes from the learner, or from the first words', () => {
  assert.equal(C.titleFor('x', '  My   chapter '), 'My chapter');
  assert.equal(C.titleFor('The quick brown fox jumps over the lazy dog'), 'The quick brown fox jumps over…');
  assert.equal(C.titleFor('Short text'), 'Short text');
  assert.equal(C.titleFor(''), 'Your text');
  const p = C.buildPassage('First para.\n\nSecond para.', 'T');
  assert.deepEqual(p, { id: 'custom', title: 'T', paragraphs: ['First para.', 'Second para.'], questions: [] });
});

test('pacer defaults to the baseline x 1.15, steps by 10 and stays within 100 to 800', () => {
  assert.equal(C.defaultPace(200), 230);
  assert.equal(C.defaultPace(null), 200);
  assert.equal(C.defaultPace(0), 200);
  assert.equal(C.defaultPace(1000), 800);
  assert.equal(C.defaultPace(50), 100);
  assert.equal(C.stepPace(230, 1), 240);
  assert.equal(C.stepPace(230, -1), 220);
  assert.equal(C.stepPace(100, -1), 100);
  assert.equal(C.stepPace(800, 1), 800);
  assert.equal(C.clampPace(5000), 800);
});

test('question validator accepts a good reply, shuffles options and keeps the right answer', () => {
  const q = C.validateQuestions(JSON.stringify(goodQuestions()), () => 0.5);
  assert.deepEqual(q.map((x) => x.kind), ['gist', 'fact', 'inference']);
  for (let seed = 0; seed < 20; seed++) {
    let s = seed + 1;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const out = C.validateQuestions(goodQuestions(), rnd);
    assert.equal(out[0].options[out[0].answer], 'Bees');
    assert.equal(out[1].options[out[1].answer], 'Six');
    assert.equal(out[2].options[out[2].answer], 'To share where food is');
  }
});

test('question validator reads fenced or chatty replies and a bare array, in any order', () => {
  const reply = 'Sure! ```json\n' + JSON.stringify(goodQuestions()) + '\n``` hope it helps';
  assert.equal(C.validateQuestions(reply).length, 3);
  const reordered = goodQuestions().questions.reverse();
  assert.deepEqual(C.validateQuestions(reordered).map((x) => x.kind), ['gist', 'fact', 'inference']);
});

test('question validator rejects anything off', () => {
  const bad = (mutate) => { const g = goodQuestions(); mutate(g.questions); return C.validateQuestions(g); };
  assert.equal(C.validateQuestions('not json at all'), null);
  assert.equal(C.validateQuestions(null), null);
  assert.equal(C.validateQuestions({ questions: [] }), null);
  assert.equal(bad((q) => q.pop()), null);
  assert.equal(bad((q) => { q[1].kind = 'gist'; }), null);
  assert.equal(bad((q) => { q[0].kind = 'opinion'; }), null);
  assert.equal(bad((q) => { q[0].options.pop(); }), null);
  assert.equal(bad((q) => { q[0].options[1] = 'bees'; }), null);
  assert.equal(bad((q) => { q[0].options[1] = 'All of the above'; }), null);
  assert.equal(bad((q) => { q[0].options[1] = 7; }), null);
  assert.equal(bad((q) => { q[0].answer = 4; }), null);
  assert.equal(bad((q) => { q[0].answer = '1'; }), null);
  assert.equal(bad((q) => { q[0].answer = 1.5; }), null);
  assert.equal(bad((q) => { q[0].q = ''; }), null);
  assert.equal(bad((q) => { q[2] = 'a string'; }), null);
  assert.equal(bad((q) => { q[0].q = 'x'.repeat(300); }), null);
});

test('asking the model: one retry, then give up quietly', async () => {
  const calls = [];
  const ok = await C.generateQuestions('text', async (m) => { calls.push(m); return calls.length === 1 ? 'garbage' : JSON.stringify(goodQuestions()); });
  assert.equal(ok.length, 3);
  assert.equal(calls.length, 2);
  assert.match(calls[0][1].content, /=== TEXT ===\ntext\n=== END ===/);
  assert.match(calls[1][1].content, /could not be used/);

  let n = 0;
  assert.equal(await C.generateQuestions('text', async () => { n++; return '{}'; }), null);
  assert.equal(n, 2);

  n = 0;
  assert.equal(await C.generateQuestions('text', async () => { n++; throw new Error('offline'); }), null);
  assert.equal(n, 2);

  n = 0;
  assert.equal((await C.generateQuestions('text', async () => { n++; if (n === 1) throw new Error('timeout'); return goodQuestions(); })).length, 3);
});

test('self-rating maps to a share, and the recap lists first sentences', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(C.ratingShare), [0.2, 0.4, 0.6, 0.8, 1]);
  assert.equal(C.ratingShare(0), null);
  assert.equal(C.ratingShare(6), null);
  assert.equal(C.ratingShare(2.5), null);
  assert.equal(C.ratingShare('3'), null);
  assert.deepEqual(C.firstSentences(['Alpha one. Alpha two.', 'No stop here', 'Third? Yes.']), ['Alpha one.', 'No stop here', 'Third?']);
  assert.equal(C.firstSentences(Array(30).fill('A b.')).length, 10);
});

test('history keeps the last 20, drops junk, and describes each outcome', () => {
  let h = [];
  for (let i = 0; i < 25; i++) h = C.addHistory(h, { title: `T${i}`, words: 200, wpm: 250, share: 2 / 3, rating: null, mode: 'own', at: 1000 + i });
  assert.equal(h.length, 20);
  assert.equal(h[0].title, 'T5');
  assert.equal(h[19].title, 'T24');
  assert.deepEqual(C.sanitizeHistory([null, 5, { title: 'x' }, { title: 'ok', words: 150.4, wpm: -3, share: 7, rating: 9, mode: 'weird', at: 5 }]),
    [{ title: 'ok', words: 150, wpm: 0, share: 1, rating: null, mode: 'own', at: 5 }]);
  assert.deepEqual(C.sanitizeHistory('nope'), []);
  assert.equal(C.outcomeLabel({ share: 2 / 3 }), '2 of 3 right');
  assert.equal(C.outcomeLabel({ share: null, rating: 4 }), 'followed 4 of 5');
  assert.equal(C.shareOf({ share: null, rating: 4 }), 0.8);
  assert.equal(C.shareOf({ share: 1 / 3, rating: null }), 1 / 3);
});

test('custom reads never touch the trainer progress: the module does not call recordResult', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'reading-custom.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/recordResult\s*\(/.test(src), 'must not call recordResult');
  assert.ok(!/spellit_reading["']/.test(src), 'must not use the trainer storage key');
});
