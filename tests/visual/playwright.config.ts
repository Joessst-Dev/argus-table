import { defineConfig, devices } from '@playwright/test';

// Screenshots of the playground. Baselines are only ever made inside the
// Playwright Docker image (see scripts/visual.sh and visual-update.yml), so
// fonts and rendering match CI.
export default defineConfig({
  testDir: 'specs',
  snapshotPathTemplate: '{testDir}/../__screenshots__/{arg}{ext}',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixels: 0 } },
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 960, height: 420 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: 'pnpm --filter @argus-table/playground preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
