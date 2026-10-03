const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');

function load() {
  const context = vm.createContext({ window: {} });
  for (const file of ['words.js', 'meanings.js', 'sounds.js']) vm.runInContext(readFileSync(file, 'utf8'), context);
  return { sounds: context.window.SpellSounds, meanings: context.window.SpellMeanings };
}

test('untrusted sound guides are checked property by property', () => {
  const { sounds } = load();
  const ok = sounds.fromRow('definitely', 'def-i-nite-ly | DEF-uh-nit-lee | /ˈdɛf.ə.nɪt.li/ | The ending sounds like it.');
  assert.equal(ok.stress, 0);
  assert.equal(ok.source, 'ai');
  assert.equal(sounds.fromRow('cat', 'cat | kat | kæt').say[0], 'KAT', 'single syllables are shown stressed; a missing slash is added');
  assert.equal(sounds.fromRow('cat', 'cat | kat | kæt').ipa, '/kæt/');
  for (const [word, row] of [
    ['cat', 'ca-t | KA-t | /kæt/ | x | extra'],                       // too many fields
    ['cat', 'dog | DAWG | /dɔɡ/'],                                       // syllables do not spell the word
    ['definitely', 'def-i-nite-ly | DEF-UH-nit-lee | /x/'],              // two stressed parts
    ['definitely', 'def-i-nite-ly | def-uh-nit-lee | /x/'],              // no stressed part
    ['definitely', 'def-i-nite-ly | DEF-uh-nit | /x/'],                  // wrong number of parts
    ['cat', 'cat | K4T | /kæt/'],                                        // not letters
    ['cat', 'cat | KAT | /' + 'x'.repeat(70) + '/'],                     // absurd length
    ['cat', 42], ['cat', undefined],
  ]) assert.equal(sounds.fromRow(word, row), null, JSON.stringify(row));
});

test('untrusted meanings are checked and cannot give the word away', () => {
  const { meanings } = load();
  assert.deepEqual(JSON.parse(JSON.stringify(meanings.fromRow('fern', 'noun | A green plant with feathery leaves. | plant, frond'))),
    { pos: 'noun', definition: 'A green plant with feathery leaves.', related: ['plant', 'frond'] });
  for (const row of [
    'noun | A fern is a plant with leaves. | plant',                     // contains the word
    'noun | Short | plant',                                              // too short
    'n0un | A green plant with feathery leaves. | plant',                // bad part of speech
    'noun | A green plant with {word} leaves. | plant',                  // template syntax
    'noun | A green plant with feathery leaves. | a, b, c, d, e',        // too many related words
    'noun | A green plant with feathery leaves. | <script>',             // not a word
    undefined, 7,
  ]) assert.equal(meanings.fromRow('fern', row), null, JSON.stringify(row));
});

test('the hand-checked built-in data wins over an AI-written row for the same word', () => {
  const { sounds, meanings } = load();
  const entry = { word: 'cat', meaning: 'noun | AI says something quite different about it. | feline', sounds: 'cat | KAT | /different/' };
  assert.match(meanings.forEntry(entry).definition, /furry animal/);
  assert.equal(sounds.forEntry(entry).ipa, '/kæt/');
  const own = { word: 'fern', meaning: 'noun | A green plant with feathery leaves. | plant', sounds: 'fern | FURN | /fɝn/' };
  assert.equal(meanings.forEntry(own).pos, 'noun');
  assert.equal(sounds.forEntry(own).source, 'ai');
  assert.equal(meanings.forEntry({ word: 'fern' }), null, 'no data at all falls back to the plain hint');
});

// ---- shared word info used by the study card and the My words list view ----
function loadInfo() {
  const context = vm.createContext({ window: {} });
  for (const file of ['words.js', 'meanings.js', 'sounds.js', 'word-info.js']) vm.runInContext(readFileSync(file, 'utf8'), context);
  return context.window.SpellWordInfo;
}
const plain = x => JSON.parse(JSON.stringify(x));

test('a built-in word is complete; a plain custom word is missing everything', () => {
  const info = loadInfo();
  assert.equal(info.needsDetails({ word: 'umbrella' }), false);
  assert.equal(info.needsDetails({ word: 'colour' }), false, 'UK spellings resolve to the built-in word');
  assert.equal(info.needsDetails({ word: 'zebra', hint: 'A striped animal' }), true);
  assert.equal(info.forEntry({ word: 'zebra', hint: 'A striped animal' }).meaning, null);
  assert.equal(info.forEntry({ word: 'zebra', hint: 'A striped animal' }).hint, 'A striped animal');
});

test('merging fills gaps but never overwrites what the learner already has', () => {
  const info = loadInfo();
  const mine = { word: 'zebra', hint: 'My own definition' };
  const merged = info.mergeDetails(mine, { hint: 'AI definition', meaning: 'noun | A striped animal that lives in Africa. | horse', examples: ['A {word} ran past.'], sounds: 'zebra | ZEE-bruh | /ˈzi.brə/' }
  );
  assert.equal(merged.hint, 'My own definition', 'a typed definition is kept');
  assert.equal(merged.meaning, 'noun | A striped animal that lives in Africa. | horse');
  assert.deepEqual(plain(merged.examples), ['A {word} ran past.']);
  assert.equal(info.mergeDetails(merged, { meaning: 'noun | Something else entirely here. | x' }), merged, 'already complete: the very same object comes back');
  assert.equal(info.mergeDetails(mine, undefined), mine);
  assert.equal(info.mergeDetails(mine, { examples: [] }), mine, 'an empty examples list is not a detail');
  assert.equal(info.mergeDetails({ word: 'zebra', hint: '' }, { hint: 'AI definition' }).hint, 'AI definition', 'a blank definition is filled');
});

test('editing a list keeps saved details for unchanged words only', () => {
  const info = loadInfo();
  const saved = { word: 'zebra', hint: 'old', meaning: 'noun | A striped animal that lives in Africa. | horse', examples: ['A {word} ran past.'], sounds: 'zebra | ZEE-bruh | /ˈzi.brə/' };
  const kept = info.keepDetails(saved, { word: 'zebra', hint: 'new text', syllables: '' });
  assert.equal(kept.hint, 'new text');
  assert.equal(kept.meaning, saved.meaning);
  assert.deepEqual(plain(kept.examples), saved.examples);
  assert.equal(kept.sounds, saved.sounds);
  const fresh = { word: 'lion', hint: '' };
  assert.equal(info.keepDetails(saved, fresh), fresh, 'a different word gets nothing');
  assert.equal(info.keepDetails(undefined, fresh), fresh);
});

test('malformed saved examples are never shown', () => {
  const info = loadInfo();
  assert.deepEqual(plain(info.examplesOf({ word: 'zebra', examples: ['No placeholder', '{word} and {word}', 'Fine: {word}.', 42, 'x'.repeat(300) + '{word}'] })), ['Fine: {word}.']);
  assert.deepEqual(plain(info.examplesOf({ word: 'zebra', examples: 'not a list' })), []);
  assert.deepEqual(plain(info.examplesOf({ word: 'cat', examples: ['Mine {word}.'] })).length, 3, 'built-in sentences win');
});

test('details are gathered for incomplete words only, in batches, keeping earlier batches if a later one fails', async () => {
  const info = loadInfo();
  const entries = [{ word: 'umbrella' }, ...['zebra', 'fern', 'moss', 'pond', 'reed'].map(word => ({ word }))];
  const asked = [];
  const progress = [];
  const full = await info.gatherDetails(entries, async words => { asked.push(words); return words.map(word => ({ word })); }, { batch: 2, onProgress: (done, total) => progress.push([done, total]) });
  assert.deepEqual(plain(asked), [['zebra', 'fern'], ['moss', 'pond'], ['reed']], 'the complete built-in word is never sent');
  assert.deepEqual(plain(progress), [[0, 5], [2, 5], [4, 5]]);
  assert.equal(full.asked, 5);
  assert.equal(full.found.size, 5);
  assert.equal(full.failure, '');

  let calls = 0;
  const partial = await info.gatherDetails(entries, async words => { if (++calls === 2) throw new Error('rate limited'); return words.map(word => ({ word, hint: 'ok' })); }, { batch: 2 });
  assert.equal(calls, 2, 'stops at the first failure');
  assert.deepEqual([...partial.found.keys()], ['zebra', 'fern'], 'what arrived before the failure is kept');
  assert.equal(partial.failure, 'rate limited');

  let asks = 0;
  const none = await info.gatherDetails([{ word: 'umbrella' }, { word: 'cat' }], async () => { asks++; return []; });
  assert.equal(asks, 0, 'a list of complete words costs no request');
  assert.equal(none.asked, 0);
});

test('the sentence is spoken with the word in place and a capital when it starts the sentence', () => {
  const info = loadInfo();
  assert.equal(info.sentenceText('A {word} grew by the stream.', 'fern'), 'A fern grew by the stream.');
  assert.equal(info.sentenceText('{word} is a brand-new day.', 'tomorrow'), 'Tomorrow is a brand-new day.');
  assert.equal(info.sentenceText('Blue is my {word} shade.', 'favourite'), 'Blue is my favourite shade.', 'uses the learner\'s own spelling');
});

test('the spelling-bee audio says the word, its kind, a sentence, then the word again', () => {
  const info = loadInfo();
  assert.equal(info.spokenInSentence({ word: 'they' }, 0), 'they. pronoun. They are walking to school together. they.', 'a sentence that starts with the word gets a capital');
  assert.equal(info.spokenInSentence({ word: 'knock' }, 0), 'knock. verb or noun. Please knock before you come in. knock.', 'a slash in the part of speech is spoken as “or”');
  assert.equal(info.spokenInSentence({ word: 'colour' }, 0), 'colour. noun. Red is the colour of a ripe tomato. colour.', 'uses the learner\'s own spelling');
});

test('each tap can use a different example, wrapping around after the last', () => {
  const info = loadInfo();
  const spoken = [0, 1, 2, 3, 4].map(i => info.spokenInSentence({ word: 'friend' }, i));
  assert.equal(new Set(spoken.slice(0, 3)).size, 3, 'three different sentences');
  assert.equal(spoken[3], spoken[0]);
  assert.equal(spoken[4], spoken[1]);
  assert.equal(info.spokenInSentence({ word: 'friend' }, -1), spoken[1], 'a negative index still lands on an example');
});

test('a word with no example sentence gives no sentence audio, rather than a broken line', () => {
  const info = loadInfo();
  assert.equal(info.spokenInSentence({ word: 'zebra', hint: 'A striped animal' }), '');
  assert.equal(info.spokenInSentence(null), '');
  assert.ok(info.spokenInSentence({ word: 'zebra', examples: ['A {word} ran past.'] }).startsWith('zebra. A zebra ran past. zebra'), 'an AI word\'s own examples are used');
});

test('every built-in word yields clean sentence audio with no leftover placeholders', () => {
  const context = vm.createContext({ window: {} });
  for (const file of ['words.js', 'meanings.js', 'sounds.js', 'word-info.js']) vm.runInContext(readFileSync(file, 'utf8'), context);
  vm.runInContext('this.WORDS = WORD_LIST', context);
  const info = context.window.SpellWordInfo;
  const problems = [];
  for (const w of context.WORDS) for (const spelled of [w.word, ...Object.values(w.variants || {})]) {
    const text = info.spokenInSentence({ word: spelled }, 0);
    if (!text.startsWith(`${spelled}. `) || !text.endsWith(` ${spelled}.`) || /[{}]|undefined|null/.test(text)) problems.push(`${spelled}: ${text}`);
  }
  assert.deepEqual(problems, []);
});
