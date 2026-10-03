// Run against an isolated Playwright CLI session opened at the local app URL:
// playwright-cli -s=spellit run-code --filename=tests/practice-flow.js
async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const reset = async (extra = {}, srs = {}) => {
    await page.evaluate(({ extra, srs }) => {
      localStorage.clear();
      const settings = { spellit_practice_mode: 'read', spellit_input_mode: 'type', spellit_session_length: '5', ...extra };
      for (const [key, value] of Object.entries(settings)) localStorage.setItem(key, value);
      localStorage.setItem('spellit_v1', JSON.stringify({ bestStreak: 0, curStreak: 0, learned: [], missed: {}, srs, sessionsCompleted: 0, patternMistakes: {} }));
      localStorage.setItem('spellit_learning_v1', JSON.stringify({ version: 1, resetAt: 0, lists: {}, notebook: {}, daily: {}, sessions: {}, legacySessions: 0 }));
      localStorage.setItem('spellit_coach_v2', JSON.stringify({ level: 2, assessmentDone: true, assessmentWords: [], assessmentResults: {}, recentPerformance: [], firstTryCorrect: 0, firstTryTotal: 0, sessionsSinceAssess: 0, lastMasteryDates: {}, dailyMasteryIncrements: {}, levelHistory: [] }));
    }, { extra, srs });
    await page.reload();
    await page.locator('#btn-start').waitFor();
    await page.locator('#nav-practice').click();
    await page.locator('#mode-read').click();
    await page.locator('#nav-today').click();
  };
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('spellit_v1')));
  const word = () => page.locator('#study-word').textContent();
  const answer = async () => {
    const value = (await word()).toLowerCase();
    await page.locator('#btn-study-ready').click();
    await page.locator('#typed-input').fill(value);
    await page.locator('#btn-typed-check').click();
    return value;
  };
  // A skipped word stays visible until Next; retry uses exactly that word.
  await reset();
  await page.locator('#btn-start').click();
  assert((await saved()).sessionsCompleted === 0, 'Starting should not count as completion');
  const missed = (await word()).toLowerCase();
  await page.locator('#btn-study-ready').click();
  await page.locator('#btn-skip').click();
  await page.waitForTimeout(1400);
  assert((await page.locator('#round-result-text').textContent()).includes(missed.toUpperCase()), 'Correction must persist');
  assert((await page.locator('#round-result-text').textContent()).includes('come back'), 'A skipped word promises a second look');
  await page.locator('#btn-next-word').click();
  // The skipped word returns as a "second look" a few words later: one extra round, no study
  // card (it must be recalled, not copied), and it never touches the score.
  assert((await page.locator('#session-position').textContent()).endsWith('of 6'), 'A miss adds one second-look round');
  let secondLooks = 0;
  for (let i = 0; i < 5; i++) {
    if (await page.locator('#study-overlay.show').count()) {
      await answer();
    } else {
      assert((await page.locator('#session-position').textContent()).startsWith('Second look'), 'Only a second look skips the study card');
      secondLooks++;
      await page.locator('#typed-input').fill(missed);
      await page.locator('#btn-typed-check').click();
    }
    await page.locator('#btn-next-word').click();
  }
  assert(secondLooks === 1, 'The missed word comes back exactly once');
  await page.locator('#screen-summary.active').waitFor();
  assert((await page.locator('#summary-correct').textContent()) === '4/5', 'A second look never counts toward the session score');
  assert((await saved()).sessionsCompleted === 1, 'Completed session counted once');
  await page.locator('#btn-retry-missed').click();
  assert((await page.locator('#session-position').textContent()) === 'Review 1 of 1', 'Retry uses actual queue length');
  assert((await word()).toLowerCase() === missed, 'Retry should use missed word');
  await answer();
  await page.locator('#btn-next-word').click();
  await page.locator('#screen-summary.active').waitFor();
  assert((await page.locator('#summary-correct').textContent()) === '1/1', 'Retry ends after one word');

  // Due review ignores discovery filters and preserves exact British/AI spellings.
  const dueRecord = { reps: 0, interval: 0, ease: 2.5, dueAt: 1 };
  await reset({ spellit_difficulty: 'expert', spellit_category: 'school' }, {
    colour: dueRecord,
    zephyr: { ...dueRecord, dueAt: 2, entry: { word: 'zephyr', hint: 'A gentle breeze.' } },
  });
  await page.locator('#nav-me').click();
  await page.locator('#btn-me-progress').click();
  await page.locator('#btn-history-review').click();
  assert((await word()).toLowerCase() === 'colour', 'Keep saved variant');
  await answer();
  await page.locator('#btn-next-word').click();
  await page.locator('#study-overlay.show').waitFor();
  assert((await word()).toLowerCase() === 'zephyr', 'Include saved AI word');
  assert((await page.locator('#study-hint').textContent()) === 'A gentle breeze.', 'Keep saved AI hint');
  await answer();
  await page.locator('#btn-next-word').click();
  await page.locator('#screen-summary.active').waitFor();

  // Quit during automatic advancement must not open a ghost round or summary.
  await reset();
  await page.locator('#btn-start').click();
  await answer();
  await page.locator('#btn-quit').click();
  await page.waitForTimeout(1200);
  assert(await page.locator('#screen-home.active').isVisible(), 'Quit stays home');
  assert((await saved()).sessionsCompleted === 0, 'Quit does not count as complete');
  await page.locator('#btn-start').click();
  assert((await page.locator('#session-position').textContent()).includes('1 of 5'), 'Fresh session starts at first word');
  await page.locator('#btn-quit').click();

  // Short AI batches fall back to classic words without undefined entries.
  await reset();
  await page.evaluate(() => {
    SpellAI.isEnabled = () => true;
    SpellAI.generateWordBatch = async () => [{ word: 'cat', hint: 'A pet that meows.' }];
  });
  await page.locator('#btn-start').click();
  const seen = new Set();
  for (let i = 0; i < 5; i++) {
    await page.locator('#study-overlay.show').waitFor();
    seen.add(await answer());
    await page.locator('#btn-next-word').click();
  }
  await page.locator('#screen-summary.active').waitFor();
  assert(seen.size === 5, 'Avoid repeated words when alternatives exist');

  // Clearing tiles before deferred answer validation must not crash.
  await reset({ spellit_input_mode: 'tiles' }, { cat: dueRecord });
  await page.locator('#nav-practice').click();
  await page.locator('#btn-review-due').click();
  await page.locator('#btn-study-ready').click();
  await page.evaluate(() => {
    for (const letter of 'cat') {
      [...document.querySelectorAll('#rack .tile')].find(tile => !tile.disabled && tile.textContent === letter).click();
    }
    document.querySelector('#btn-clear').click();
  });
  await page.waitForTimeout(300);
  assert(await page.locator('#answer-row .empty').count() === 3, 'Cleared tiles stay empty');
  for (const letter of 'cat') await page.getByRole('button', { name: `Letter ${letter.toUpperCase()}`, exact: true }).click();
  await page.locator('#round-result:not(.hidden)').waitFor();
  await page.locator('#btn-next-word').click();
  await page.locator('#screen-summary.active').waitFor();

  // Correcting a typed mistake pauses for feedback and is not a perfect session.
  await reset({}, { cat: dueRecord });
  await page.locator('#nav-practice').click();
  await page.locator('#btn-review-due').click();
  await page.locator('#btn-study-ready').click();
  await page.locator('#typed-input').fill('kat');
  await page.locator('#btn-typed-check').click();
  await page.waitForTimeout(450);
  await page.locator('#typed-input').fill('cat');
  await page.locator('#btn-typed-check').click();
  await page.locator('#round-result:not(.hidden)').waitFor();
  await page.locator('#btn-next-word').click();
  // The corrected word comes back for a second look before the session ends. It is practice only.
  assert((await page.locator('#session-position').textContent()).startsWith('Second look'), 'Corrected mistake returns for a second look');
  await page.locator('#typed-input').fill('cat');
  await page.locator('#btn-typed-check').click();
  await page.locator('#round-result:not(.hidden)').waitFor();
  await page.locator('#btn-next-word').click();
  await page.locator('#screen-summary.active').waitFor();
  assert((await page.locator('#summary-title').textContent()) !== 'Perfect Session!', 'Corrected mistakes are not perfect');
  assert((await saved()).srs.cat.reps === 0, 'Mistaken word stays due; a second look does not advance it');
  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  await page.locator('#btn-summary-done').click();
  return { passed: 7, browserErrors: errors };
}
