import { defineConfig, devices } from '@playwright/test';

// The docs site's pages against the built site (`astro preview`).
// BROWSERS: a comma list (chromium,firefox,webkit) or `all`; defaults to all,
// CI runs one engine per matrix job (as tests/e2e does).
const ALL = ['chromium', 'firefox', 'webkit'] as const;
const requested = process.env.BROWSERS ?? 'all';
const engines = ALL.filter((name) => requested === 'all' || requested.split(',').includes(name));
const device = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' };
// E2E_SHARD: `current/total` (e.g. `2/3`) runs one shard of the suite; CI runs three
// per engine, since the whole suite takes about 19 minutes in WebKit. Unset runs all.
const shardMatch = /^(\d+)\/(\d+)$/.exec(process.env.E2E_SHARD ?? '');
const shard = shardMatch ? { current: Number(shardMatch[1]), total: Number(shardMatch[2]) } : null;

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  // A test opens one flavour of an example (one test per flavour, so the work spreads
  // over the workers) and runs axe on it, which is slow on a large table.
  timeout: 60_000,
  // Every test opens its own page: shards and workers split by test, not by file.
  fullyParallel: true,
  shard,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:4329/argus-table/',
    trace: 'retain-on-failure',
  },
  projects: engines.map((name) => ({ name, use: { ...devices[device[name]] } })),
  webServer: {
    // A port of its own, so a running `astro dev` (4321) is never reused; --ignore-lock:
    // a stale lock from an earlier preview mustn't stop the run.
    command: 'pnpm --filter @argus-table/docs exec astro preview --port 4329 --ignore-lock',
    url: 'http://localhost:4329/argus-table/',
    reuseExistingServer: !process.env.CI,
  },
});
