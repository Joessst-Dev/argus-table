import { defineConfig, devices } from '@playwright/test';
import { starters } from './starters.mjs';

// Smoke tests for the starters. `pnpm smoke` first runs scripts/prepare.mjs,
// which installs and builds each starter in .smoke/<name> against the packed
// packages; this config serves each build and checks it in Chromium.
export default defineConfig({
  testMatch: 'smoke.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  projects: [{ name: 'chromium' }],
  webServer: starters.map(({ name, port, dist }) => ({
    command: `pnpm exec vite preview --outDir .smoke/${name}/${dist} --port ${String(port)} --strictPort`,
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: false,
  })),
});
