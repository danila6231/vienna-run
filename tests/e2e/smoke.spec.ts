import { expect, test } from '@playwright/test';

test('boots, plays a full round by itself and returns to attract without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?autoplay=1&speed=8&seed=7');
  await page.waitForFunction(() => (window as any).__vr?.cycles >= 1, null, { timeout: 180_000 });
  await page.screenshot({ path: 'test-results/smoke.png' });
  expect(errors).toEqual([]);
});

test('the hosted build keeps working after the network drops', async ({ page, context }) => {
  await page.goto('/?autoplay=1&speed=8');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => (window as any).__vr?.cycles >= 1, null, { timeout: 180_000 });
});
