async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('spellit_input_mode', 'type');
  });
  await page.reload();
  await page.locator('#btn-start').click();
  await page.waitForTimeout(600);

  // Resizing the emulated mobile viewport mirrors the visible area shrinking
  // when the on-screen keyboard opens.
  await page.setViewportSize({ width: 390, height: 400 });
  await page.waitForTimeout(100);
  await page.locator('#typed-input').scrollIntoViewIfNeeded();

  const state = await page.evaluate(() => {
    const header = document.querySelector('.game-header').getBoundingClientRect();
    const input = document.querySelector('#typed-input').getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      viewportHeight: window.visualViewport?.height ?? window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      headerTop: header.top,
      inputTop: input.top,
      inputBottom: input.bottom,
      inputFocused: document.activeElement?.id === 'typed-input',
    };
  });

  assert(state.inputFocused, 'Typed answer field should remain focused');
  assert(state.scrollY <= 1, `The page must not jump vertically (scrollY=${state.scrollY})`);
  assert(state.headerTop >= -1, `The game header must remain anchored (top=${state.headerTop})`);
  assert(
    state.documentHeight <= state.viewportHeight + 1,
    `The document must fit the keyboard-reduced viewport (document=${state.documentHeight}, viewport=${state.viewportHeight})`
  );
  assert(state.inputTop >= -1 && state.inputBottom <= state.viewportHeight + 1,
    `Typed field must remain visible above the keyboard (top=${state.inputTop}, bottom=${state.inputBottom})`);

  return { passed: ['mobile keyboard viewport keeps game header anchored and typed field visible'], state };
}
