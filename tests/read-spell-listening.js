// Run in an isolated Playwright CLI session against the local app.
async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('spellit_practice_mode', 'read');
    localStorage.setItem('spellit_input_mode', 'type');
    localStorage.setItem('spellit_session_length', '5');
    localStorage.setItem('spellit_coach_v2', JSON.stringify({
      level: 2, assessmentDone: true, assessmentWords: [], assessmentResults: {},
      recentPerformance: [], firstTryCorrect: 0, firstTryTotal: 0,
      sessionsSinceAssess: 0, lastMasteryDates: {}, dailyMasteryIncrements: {}, levelHistory: [],
    }));
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.SpellTTS));
  await page.evaluate(() => {
    window.elevenLabsPlayedWords = [];
    window.SpellTTS.isEnabled = () => true;
    window.SpellTTS.speak = async word => { window.elevenLabsPlayedWords.push(word); };
  });

  await page.locator('#btn-start').click();
  await page.locator('#study-overlay.show').waitFor();
  const word = (await page.locator('#study-word').textContent()).trim().toLowerCase();
  const studyListen = page.locator('#btn-study-listen');
  assert(await studyListen.isVisible(), 'Read & Spell study card needs a pronunciation button');
  await studyListen.click();
  await page.waitForFunction(() => window.elevenLabsPlayedWords.length === 1);
  assert((await page.evaluate(() => window.elevenLabsPlayedWords[0])) === word, 'Study playback must use the current word and configured ElevenLabs voice');

  await page.locator('#btn-study-ready').click();
  await page.locator('#typed-input').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.activeElement?.id === 'typed-input');
  const typedListen = page.locator('#btn-typed-listen');
  assert(await typedListen.isVisible(), 'Typed Read & Spell mode needs an inline replay button');
  assert(!(await page.locator('#btn-speak').isVisible()), 'Typed mode should show one replay control, not duplicate speaker buttons');
  await page.locator('#typed-input').fill('a');
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await typedListen.tap();
  else await typedListen.click();
  await page.waitForFunction(() => window.elevenLabsPlayedWords.length === 2);
  assert((await page.evaluate(() => window.elevenLabsPlayedWords[1])) === word, 'Typing-stage replay must pronounce the same word');
  assert(await page.evaluate(() => document.activeElement?.id === 'typed-input'), 'Replay must keep the typing field focused');
  assert((await page.locator('#typed-input').inputValue()) === 'a', 'Replay must preserve the letters already typed');
  const replayLayout = await page.evaluate(() => {
    const button = document.querySelector('#btn-typed-listen').getBoundingClientRect();
    return { viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, documentWidth: document.documentElement.scrollWidth, buttonLeft: button.left, buttonRight: button.right, buttonHeight: button.height };
  });
  assert(replayLayout.documentWidth <= replayLayout.viewportWidth + 1, 'Listen button must not cause horizontal overflow');
  assert(replayLayout.buttonLeft >= 0 && replayLayout.buttonRight <= replayLayout.viewportWidth + 1, 'Listen button must remain inside the mobile screen');
  assert(replayLayout.buttonHeight >= 44, 'Listen button must meet the 44px mobile touch target');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: replayLayout.viewportHeight });
    const layout = await page.evaluate(() => {
      const button = document.querySelector('#btn-typed-listen').getBoundingClientRect();
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, buttonLeft: button.left, buttonRight: button.right };
    });
    assert(layout.documentWidth <= layout.width + 1, `No horizontal overflow at ${width}px`);
    assert(layout.buttonLeft >= 0 && layout.buttonRight <= layout.width + 1, `Listen button fits at ${width}px`);
  }
  assert(errors.length === 0, errors.join('\n'));
  return { passed: true, checks: ['study-card pronunciation', 'configured voice used', 'typing-stage replay', 'input focus and value preserved', 'mobile touch target and viewport fit at 320px and 390px'], word, replayLayout };
}
