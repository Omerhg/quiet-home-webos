const { test, expect } = require('./fixtures.cjs');

test('photo picker persists a subset, skips excluded photos and keeps at least one', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { if (!localStorage.getItem('quiet-home.wallpaper.v1')) localStorage.setItem('quiet-home.wallpaper.v1', JSON.stringify({ mode: 'rotate', index: 0, selected: ['blue-ridges.jpg', 'forest-falls.jpg', 'black-sand-coast.jpg', 'desert-dusk.jpg'] })); });
  await page.goto('/');
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'blue-ridges.jpg');
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await page.getByRole('tab', { name: 'Background' }).click();
  await page.getByRole('button', { name: /Choose rotation photos/ }).click();
  const photo = file => page.locator(`[data-photo="${file}"]`);
  await photo('blue-ridges.jpg').click();
  await photo('black-sand-coast.jpg').click();
  await photo('desert-dusk.jpg').click();
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'forest-falls.jpg');
  await photo('forest-falls.jpg').click();
  await expect(photo('forest-falls.jpg')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#toast')).toContainText('Keep at least one');
  await page.clock.fastForward(270000);
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'forest-falls.jpg');
  await photo('desert-dusk.jpg').click();
  await page.screenshot({ path: 'artifacts/rotation-photo-picker.png' });
  await page.clock.fastForward(90001);
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'desert-dusk.jpg');
  await page.reload();
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'desert-dusk.jpg');
  expect(await page.evaluate(() => QUIET_WALLPAPERS.photos().filter(p => p.selected).map(p => p.file))).toEqual(['forest-falls.jpg', 'desert-dusk.jpg']);
  await expect(page.locator('#apps .app')).toHaveCount(7);
});

test('bundled UHD nature views rotate without changing favorites or making external requests', async ({ page }) => {
  const external = [];
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:8765')) external.push(r.url()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'blue-ridges.jpg');
  const photos = await page.evaluate(() => QUIET_WALLPAPERS.photos().map(photo => photo.file));
  expect(photos).toHaveLength(12);
  await expect(page.locator('#clock')).toContainText(/\d{2}:\d{2}/);
  await expect(page.locator('#date')).not.toBeEmpty();
  await expect(page.locator('#wallpapers img')).toHaveJSProperty('naturalWidth', 3840);
  await expect(page.locator('#wallpapers img')).toHaveJSProperty('naturalHeight', 2160);
  await expect(page.locator('#screen')).toHaveAttribute('data-glass', 'cached');
  await page.clock.runFor(50);
  await page.screenshot({ path: 'artifacts/nature-home-preview.png' });
  for (let i = 1; i <= photos.length; i++) {
    await page.clock.fastForward(90001);
    await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', photos[i % photos.length]);
    await expect(page.locator('#wallpapers img').last()).toHaveJSProperty('naturalWidth', 3840);
    await page.clock.runFor(2200);
    await expect(page.locator('#wallpapers img')).toHaveCount(1);
  }
  await page.keyboard.press('Space'); // Wake the idle scenery view without activating Home.
  await expect(page.getByRole('button', { name: 'Jellyfin', exact: true })).toBeFocused();
  await expect(page.locator('#apps .app')).toHaveCount(7);
  expect(external).toEqual([]);
});

test('expanded gallery preserves a saved subset and remote arrows reach the new photos', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (!localStorage.getItem('quiet-home.wallpaper.v1')) localStorage.setItem('quiet-home.wallpaper.v1', JSON.stringify({ mode: 'still', index: 1, selected: ['forest-falls.jpg', 'desert-dusk.jpg'] }));
  });
  await page.goto('/');
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'forest-falls.jpg');
  expect(await page.evaluate(() => QUIET_WALLPAPERS.photos().filter(photo => photo.selected).map(photo => photo.file))).toEqual(['forest-falls.jpg', 'desert-dusk.jpg']);
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await page.getByRole('tab', { name: 'Background' }).click();
  await page.getByRole('button', { name: /Choose rotation photos/ }).click();
  await expect(page.locator('#settings-summary')).toHaveText('2 of 12 selected');
  await expect(page.locator('.photo-choice')).toHaveCount(12);
  await page.keyboard.press('ArrowRight');
  for (let row = 0; row < 3; row++) await page.keyboard.press('ArrowDown');
  const lastRow = page.locator('[data-photo="sunlit-forest.jpg"]');
  await expect(lastRow).toBeFocused();
  await expect(lastRow).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(lastRow).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#settings-summary')).toHaveText('3 of 12 selected');
  await page.screenshot({ path: 'artifacts/expanded-nature-picker.png' });
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#editor .editor-footer :focus')).toHaveCount(1);
  await page.reload();
  expect(await page.evaluate(() => QUIET_WALLPAPERS.photos().filter(photo => photo.selected).map(photo => photo.file))).toEqual(['forest-falls.jpg', 'desert-dusk.jpg', 'sunlit-forest.jpg']);
  expect(await page.evaluate(() => QUIET_WALLPAPERS.mode())).toBe('still');
});

test('Appearance supports a still view, next scene and persistent dark-glass rollback', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'blue-ridges.jpg');
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await page.getByRole('tab', { name: 'Background' }).click();
  await page.getByRole('button', { name: /Keep this view/ }).click();
  await page.clock.fastForward(180000);
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'blue-ridges.jpg');
  await page.getByRole('button', { name: /Next nature view/ }).click();
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'forest-falls.jpg');
  await page.reload();
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'forest-falls.jpg');
  expect(await page.evaluate(() => QUIET_WALLPAPERS.mode())).toBe('still');
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await page.getByRole('tab', { name: 'Background' }).click();
  await page.getByRole('button', { name: /Dark glass/ }).click();
  await expect(page.locator('#wallpapers img')).toHaveCount(0);
  await expect(page.locator('#screen')).not.toHaveClass(/nature-background/);
  await page.reload();
  expect(await page.evaluate(() => QUIET_WALLPAPERS.mode())).toBe('glass');
  await expect(page.locator('#wallpapers img')).toHaveCount(0);
});

test('rotation pauses while hidden and a missing asset keeps a working nature background', async ({ page }) => {
  await page.clock.install();
  await page.route('**/wallpapers/forest-falls.jpg', r => r.abort());
  await page.goto('/');
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'blue-ridges.jpg');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(180000);
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'blue-ridges.jpg');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(90001);
  await expect(page.locator('#wallpapers')).toHaveAttribute('data-scene', 'black-sand-coast.jpg');
  await expect(page.locator('#wallpapers img').last()).toHaveJSProperty('naturalWidth', 3840);
  await page.keyboard.press('Space'); // Wake the idle scenery view without activating Home.
  await expect(page.getByRole('button', { name: 'Jellyfin', exact: true })).toBeFocused();
});
