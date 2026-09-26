async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const base = await page.evaluate(() => location.origin);
  const contextB = await page.context().browser().newContext();
  const other = await contextB.newPage();
  try {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#btn-lists').click();
    await page.locator('#list-name').fill('From laptop');
    await page.locator('#list-words').fill('cat, dog');
    await page.locator('#list-form button[type=submit]').click();
    await page.locator('#screen-lists .feature-back').click();
    await page.locator('#nav-settings').click();
    await page.locator('#btn-sync').click();
    await page.locator('#btn-enable-sync').click();
    await page.waitForFunction(() => document.getElementById('sync-status').textContent.includes('Synced'));
    const code = await page.locator('#sync-code').inputValue();
    assert(code.length === 64, 'First device creates a private sync code');
    await other.goto(base);
    await other.locator('#nav-settings').click();
    await other.locator('#btn-sync').click();
    await other.locator('#sync-code').fill(code);
    await other.locator('#btn-link-sync').click();
    await other.waitForFunction(() => window.SpellLearning.lists().some(l => l.name === 'From laptop'));
    await other.locator('#btn-sync-back').click();
    await other.locator('#btn-settings-back').click();
    await other.locator('#btn-lists').click();
    assert((await other.locator('#saved-lists').textContent()).includes('From laptop'), 'Second device receives first list');

    // Both devices create data offline; the reconnect merge keeps both changes.
    await page.context().setOffline(true);
    await contextB.setOffline(true);
    await other.locator('#list-name').fill('From phone');
    await other.locator('#list-words').fill('sun, book');
    await other.locator('#list-form button[type=submit]').click();
    await other.locator('#screen-lists .feature-back').click();
    await page.locator('#btn-sync-back').click();
    await page.locator('#btn-settings-back').click();
    await page.locator('#btn-lists').click();
    await page.locator('#list-name').fill('Offline laptop words');
    await page.locator('#list-words').fill('apple, chair');
    await page.locator('#list-form button[type=submit]').click();
    await page.locator('#screen-lists .feature-back').click();
    await page.context().setOffline(false);
    await contextB.setOffline(false);
    await page.evaluate(() => SpellSync.sync());
    await other.evaluate(() => SpellSync.sync());
    await page.waitForTimeout(1800);
    await page.evaluate(() => SpellSync.sync());
    await other.evaluate(() => SpellSync.sync());
    await page.waitForFunction(() => SpellLearning.lists().length === 3);
    await other.waitForFunction(() => SpellLearning.lists().length === 3);
    // Inspect the wire format without printing the private code or auth token.
    const encrypted = await page.evaluate(async () => {
      const token = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('spellit-auth:' + SpellSync.getCode())))].map(b => b.toString(16).padStart(2, '0')).join('');
      const result = await (await fetch('/api/sync', { headers: { Authorization: 'Bearer ' + token } })).json();
      return { revision: result.revision, hasCiphertext: !!result.payload.ciphertext, containsWords: JSON.stringify(result).includes('From laptop') };
    });
    assert(encrypted.hasCiphertext && !encrypted.containsWords, 'Server only receives encrypted progress');
    await other.evaluate(() => SpellSync.disconnect());
    assert(await other.evaluate(() => SpellLearning.lists().length) === 3, 'Disconnect retains local progress');
    return { passed: ['link second device', 'bidirectional offline merge', 'encrypted wire payload', 'disconnect preserves progress'] };
  } finally { await page.context().setOffline(false); await contextB.close(); }
}
