const { test, expect } = require('./fixtures.cjs');
const endpoint = 'http://127.0.0.1:8123/api/quiet_home_lights/test-lighting-capability-with-32-characters';
const fixtures = () => [
  { id: 'light.living_room_tv_light', name: 'TV light', room: 'Living room', available: true, on: true, brightness: 20, dimmable: true, color: false, warmth: false },
  { id: 'light.living_room_tv_backlight', name: 'TV backlight', room: 'Living room', available: true, on: true, brightness: 80, dimmable: true, color: true, warmth: true, kelvin: 2700, min_kelvin: 2000, max_kelvin: 6500 },
  { id: 'light.kitchen_kitchen', name: 'Kitchen light', room: 'Kitchen', available: true, on: false, brightness: null, dimmable: true, color: false, warmth: false },
  { id: 'switch.kitchen_sink', name: 'Sink light', room: 'Kitchen', available: true, on: false, brightness: null, dimmable: false, color: false, warmth: false },
];
async function connection(page, options = {}) {
  const calls = [], reads = [], lights = fixtures();
  await page.route('**/lights-config.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.QUIET_LIGHTS_CONFIG=' + JSON.stringify({ endpoint }) + ';' }));
  await page.route(endpoint, async route => {
    const request = route.request();
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (options.offline) return route.abort();
    if (request.method() === 'POST') {
      const body = request.postDataJSON(); calls.push(body);
      for (const light of lights.filter(light => body.ids.includes(light.id))) {
        if (body.action === 'power') light.on = body.value;
        if (body.action === 'brightness') { light.brightness = body.value; light.on = body.value > 0; }
        if (body.action === 'kelvin') { light.kelvin = body.value; light.on = true; }
        if (body.action === 'color') { light.rgb = body.value; light.on = true; }
      }
    } else reads.push(request.method());
    await route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({ lights, accepted: true, unavailable: [] }) });
  });
  return { calls, reads, lights };
}

test('Lights opens a separate live popup without changing lighting; Back restores focus and stops polling', async ({ page }) => {
  const { calls, reads } = await connection(page);
  await page.goto('/');
  expect(reads).toHaveLength(0);
  await page.getByRole('button', { name: 'Open lights' }).click();
  const popup = page.getByRole('dialog', { name: 'Lights', exact: true });
  await expect(popup).toBeVisible();
  await expect(page.locator('.light-card')).toHaveCount(4);
  await expect(page.getByRole('switch')).toHaveCount(4);
  await expect(page.getByRole('slider', { name: 'TV light brightness', exact: true })).toHaveValue('20');
  await expect(page.getByRole('slider', { name: 'TV backlight brightness', exact: true })).toHaveValue('80');
  await expect(page.getByRole('switch', { name: 'Sink light power' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('slider', { name: /Sink/ })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Kitchen light brightness', exact: true })).toHaveValue('0');
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#lights-dialog'))).toBeTruthy();
  }
  expect(calls).toHaveLength(0);
  await page.screenshot({ path: 'artifacts/lighting-popup-preview.png' });
  await page.keyboard.press('Escape');
  await expect(popup).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open lights' })).toBeFocused();
  const before = reads.length;
  await page.waitForTimeout(2200);
  expect(reads).toHaveLength(before); expect(calls).toHaveLength(0);
});

test('arrows adjust brightness; room, sink, color and warmth controls target the correct lights', async ({ page }) => {
  const { calls } = await connection(page);
  await page.goto('/'); await page.getByRole('button', { name: 'Open lights' }).click();
  const brightness = page.getByRole('slider', { name: 'TV light brightness', exact: true });
  await expect(brightness).toHaveValue('20');
  await brightness.focus(); await page.keyboard.press('ArrowRight');
  await expect(brightness).toHaveValue('25');
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toEqual({ ids: ['light.living_room_tv_light'], action: 'brightness', value: 25 });
  await page.getByRole('switch', { name: 'Sink light power' }).click();
  await expect(page.getByRole('switch', { name: 'Sink light power' })).toHaveAttribute('aria-checked', 'true');
  expect(calls[1]).toEqual({ ids: ['switch.kitchen_sink'], action: 'power', value: true });
  await page.getByRole('button', { name: 'Kitchen all off' }).click();
  await expect.poll(() => calls.length).toBe(3);
  expect(calls[2]).toEqual({ ids: ['light.kitchen_kitchen', 'switch.kitchen_sink'], action: 'power', value: false });
  await page.getByRole('button', { name: 'TV backlight Blue', exact: true }).click();
  await expect.poll(() => calls.length).toBe(4);
  expect(calls[3]).toEqual({ ids: ['light.living_room_tv_backlight'], action: 'color', value: [70, 130, 255] });
  const warmth = page.getByRole('slider', { name: 'TV backlight white warmth' });
  await warmth.focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(() => calls.length).toBe(5);
  expect(calls[4]).toEqual({ ids: ['light.living_room_tv_backlight'], action: 'kelvin', value: 2800 });
});

test('offline lighting keeps the popup dismissible and supports retry', async ({ page }) => {
  const options = { offline: true };
  await connection(page, options);
  await page.goto('/'); await page.getByRole('button', { name: 'Open lights' }).click();
  await expect(page.locator('#lights-status')).toContainText('unavailable');
  options.offline = false;
  await page.getByRole('button', { name: 'Refresh lights' }).click();
  await expect(page.locator('#lights-status')).toContainText('Connected');
  await expect(page.locator('.light-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Close lights' }).click();
  await expect(page.getByRole('button', { name: 'Open lights' })).toBeFocused();
});
