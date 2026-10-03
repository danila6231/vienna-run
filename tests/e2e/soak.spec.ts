import { expect, test } from '@playwright/test';

const ROUNDS = Number(process.env.SOAK_ROUNDS ?? 20);

test(`survives ${ROUNDS} back-to-back rounds without errors, reloads or leaks`, async ({ page }) => {
  test.setTimeout(ROUNDS * 60_000 + 300_000);
  const errors: string[] = [];
  let loads = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('load', () => loads++);
  await page.goto('/?autoplay=1&speed=8');
  await page.waitForFunction(() => (window as any).__vr?.cycles >= 2, null, { timeout: 300_000 });
  const heapStart: number = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? 0);
  await page.waitForFunction((n) => (window as any).__vr?.cycles >= n, ROUNDS, { timeout: ROUNDS * 60_000 });
  const heapEnd: number = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? 0);
  const state = await page.evaluate(() => (window as any).__vr);
  expect(errors).toEqual([]);
  expect(loads).toBe(1); // no watchdog reloads
  expect(state.contextLost).toBe(false);
  if (heapStart > 0) expect(heapEnd).toBeLessThan(heapStart * 1.5);
});
