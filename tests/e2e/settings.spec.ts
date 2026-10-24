import { expect, test } from '@playwright/test';

test('staff open settings with the Settings button, pick Hard, and the next round runs faster', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=4');
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  const vp = page.viewportSize()!;

  // QUICK_SETTINGS: the top-left button opens settings straight away, without starting a round.
  await page.locator('.staff-open').click();
  await expect(page.locator('.settings')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__vr.screen)).toBe('attract');

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
