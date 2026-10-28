const { test, expect } = require('./fixtures.cjs');

test('TV cursor focuses tiles without launching them and hands navigation back to arrows', async ({ page }) => {
  const launches = [], requests = [];
  await page.addInitScript(() => {
    window.hoverLaunches = []; window.PalmServiceBridge = function () { this.call = (uri, body) => { window.hoverLaunches.push(uri); this.onservicecallback(JSON.stringify({ returnValue: true })); }; };
  });
  page.on('pageerror', error => launches.push(error.message));
  page.on('request', request => { if (request.method() === 'POST') requests.push(request.url()); });
  await page.goto('/');
  const stremio = page.getByRole('button', { name: 'Stremio', exact: true });
  await stremio.hover();
  await expect(stremio).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Partner TV+', exact: true })).toBeFocused();
  const rect = await stremio.boundingBox();
  await page.mouse.move(rect.x + 25, rect.y + 25);
  await expect(stremio).toBeFocused();
  await page.locator('#inputs .input').last().hover();
  await expect(page.locator('#inputs .input').last()).toBeFocused();
  await page.getByRole('button', { name: 'Activate TV time' }).hover();
  await expect(page.getByRole('button', { name: 'Activate TV time' })).toBeFocused();
  expect(launches).toEqual([]); expect(requests).toEqual([]); expect(await page.evaluate(() => window.hoverLaunches)).toEqual([]);
});

test('rapid arrow presses stay responsive and an expanded grid scrolls to further rows', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    for (let i = 0; i < 12; i++) [39,39,39,37,37,37].forEach(keyCode => document.dispatchEvent(new KeyboardEvent('keydown', { keyCode, bubbles: true, cancelable: true })));
  });
  await expect(page.getByRole('button', { name: 'Jellyfin', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Open Settings' }).click();
  for (const name of ['Spotify', 'Netflix', 'Disney+']) {
    const choice = page.locator('#choices .choice').filter({ hasText: name });
    if (await choice.getAttribute('aria-pressed') === 'false') await choice.click();
  }
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Jellyfin', exact: true }).focus();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await expect(page.locator('#apps .app:focus')).toHaveCount(1);
  const focused = await page.locator('#apps .app:focus').boundingBox();
  const grid = await page.locator('#apps').boundingBox();
  expect(focused.y).toBeGreaterThanOrEqual(grid.y);
  expect(focused.y + focused.height).toBeLessThanOrEqual(grid.y + grid.height + 1);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#inputs .input:focus')).toHaveCount(1);
});

test('home shows only favorites and inputs, with no network traffic', async ({ page }) => {
  const errors = [], offDevice = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:8765')) offDevice.push(r.url()); });
  await page.goto('/');
  await expect(page.locator('#apps .app')).toHaveCount(7);
  await expect(page.locator('#inputs .input')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Jellyfin', exact: true })).toBeFocused();
  await expect(page.locator('#apps')).not.toContainText('LG Streaming');
  const lastApp = await page.locator('#apps .app').last().boundingBox();
  const appGrid = await page.locator('#apps').boundingBox();
  expect(lastApp.y + lastApp.height).toBeLessThanOrEqual(appGrid.y + appGrid.height);
  const layout = await page.evaluate(() => {
    const rows = {};
    document.querySelectorAll('#apps .app').forEach(b => { const r = b.getBoundingClientRect(); (rows[Math.round(r.y)] ||= []).push(r.left + r.width / 2); });
    return {
      centers: ['.header', '.apps-section', '.inputs-section', '#home-tools'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.left + r.width / 2; }),
      rows: Object.values(rows).map(xs => ({ count: xs.length, center: xs.reduce((a, b) => a + b, 0) / xs.length }))
    };
  });
  layout.centers.forEach(x => expect(Math.abs(x - 960)).toBeLessThan(1));
  expect(layout.rows.map(r => r.count)).toEqual([4, 3]);
  layout.rows.forEach(r => expect(Math.abs(r.center - 960)).toBeLessThan(1));
  await page.screenshot({ path: 'artifacts/home-preview.png' });
  expect(errors).toEqual([]); expect(offDevice).toEqual([]);
});

test('remote navigates between apps, inputs and edit control', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Stremio', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#apps .app:focus')).toHaveCount(1);
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('button', { name: 'Stremio', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#inputs .input:focus')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Open Settings' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open Settings' })).toBeFocused();
});

test('favorite changes persist, and editor traps keyboard focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Settings' }).click();
  const spotify = page.locator('#choices button').filter({ hasText: 'Spotify' });
  await spotify.click();
  await expect(spotify).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('#apps .app')).toHaveCount(8);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Spotify', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Settings' }).click();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#editor'))).toBeTruthy();
  }
  await page.screenshot({ path: 'artifacts/editor-preview.png' });
});

test('holding OK reorders favorites and Back cancels without changing saved order', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.down('Enter'); await page.waitForTimeout(650); await page.keyboard.up('Enter');
  await expect(page.locator('.reordering')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#apps .app').nth(1)).toHaveAttribute('aria-label', 'Jellyfin');
  await page.keyboard.press('Escape');
  await expect(page.locator('#apps .app').first()).toHaveAttribute('aria-label', 'Jellyfin');
  await page.keyboard.down('Enter'); await page.waitForTimeout(650); await page.keyboard.up('Enter');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await page.reload();
  await expect(page.locator('#apps .app').first()).toHaveAttribute('aria-label', 'Stremio');
});

test('apps and inputs call only the requested launch endpoint', async ({ page }) => {
  await page.addInitScript(() => {
    window.launchCalls = [];
    window.PalmServiceBridge = function () {
      this.call = (uri, payload) => { window.launchCalls.push({ uri, payload: JSON.parse(payload) }); this.onservicecallback(JSON.stringify({ returnValue: true })); };
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Jellyfin', exact: true }).click();
  await page.locator('#inputs .input').first().click();
  expect(await page.evaluate(() => window.launchCalls)).toEqual([
    { uri: 'luna://com.webos.applicationManager/launch', payload: { id: 'org.jellyfin.webos', params: {} } },
    { uri: 'luna://com.webos.applicationManager/launch', payload: { id: 'com.webos.app.hdmi1', params: {} } }
  ]);
});


test('Back offers LG Home and cancel restores focus without navigation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Return to LG Home?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stay here' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#exit-dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Jellyfin', exact: true })).toBeFocused();
});

test('Open LG Home visits the stock app without changing the default or closing Quiet Home', async ({ page }) => {
  await page.addInitScript(() => {
    window.launchCalls = [];
    window.close = () => { throw new Error('Quiet Home should remain available'); };
    window.PalmServiceBridge = function () {
      this.call = (uri, payload) => { window.launchCalls.push({ uri, payload: JSON.parse(payload) }); this.onservicecallback(JSON.stringify({ returnValue: true })); };
    };
  });
  await page.goto('/');
  await page.locator('#lg-home-tile').click();
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await page.locator('#restore-lg').click();
  await expect(page.locator('#editor')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'LG Home', exact: true }).click();
  await expect(page.locator('#exit-dialog')).toBeHidden();
  expect(await page.evaluate(() => window.launchCalls)).toEqual(Array(3).fill({
    uri: 'luna://com.webos.applicationManager/launch', payload: { id: 'com.webos.app.home', params: {} }
  }));
});
