async page => {
  const assert = (condition, text) => { if (!condition) throw new Error(text); };
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('spellit_practice_mode', 'read'); localStorage.setItem('spellit_input_mode', 'type'); localStorage.setItem('spellit_session_length', '5'); });
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#btn-lists').click();
  await page.locator('#list-name').fill('Friday spellings');
  await page.locator('#list-words').fill('cat | A pet that meows | cat\ncat');
  await page.locator('#list-form button[type=submit]').click();
  assert((await page.locator('#saved-lists').textContent()).includes('1 word'), 'List removes duplicates');
  await page.locator('#saved-lists').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#list-name').fill('My tricky words');
  await page.locator('#list-form button[type=submit]').click();
  await page.locator('#saved-lists').getByRole('button', { name: 'Practise this list' }).click();
  assert((await page.locator('#study-word').textContent()) === 'CAT', 'Custom list controls practice');
  await page.locator('#btn-study-ready').click();
  await page.locator('#btn-hint').click();
  assert((await page.locator('#hint-text').textContent()).includes('meows'), 'First hint is the definition');
  await page.locator('#btn-hint').click();
  assert((await page.locator('#hint-text').textContent()).includes('Syllables:'), 'Second hint is curated syllables');
  await page.locator('#btn-hint').click();
  assert((await page.locator('#hint-text').textContent()).includes('Starts with C'), 'Third hint is first letter');
  await page.locator('#typed-input').fill('cat');
  await page.locator('#btn-typed-check').click();
  await page.waitForTimeout(400);
  // Verify explicit action button is shown after answer (Next, or See results for single-word sessions)
  await page.locator('#round-result:not(.hidden)').waitFor({ timeout: 5000 });
  const nextText = await page.locator('#btn-next-word').textContent();
  assert(nextText.includes('Next') || nextText.includes('results'), 'Action button shown (got: "' + nextText + '")');
  await page.locator('#btn-next-word').click();
  assert((await page.locator('#summary-assistance').textContent()).includes('0 independently · 1 with hints'), 'Assisted success reported separately');
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem('spellit_v1')).srs.cat.reps) === 0, 'Hints do not advance mastery');
  await page.locator('#btn-summary-done').click();
  await page.locator('#btn-notebook').click();
  assert((await page.locator('#notebook-list').textContent()).includes('Solved with a hint'), 'Notebook records assistance');
  await page.locator('#note-cat').fill('The cat wears a hat.');
  await page.locator('#screen-notebook .feature-back').click();
  await page.reload();
  await page.locator('#btn-notebook').click();
  assert(await page.locator('#note-cat').inputValue() === 'The cat wears a hat.', 'Personal note persists');
  await page.locator('#screen-notebook .feature-back').click();
  await page.evaluate(() => {
    const cat = PROOFREAD_WORDS.find(w => w.word === 'cat');
    PROOFREAD_WORDS.splice(0, PROOFREAD_WORDS.length, cat);
  });
  await page.locator('#btn-proofread').click();
  assert(!await page.locator('#study-overlay').isVisible(), 'Proofreading does not reveal the word first');
  assert(!await page.locator('#typed-input').isVisible(), 'Must locate the mistake first');
  await page.locator('#proofread-sentence').getByRole('button', { name: 'The', exact: true }).click();
  assert((await page.locator('#proofread-status').textContent()).includes('spelt correctly'), 'Correct words get helpful feedback');
  await page.evaluate(() => {
    const correct = new Set(['The', 'curled', 'up', 'beside', 'the', 'warm', 'fire']);
    [...document.querySelectorAll('#proofread-sentence button')].find(b => !correct.has(b.textContent)).click();
  });
  await page.locator('#typed-input').fill('cat');
  await page.locator('#btn-typed-check').click();
  await page.locator('#btn-next-word').click();
  await page.locator('#btn-summary-done').click();

  // The daily challenge freezes its words and resumes after a page refresh.
  await page.locator('#btn-daily').click();
  const first = (await page.locator('#study-word').textContent()).toLowerCase();
  await page.locator('#btn-study-ready').click();
  await page.locator('#typed-input').fill(first);
  await page.locator('#btn-typed-check').click();
  await page.locator('#btn-next-word').click();
  await page.locator('#study-overlay.show').waitFor();
  await page.locator('#btn-quit').click();
  await page.reload();
  assert(await page.locator('#daily-count').textContent() === '1 / 5', 'Daily progress survives reload');
  await page.locator('#btn-daily').click();
  for (let i = 0; i < 4; i++) {
    const word = (await page.locator('#study-word').textContent()).toLowerCase();
    assert(word !== first, 'Completed daily word is not repeated');
    await page.locator('#btn-study-ready').click();
    await page.locator('#typed-input').fill(word);
    await page.locator('#btn-typed-check').click();
    await page.locator('#btn-next-word').click();
    if (i < 3) await page.locator('#study-overlay.show').waitFor();
  }
  await page.locator('#screen-summary.active').waitFor();
  await page.locator('#btn-summary-done').click();
  assert(await page.locator('#btn-daily').isDisabled(), 'Completed daily challenge cannot be scored twice');
  assert(await page.locator('.calendar-day.today.completed').count() === 1, 'Calendar marks today complete');

  // Download contains no API credentials and import is validated before merging.
  await page.evaluate(() => localStorage.setItem('spellit_ai_config', JSON.stringify({ apiKey: 'SECRET-NOT-FOR-BACKUP', useAI: false })));
  await page.locator('#nav-settings').click();
  await page.locator('#btn-sync').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  const download = await downloadPromise;
  await download.saveAs('/private/tmp/spellit-feature-backup.json');
  assert(download.suggestedFilename().endsWith('.json'), 'Backup downloads as JSON');
  const snapshot = await page.evaluate(() => SpellFeatures.snapshot());
  assert(!JSON.stringify(snapshot).includes('SECRET-NOT-FOR-BACKUP'), 'Backup excludes keys');
  await page.locator('#backup-file').setInputFiles('tests/invalid-backup.json');
  assert(!await page.locator('#backup-preview').isVisible(), 'Malformed import cannot be applied');
  await page.locator('#backup-file').setInputFiles('/private/tmp/spellit-feature-backup.json');
  await page.locator('#btn-import').click();
  assert((await page.locator('#backup-status').textContent()).includes('Progress merged'), 'Valid backup imports');
  await page.locator('#btn-sync-back').click();
  await page.evaluate(() => { window.confirm = () => true; });
  await page.locator('#btn-reset').click();
  assert(await page.evaluate(() => SpellLearning.lists().length) === 0, 'Reset clears saved lists');
  await page.locator('#nav-settings').click();
  await page.locator('#btn-sync').click();
  await page.locator('#backup-file').setInputFiles('/private/tmp/spellit-feature-backup.json');
  await page.locator('#btn-import').click();
  assert(await page.evaluate(() => SpellLearning.lists().length) === 1, 'Explicit import restores a backup from before reset');
  assert(await page.evaluate(() => SpellLearning.get().notebook.cat.note) === 'The cat wears a hat.', 'Restored backup retains notebook notes');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}px`);
  }
  assert(errors.length === 0, errors.join('; '));
  return { passed: ['custom lists', 'three hint levels', 'assisted scoring', 'notebook notes', 'proofreading', 'daily resume', 'weekly calendar', 'backup export and restore', 'responsive layout'], browserErrors: errors };
}
