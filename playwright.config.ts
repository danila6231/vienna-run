import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 10 * 60_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1600, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
    // A fake Supabase address: the leaderboard e2e test intercepts it. The real one only exists on Vercel.
    env: { NEXT_PUBLIC_SUPABASE_URL: 'https://vr-e2e.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-public-key' },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
