import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test.beforeAll(() => {
  // Even with Supabase details in the environment, the USB copy must not contain them.
  execSync('npm run build:offline', { stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://vr-e2e.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-public-key' } });
});

test('the USB single-file copy runs from disk with no network at all', async ({ page, context }) => {
  await context.setOffline(true);
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.goto(`file://${path.resolve('dist-offline/index.html')}?autoplay=1&speed=8&seed=3`);
  await page.waitForFunction(() => (window as any).__vr?.cycles >= 1, null, { timeout: 180_000 });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  const html = readFileSync('dist-offline/index.html', 'utf8');
  expect(html).not.toContain('vr-e2e');
  expect(html).not.toContain('e2e-public-key');
});
