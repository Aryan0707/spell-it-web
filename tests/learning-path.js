// Run only in an isolated test browser: clears test-origin storage.
async page => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const assert = (value, message) => { if (!value) throw new Error(message); };
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('spellit_practice_mode', 'read');
    localStorage.setItem('spellit_input_mode', 'choice');
    localStorage.setItem('spellit_session_length', '20');
    localStorage.setItem('spellit_timed_mode', 'on');
  });
  await page.addInitScript(() => {
    window.spokenWord = '';
    speechSynthesis.speak = utterance => { window.spokenWord = utterance.text; };
  });
  await page.reload();
  const completed = () => page.evaluate(() => SpellLearning.pathStatus().completed);
  const next = async () => {
    await page.evaluate(() => { window.spokenWord = ''; });
    await page.locator('#btn-next-word').click();
  };
  const copy = async word => {
    await page.locator('#study-copy').fill(word);
    await page.locator('#btn-study-ready').click();
    assert(!(await page.locator('#study-overlay').evaluate(e => e.classList.contains('show'))), 'Copy hides the teaching card');
    assert(await page.locator('#study-word').textContent() === '', 'Model spelling removed before recall');
  };
  const answer = async word => {
    await page.locator('#typed-input').fill(word);
    await page.locator('#btn-typed-check').click();
    await page.locator('#round-result:not(.hidden)').waitFor({ timeout: 5000 });
  };
  const learn = async (makeMistakes = false) => {
    for (let i = 0; i < 5; i++) {
      await page.locator('#study-overlay.show').waitFor();
      const word = (await page.locator('#study-word').textContent()).toLowerCase();
      assert((await page.locator('#study-hint').textContent()).length > 0, 'Definition is visible');
      assert((await page.locator('#study-rule-tip-text').textContent()).length > 0, 'Memory tip is visible');
      if (makeMistakes && i === 0) {
        await page.locator('#study-copy').fill('zzzz');
        await page.locator('#btn-study-ready').click();
        assert(await page.locator('#study-overlay').evaluate(e => e.classList.contains('show')), 'Incorrect copy stays in teaching');
      }
      await copy(word);
      if (makeMistakes && i === 0) {
        await page.locator('#typed-input').fill('zzzz');
        await page.locator('#btn-typed-check').click();
        await page.locator('#study-overlay.show').waitFor();
        assert((await page.locator('#study-copy-status').textContent()).includes('No penalty'), 'Learning mistakes are neutral');
        await copy(word);
        await page.locator('#btn-learn-word').click();
        await copy(word);
        await page.locator('#btn-hint').click();
      }
      await answer(word);
      assert(await completed() === 0, 'Learning alone never unlocks a lesson');
      if (i === 4) assert((await page.locator('#btn-next-word').textContent()).includes('Start final check'), 'Explicit check transition');
      await next();
    }
    assert((await page.locator('#session-position').textContent()).startsWith('Final check 1 of 5'), 'Fresh final check starts');
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem('spellit_v1')));
    assert(data.sessionsCompleted === 0 && Object.keys(data.srs).length === 0 && Object.keys(data.missed).length === 0 && data.bestStreak === 0, 'Learning writes no scores, misses or mastery');
  };
  const check = async assisted => {
    for (let i = 0; i < 5; i++) {
      await page.waitForFunction(() => window.spokenWord.length > 0, null, { timeout: 5000 });
      const word = await page.evaluate(() => window.spokenWord);
      assert(await page.locator('#typed-input').isVisible(), 'Check forces typed input');
      assert(!(await page.locator('#study-overlay').evaluate(e => e.classList.contains('show'))), 'Check hides spelling despite read preference');
      assert(!(await page.locator('#timer-pill').evaluate(e => e.classList.contains('show'))), 'No timer during path');
      if (assisted && i === 0) {
        await page.locator('#btn-learn-word').click();
        await copy(word);
      }
      await answer(word);
      await next();
    }
    await page.locator('#screen-summary.active').waitFor();
  };
  await page.locator('#btn-path-start').click();
  await page.setViewportSize({ width: 375, height: 812 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile teaching card must not overflow');
  await page.locator('#btn-quit').click();
  assert(await completed() === 0, 'Quitting teaching does not pass');
  await page.locator('#btn-path-start').click();
  await learn(true);
  await check(true);
  assert(await completed() === 0, 'Teaching during final check cannot unlock');
  await page.locator('#btn-practice-again').click();
  assert((await page.locator('#session-position').textContent()).startsWith('Final check'), 'Retry skips learning stage');
  await check(true);
  await page.locator('#btn-retry-missed').click();
  const missed = (await page.locator('#study-word').textContent()).toLowerCase();
  await page.locator('#btn-study-ready').click();
  await page.locator(`#choice-row button[data-word="${missed}"]`).click();
  await next();
  assert((await page.locator('#btn-practice-again').textContent()).includes('Return to final check'), 'Missed-word practice retains course context');
  await page.locator('#btn-practice-again').click();
  await check(false);
  assert(await completed() === 1, 'Independent check passes regardless of learning mistakes');
  await page.locator('#btn-practice-again').click();
  assert((await page.locator('#session-position').textContent()).includes('Lesson 2'), 'Continue starts next lesson');
  assert(await page.locator('#study-copy').isVisible(), 'Next lesson begins with teaching');
  await page.locator('#btn-quit').click();
  await page.reload();
  assert(await completed() === 1, 'Completion survives reload');
  assert(errors.length === 0, errors.join('\n'));
  return { passed: true, checks: 'teaching, copy gate, neutral learning errors/hints, independent check, retry, missed practice, persistence, mobile', browserErrors: errors };
}
