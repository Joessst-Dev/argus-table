import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the built playground (`vite preview`).
// BROWSERS: a comma list (chromium,firefox,webkit) or `all`; defaults to all,
// CI runs one engine per matrix job.
const ALL = ['chromium', 'firefox', 'webkit'] as const;
const requested = process.env.BROWSERS ?? 'all';
const engines = ALL.filter((name) => requested === 'all' || requested.split(',').includes(name));
const device = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' };

export default defineConfig({
  testDir: 'specs',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: engines.map((name) => ({ name, use: { ...devices[device[name]] } })),
  webServer: {
    command: 'pnpm --filter @argus-table/playground preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
