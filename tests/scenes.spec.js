const { test, expect } = require('./fixtures.cjs');

const endpoint = 'http://127.0.0.1:8123/api/webhook/test-scene-hook';
test.beforeEach(async ({ page }) => {
  await page.route('**/scene-config.js', route => route.fulfill({ contentType: 'application/javascript',
    body: 'window.QUIET_SCENE_CONFIG = ' + JSON.stringify({ scenes: [{ id: 'scene.tv_time', title: 'TV time', description: 'TV light 20% · Backlight 80% · Kitchen lights off', url: endpoint }] }) + ';' }));
});

test('scene choice persists without activation; only the Home button sends a bounded POST', async ({ page }) => {
  const calls = [];
  await page.route(endpoint, route => { const r = route.request(); calls.push({ method: r.method(), headers: r.headers(), body: r.postData() }); return route.fulfill({ status: 200, body: '' }); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Activate TV time' })).toBeVisible();
  expect(calls).toHaveLength(0);
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await page.getByRole('tab', { name: 'Scene button' }).click();
  await page.getByRole('button', { name: /No scene button/ }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('#scene-button')).toBeHidden();
  await page.reload();
  await expect(page.locator('#scene-button')).toBeHidden();
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await page.getByRole('tab', { name: 'Scene button' }).click();
  await page.getByRole('button', { name: /TV time/ }).click();
  expect(calls).toHaveLength(0);
  await page.screenshot({ path: 'artifacts/home-assistant-scene-picker.png' });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Activate TV time' }).click();
  await expect(page.locator('#toast')).toHaveText('TV time requested.');
  expect(calls).toHaveLength(1);
  expect(calls[0].method).toBe('POST');
  expect(calls[0].headers.authorization).toBeUndefined();
  expect(calls[0].body).toBeNull();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Activate TV time' })).toBeVisible();
  expect(calls).toHaveLength(1);
});

test('unreachable Home Assistant shows an error and the button allows retry', async ({ page }) => {
  await page.route(endpoint, route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Activate TV time' }).click();
  await expect(page.locator('#toast')).toContainText('Could not reach Home Assistant');
  await expect(page.locator('#scene-button')).not.toHaveAttribute('aria-busy');
  await page.unroute(endpoint);
  await page.route(endpoint, route => route.fulfill({ status: 200, body: '' }));
  await page.getByRole('button', { name: 'Activate TV time' }).click();
  await expect(page.locator('#toast')).toHaveText('TV time requested.');
});
