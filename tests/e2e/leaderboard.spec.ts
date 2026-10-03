import { expect, test, type Page, type Route } from '@playwright/test';

const API = 'https://vr-e2e.supabase.co/rest/v1/vienna_run_scores';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function toResults(page: Page) {
  await page.goto('/?speed=8&seed=3');
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width / 2, vp.height / 2);
  await page.waitForFunction(() => (window as any).__vr?.screen === 'results', null, { timeout: 120_000 });
}

test('a player saves a code name and sees it on the start screen', async ({ page }) => {
  await page.route(`${API}**`, (route) => route.abort('internetdisconnected'));
  await toResults(page);
  const name = page.locator('.r-name');
  await name.pressSequentially('Anna!!', { delay: 20 });
  await expect(name).toHaveValue('Anna');
  await page.locator('.r-save').click();
  await expect(page.locator('.r-name-msg')).toHaveText('Bạn đứng thứ #1 hôm nay!');
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  await expect(page.locator('.board-panel')).toContainText('Anna');
  await page.locator('.board-open').click();
  await expect(page.locator('.board-modal')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__vr.screen)).toBe('attract');
});

test('a score saved offline uploads exactly once when the connection returns', async ({ page }) => {
  let online = false;
  const posted: string[] = [];
  const rows: Record<string, unknown>[] = [];
  await page.route(`${API}**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (!online) return route.abort('internetdisconnected');
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '[]') as Record<string, unknown>[];
      for (const r of body) {
        posted.push(String(r.id));
        if (!rows.some((x) => x.id === r.id)) rows.push(r);
      }
      return route.fulfill({ status: 201, headers: CORS, contentType: 'application/json', body: JSON.stringify(body.map((r) => ({ id: r.id }))) });
    }
    const named = rows.filter((r) => r.name !== null).map((r) => ({ id: r.id, created_at: r.created_at, name: r.name, score: r.score }));
    return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(named) });
  });
  await toResults(page);
  await page.locator('.r-name').pressSequentially('Bo');
  await page.locator('.r-save').click();
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  await page.waitForTimeout(500);
  expect(posted).toEqual([]);

  online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => posted.length, { timeout: 15_000 }).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(1_500);
  expect(posted).toHaveLength(1);
  expect(rows[0]).toMatchObject({ name: 'Bo', board: 'booth', lang: 'vi', preset: 'normal', questions_on: true });
});
