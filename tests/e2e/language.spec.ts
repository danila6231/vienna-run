import { expect, test } from '@playwright/test';

test('Vietnamese by default, English on request, and Vietnamese again for the next player', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?speed=8&seed=5');
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  const cta = page.locator('.attract .cta');
  await expect(cta).toHaveText('Chạm vào màn hình để chơi');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('vi');
  expect(await page.evaluate(async () => (await document.fonts.load('16px "Be Vietnam Pro"', 'Điểm')).length)).toBeGreaterThan(0);

  await page.locator('.lang-pill').click();
  await expect(cta).toHaveText('Tap anywhere to play');
  expect(await page.evaluate(() => (window as any).__vr.screen)).toBe('attract');

  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width / 2, vp.height / 2);
  await expect(page.locator('.howto h2')).toHaveText('How to play');
  await page.waitForFunction(() => (window as any).__vr?.cycles >= 1, null, { timeout: 120_000 });
  await expect(cta).toHaveText('Chạm vào màn hình để chơi');
  expect(errors).toEqual([]);
});
