const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');

function setup(fetch = async () => { throw new Error('no network in this test'); }) {
  const storage = new Map();
  // As in a browser, the global object is the window, so scripts see each other's globals.
  const window = { dispatchEvent() {}, addEventListener() {}, fetch, AbortController, setTimeout, clearTimeout, crypto, Event: class {},
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) } };
  window.window = window;
  const context = vm.createContext(window);
  for (const file of ['words.js', 'meanings.js', 'sounds.js', 'learning.js', 'ai.js', 'word-info.js', 'packs.js', 'packs-world.js', 'packs-names.js']) {
    vm.runInContext(readFileSync(file, 'utf8'), context);
  }
  window.SpellAI.saveConfig({ apiKey: 'mock-test-key', useAI: true, model: 'mock/model' });
  return { window, context, storage };
}
const reply = items => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(items) } }] }) });
test('every curated word is a plain-letter word that passes the app\'s own validators', () => {
  const { window, context } = setup();
  const builtIn = new Set(vm.runInContext('WORD_LIST', context).flatMap(w => [w.word, ...Object.values(w.variants || {})]));
  const seen = new Set();
  for (const pack of window.SpellPacks.INDEX) for (const theme of pack.themes) {
    const words = window.SpellPacks.themeWords(pack.id, theme.id);
    assert.equal(words.length, theme.count, `${pack.id}/${theme.id}: the index count must match the data`);
    assert.ok(words.length <= 100, `${pack.id}/${theme.id}: a theme becomes one list, which holds at most 100 words`);
    for (const entry of words) {
      const id = entry.word;
      assert.match(id, /^[a-z]{2,24}$/, `${id}: plain a-z`);
      assert.ok(!seen.has(id), `${id}: listed twice`); seen.add(id);
      assert.ok(!builtIn.has(id), `${id}: already a built-in word`);
      assert.ok(window.SpellMeanings.fromRow(id, entry.meaning), `${id}: meaning row is rejected`);
      if (entry.sounds) assert.ok(window.SpellSounds.fromRow(id, entry.sounds), `${id}: sound guide is rejected`);
      if (entry.syllables) assert.equal(entry.syllables.replace(/-/g, ''), id, `${id}: syllables must spell the word`);
      assert.equal(entry.examples.length, 3, `${id}: three examples`);
      for (const s of entry.examples) { assert.equal(s.split('{word}').length, 2, `${id}: example needs {word} exactly once: ${s}`); assert.ok(s.length <= 200); }
      assert.ok(!new RegExp(`\\b${id}\\b`, 'i').test(entry.hint), `${id}: hint gives the word away`);
      assert.ok(entry.origin && entry.origin.length <= 120, `${id}: origin`);
      if (entry.lang) assert.match(entry.lang, /^[a-z]{2,3}$/);
    }
  }
  assert.ok(seen.size >= 60, 'a worthwhile number of words');
});

test('a pack word is stored as a short reference and read back in full', () => {
  const { window } = setup();
  const P = window.SpellPacks;
  const full = P.lookup('names', 'siobhan');
  const short = P.slim(full);
  assert.deepEqual(Object.assign({}, short), { word: 'siobhan', pack: 'names' });
  assert.deepEqual(Object.assign({}, P.hydrate(short)), Object.assign({}, full), 'reading it back gives the full word');
  assert.ok(JSON.stringify(short).length < 45 && JSON.stringify(full).length > 400);
});

test('what the learner changed is kept; empty fields never wipe the shipped details', () => {
  const { window } = setup();
  const P = window.SpellPacks;
  const edited = { ...P.lookup('names', 'siobhan'), hint: 'My own hint' };
  const short = P.slim(edited);
  assert.deepEqual(Object.assign({}, short), { word: 'siobhan', pack: 'names', hint: 'My own hint' });
  assert.equal(P.hydrate(short).hint, 'My own hint');
  assert.equal(P.hydrate(short).origin, P.lookup('names', 'siobhan').origin, 'other details still come from the pack');
  const blank = P.hydrate({ word: 'siobhan', pack: 'names', hint: '', syllables: '' });
  assert.equal(blank.hint, P.lookup('names', 'siobhan').hint, 'a blank field (what editing a list produces) does not erase the details');
});

test('words that are not from a loaded pack are stored untouched', () => {
  const { window } = setup();
  const P = window.SpellPacks;
  const aiWord = { word: 'quokka', hint: 'A small Australian marsupial.', origin: 'Noongar word' };
  assert.equal(P.slim(aiWord), aiWord);
  const orphan = { word: 'ghostword', pack: 'names', hint: 'Not in the pack file.' };
  assert.equal(P.slim(orphan), orphan, 'a word the pack does not know stays whole, so nothing is lost');
  const unloaded = { word: 'x', pack: 'not-loaded-pack', hint: 'Whole.' };
  assert.equal(P.hydrate(unloaded), unloaded);
});

test('lists, notebook records and the daily plan keep only the short form; the app still sees full words', () => {
  const { window, storage } = setup();
  const P = window.SpellPacks, L = window.SpellLearning;
  const theme = P.INDEX[1].themes[2]; // Irish names
  P.addToList('Names & places · Irish names', P.themeWords('names', theme.id));
  const raw = JSON.parse(storage.get('spellit_learning_v1'));
  const stored = Object.values(raw.lists)[0].entries;
  assert.equal(stored.length, 4);
  assert.ok(stored.every(e => Object.keys(e).sort().join() === 'pack,word'), 'only word and pack are saved');
  const seen = L.lists()[0].entries;
  assert.ok(seen.every(e => e.meaning && e.examples.length === 3 && e.origin), 'the app gets the full words back');
  L.recordAttempt(seen[0], 'sheevan');
  assert.deepEqual(Object.keys(JSON.parse(storage.get('spellit_learning_v1')).notebook.siobhan.entry).sort(), ['pack', 'word']);
});

test('saving a whole pack costs a fraction of the old storage', () => {
  const { window, storage } = setup();
  const P = window.SpellPacks;
  let before = 0;
  for (const pack of P.INDEX) for (const theme of pack.themes) before += JSON.stringify(P.themeWords(pack.id, theme.id)).length;
  for (const pack of P.INDEX) for (const theme of pack.themes) P.addToList(`${pack.title} · ${theme.title}`, P.themeWords(pack.id, theme.id));
  const after = storage.get('spellit_learning_v1').length;
  assert.ok(after < before / 3, `stored ${after} characters; full copies would be ${before}`);
});

test('short-form words pass backup validation, so they can be exported and synced', () => {
  const { window } = setup();
  const P = window.SpellPacks;
  for (const pack of P.INDEX) for (const theme of pack.themes) P.addToList(`${pack.title} · ${theme.title}`, P.themeWords(pack.id, theme.id));
  const snap = window.SpellLearning.snapshot({ bestStreak: 0, curStreak: 0, learned: [], missed: {}, srs: {}, sessionsCompleted: 0, patternMistakes: {} });
  assert.doesNotThrow(() => window.SpellLearning.validateSnapshot(JSON.parse(JSON.stringify(snap))));
  assert.equal(window.SpellLearning.lists().length, 11);
  assert.deepEqual(Array.from(window.SpellLearning.packsInUse()).sort(), ['names', 'world']);
});

test('only words that are said in their own language carry a voice language', () => {
  const { window } = setup();
  const P = window.SpellPacks;
  const withLang = P.INDEX.flatMap(p => p.themes.flatMap(t => P.themeWords(p.id, t.id))).filter(e => e.lang).map(e => e.word).sort();
  assert.deepEqual(Array.from(withLang), ['fika', 'hygge', 'saudade', 'schadenfreude', 'sisu', 'sobremesa']);
  assert.equal(P.lang('saudade'), 'pt'); assert.equal(P.lang('Saudade '), 'pt'); assert.equal(P.lang('karma'), '');
});

test('a personal note can be saved on any word, and clearing it never loses the record', () => {
  const { window, storage } = setup();
  const L = window.SpellLearning;
  const practicing = { word: 'practicing', hint: 'Doing something again and again to improve.' };
  L.saveNote('practicing', '', practicing);
  assert.equal(L.noteFor('practicing'), '', 'an empty note on a new word creates nothing');
  assert.equal(JSON.parse(storage.get('spellit_learning_v1') || '{"notebook":{}}').notebook.practicing, undefined);
  L.saveNote('practicing', 'American spelling: one c, ice at the end of practice is ise in UK.', practicing);
  assert.match(L.noteFor('practicing'), /^American spelling/);
  const rec = L.get().notebook.practicing;
  assert.deepEqual([rec.attempts.length, rec.entry.word], [0, 'practicing']);
  L.saveNote('practicing', '', practicing);
  assert.equal(L.noteFor('practicing'), '');
  assert.ok(L.get().notebook.practicing, 'the record stays, so another device cannot bring the old note back');
  assert.doesNotThrow(() => L.validateSnapshot(JSON.parse(JSON.stringify(L.snapshot({ bestStreak: 0, curStreak: 0, learned: [], missed: {}, srs: {}, sessionsCompleted: 0, patternMistakes: {} })))));
});

test('a note on a word you already missed keeps its attempts', () => {
  const { window } = setup();
  const L = window.SpellLearning;
  L.recordAttempt({ word: 'because' }, 'becuase');
  L.saveNote('because', 'be-cause: big elephants can always understand small elephants');
  const rec = L.get().notebook.because;
  assert.equal(rec.attempts.length, 1); assert.match(rec.note, /big elephants/);
});

test('fold turns names and foreign words into plain practice letters', () => {
  const { fold } = setup().window.SpellAI;
  assert.equal(fold('Siobhán'), 'siobhan');
  assert.equal(fold('Straße'), 'strasse');
  assert.equal(fold('Ørsted'), 'orsted');
  assert.equal(fold("O'Brien"), 'obrien');
  assert.equal(fold('García'), 'garcia');
  assert.equal(fold('Łukasz'), 'lukasz');
  assert.equal(fold('Æther'), 'aether');
});

test('adding words to a list skips duplicates, keeps what is there and respects the 100-word limit', () => {
  const { window } = setup();
  const e = word => ({ word, hint: 'A test word.' });
  const first = window.SpellPacks.addToList('From Ask AI', [e('alpha'), e('bravo')]);
  assert.deepEqual([first.added, first.total], [2, 2]);
  const second = window.SpellPacks.addToList('From Ask AI', [e('bravo'), e('charlie')]);
  assert.deepEqual([second.added, second.total], [1, 3]);
  assert.equal(second.listId, first.listId, 'the same list is reused');
  const many = Array.from({ length: 120 }, (_, i) => e('w' + 'abcdefghij'[i % 10] + 'klmnopqrstuv'[Math.floor(i / 10)] + 'xy'));
  const filled = window.SpellPacks.addToList('Big', many);
  assert.equal(filled.total, 100); assert.ok(filled.full);
});

test('names are capitalised in sentences, other words are not', () => {
  const { window } = setup();
  const name = { word: 'siobhan', meaning: 'first name | A traditional Irish girl\'s name, said with a sh sound at the start. | ' };
  const plain = { word: 'fern', meaning: 'noun | A green plant with feathery leaves that grows in damp shade. | plant' };
  assert.equal(window.SpellWordInfo.shownWord(name), 'Siobhan');
  assert.equal(window.SpellWordInfo.shownWord(plain), 'fern');
});

const siobhan = {
  word: 'siobhan', written: 'Siobhán', origin: 'Irish first name', lang: '', hint: "A traditional Irish girl's name.", partOfSpeech: 'first name',
  definition: "A traditional Irish girl's name, said with a sh sound at the start.", related: [],
  examples: ['Siobhan won the school spelling prize.', 'My friend Siobhan always spells it out for new teachers.', 'Nobody guesses how to say Siobhan on the first try.'],
  syllables: 'sio-bhan', respelling: 'shi-VAWN', ipa: '/ʃɪˈvɔːn/', soundNote: 'In Irish, sio says shi and bh says v.',
};
test('suggested words from a chat are folded, validated and keep their original spelling', async () => {
  let request;
  const { window } = setup(async (_, o) => { request = JSON.parse(o.body); return reply([
    siobhan,
    { word: 'saudade', written: 'saudade', origin: 'Portuguese word', lang: 'PT', hint: 'A deep, wistful longing for something far away.' },
    { word: 'déjà vu', written: 'déjà vu', origin: 'French phrase', hint: 'Two words, so refused.' },
    { word: 'siobhan', written: 'Siobhán', hint: 'A duplicate.' },
    { word: 'ab', hint: 'Too short.' },
    { word: 'nohint', origin: 'Test' },
    { word: 'ørsted', written: 'Ørsted', origin: 'Danish surname', hint: 'A Danish family name.', lang: 'not-a-code' },
  ]); });
  const items = await window.SpellAI.suggestWords([{ role: 'user', content: 'Give me Irish names' }, { role: 'assistant', content: '**Siobhán**, Saoirse...' }], { spellingStyle: 'uk' });
  assert.deepEqual(Array.from(items, i => i.word), ['siobhan', 'saudade', 'orsted']);
  const [s, d, o] = items;
  assert.equal(s.origin, 'Irish first name · Siobhán', 'the accented spelling is kept');
  assert.match(s.meaning, /^first name \|/); assert.match(s.sounds, /^sio-bhan \|/); assert.equal(s.examples.length, 3);
  assert.equal(d.lang, 'pt'); assert.equal(d.origin, 'Portuguese word');
  assert.equal(o.lang, undefined, 'an invalid language code is dropped'); assert.equal(o.origin, 'Danish surname · Ørsted');
  assert.match(request.messages[1].content, /Learner: Give me Irish names/);
  assert.match(request.messages[1].content, /British pronunciation/);
  assert.equal((request.messages[1].content.match(/- partOfSpeech:/g) || []).length, 1, 'one partOfSpeech rule, not two that disagree');
});

test('suggestions fail clearly when nothing usable comes back', async () => {
  const { window } = setup(async () => reply([{ word: 'x' }, null, 'text']));
  await assert.rejects(window.SpellAI.suggestWords([{ role: 'assistant', content: 'Hello' }]), /No words to add/);
});
