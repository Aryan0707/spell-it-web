async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  const start = await page.locator('#btn-start').boundingBox();
  assert(start.y + start.height < 844, 'Start should be visible on mobile');
  await page.locator('.practice-options > summary').click();
  await page.locator('#length-chips [data-value="5"]').click();
  await page.locator('#input-mode-chips [data-value="choice"]').click();
  assert((await page.locator('#practice-summary').textContent()).includes('5 words · Multiple choice'), 'Summary reflects selections');
  assert(await page.locator('#input-mode-chips [data-value="choice"]').getAttribute('aria-pressed') === 'true', 'Selection is announced');
  await page.locator('.practice-options > summary').click();
  await page.screenshot({ path: '.playwright-cli/spellit-home-after.png' });
  await page.evaluate(() => {
    localStorage.setItem('spellit_v1', JSON.stringify({ bestStreak: 0, curStreak: 0, learned: [], missed: {}, sessionsCompleted: 0, patternMistakes: {}, srs: { cat: { dueAt: 1, reps: 0 } } }));
    localStorage.setItem('spellit_timed_mode', 'on');
  });
  await page.reload();
  await page.locator('#mode-read').click();
  await page.locator('#btn-review-due').click();
  assert(!await page.locator('#timer-pill').isVisible(), 'Read mode timer waits for study');
  await page.locator('#btn-study-ready').click();
  const wrong = page.locator('.choice-btn:not([data-word="cat"])').first();
  await wrong.click();
  assert(await page.locator('.choice-btn.correct').textContent() === 'cat', 'Choice marks correct spelling');
  await page.locator('#btn-next-word').click();
  await page.locator('#screen-summary.active').waitFor();
  await page.locator('#btn-retry-missed').click();
  await page.locator('#btn-study-ready').click();
  await page.locator('#round-result:not(.hidden)').waitFor({ timeout: 20000 });
  assert((await page.locator('#round-result-text').textContent()).includes('CAT'), 'Timeout shows persistent answer');
  await page.screenshot({ path: '.playwright-cli/spellit-correction-after.png' });
  await page.locator('#btn-next-word').click();
  await page.locator('#btn-summary-done').click();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}px`);
  }
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  return { passed: ['quick start', 'saved options summary', 'choice feedback', 'study timer', 'timeout correction', 'responsive layout'] };
}
