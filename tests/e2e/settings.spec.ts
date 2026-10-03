import { expect, test } from '@playwright/test';

test('staff open settings with a corner hold and the PIN, pick Hard, and the next round runs faster', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=4');
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  const vp = page.viewportSize()!;

  // A short press in the corner does nothing; a 3-second hold opens the PIN pad.
  await page.mouse.move(vp.width * 0.04, vp.height * 0.05);
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  await expect(page.locator('.pin-pad')).toBeVisible();
  for (const d of '2468') await page.locator('.pin-key', { hasText: new RegExp(`^${d}$`) }).click();
  await expect(page.locator('.settings')).toBeVisible();

  await page.locator('.settings button', { hasText: /^Hard$/ }).click();
  await page.locator('.settings button', { hasText: /^Save$/ }).click();
  await expect(page.locator('.settings')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vienna-run:settings') ?? '{}').preset)).toBe('hard');

  await page.mouse.click(vp.width / 2, vp.height / 2);
  await page.waitForFunction(() => (window as any).__vr?.screen === 'run', null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__vr.baseSpeed)).toBeCloseTo(58 / 3.6, 2);

  // Settings survive a reload.
  await page.reload();
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as any).__vr.baseSpeed)).toBeCloseTo(58 / 3.6, 2);
  expect(errors).toEqual([]);
});
