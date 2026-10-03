// Run in an isolated browser only; requests are mocked and storage is cleared.
async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(() => {
    window.spokenWord = '';
    speechSynthesis.speak = utter => { window.spokenWord = utter.text; };
  });
  await page.reload();
  await page.locator('#nav-learn').click();
  await page.locator('#btn-ai-lesson').click();
  assert(await page.locator('#screen-settings.active').count() === 1, 'Missing key opens settings');
  await page.locator('#input-api-key').fill('mock-key');
  await page.locator('#input-toggle-ai').check();
  await page.locator('#btn-save-ai').click();
  await page.locator('#btn-settings-back').click();
  let requests = [];
  let mode = 'success';
  let release;
  const payload = [
    { word: 'fern', hint: 'A leafy plant.', memoryTip: 'Remember r before n.' },
    { word: 'moss', hint: 'A soft green plant.', memoryTip: 'Two s letters at the end.' },
  ];
  await page.route('https://openrouter.ai/api/v1/chat/completions', async route => {
    const body = route.request().postDataJSON();
    if (!body.messages[1].content.startsWith('Generate exactly')) {
      await route.fulfill({ json: { choices: [{ message: { content: 'Remember each letter.' } }] } });
      return;
    }
    requests.push(body);
    if (mode === 'delay') await new Promise(resolve => { release = resolve; });
    if (mode === 'error') { await route.fulfill({ status: 402, body: 'no credits' }); return; }
    try { await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(payload) } }] } }); } catch {}
  });
  await page.locator('#nav-learn').click();
  await page.locator('#btn-ai-lesson').click();
  await page.locator('#study-overlay.show').waitFor();
  assert((await page.locator('#session-position').textContent()).includes('Learn 1 of 2'), 'Short batch uses actual length');
  assert(requests[0].messages[1].content.includes('beginner'), 'AI starts at lowest course level');
  assert((await page.locator('#study-rule-tip-text').textContent()) === payload[0].memoryTip, 'AI memory tip teaches the word');
  const next = async () => {
    await page.evaluate(() => { window.spokenWord = ''; });
    await page.locator('#btn-next-word').click();
  };
  for (let i = 0; i < 2; i++) {
    const word = (await page.locator('#study-word').textContent()).toLowerCase();
    await page.locator('#study-copy').fill(word);
    await page.locator('#btn-study-ready').click();
    await page.locator('#typed-input').fill(word);
    await page.locator('#btn-typed-check').click();
    await next();
  }
  const check = async fail => {
    for (let i = 0; i < 2; i++) {
      await page.waitForFunction(() => window.spokenWord, null, { timeout: 5000 });
      const word = await page.evaluate(() => window.spokenWord);
      if (fail && i === 0) await page.locator('#btn-skip').click();
      else {
        await page.locator('#typed-input').fill(word);
        await page.locator('#btn-typed-check').click();
      }
      await page.locator('#round-result:not(.hidden)').waitFor({ timeout: 5000 });
      await next();
    }
    await page.locator('#screen-summary.active').waitFor();
  };
  await check(true);
  await page.locator('#btn-practice-again').click();
  assert(requests.length === 1, 'Failed check retry does not regenerate words');
  await check(false);
  assert(await page.locator('#summary-title').textContent() === 'AI lesson complete!', 'AI summary distinct from course unlock');
  assert(await page.evaluate(() => SpellLearning.pathStatus().completed) === 0, 'AI practice does not skip course levels');
  const snap = await page.evaluate(() => SpellLearning.validateSnapshot(SpellFeatures.snapshot()));
  assert(snap.progress.srs.fern.entry.memoryTip === payload[0].memoryTip, 'Memory tip survives validated backup');
  assert(!JSON.stringify(snap).includes('mock-key'), 'API key excluded from backup');
  mode = 'error';
  await page.locator('#btn-practice-again').click();
  await page.waitForFunction(() => document.querySelector('#ai-lab-status').textContent.includes('credits'));
  assert(requests[1].messages[1].content.includes('fern'), 'Future batch excludes previously practised words');
  assert(await page.locator('#btn-ai-lesson').isEnabled(), 'Error allows recovery');
  mode = 'delay';
  await page.locator('#nav-learn').click();
  await page.locator('#btn-ai-lesson').click();
  while (!release) await page.waitForTimeout(20);
  await page.locator('#btn-ai-cancel').click();
  release();
  await page.waitForTimeout(250);
  assert(await page.locator('#screen-learn.active').count() === 1, 'Cancelled request cannot open a late lesson');
  await page.locator('#nav-learn').click();
  await page.locator('#btn-path-start').click();
  assert(await page.locator('#study-copy').isVisible(), 'Built-in course still works after errors');
  await page.locator('#btn-quit').click();
  assert(errors.length === 0, errors.join('\n'));
  return { passed: true, requests: requests.length, checks: 'setup, level, short batch, teaching, retry, persistence, exclusions, errors, cancellation, course fallback' };
}
