import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Browsers to run: `BROWSERS=all` or a comma list (chromium,firefox,webkit).
// Defaults to Chromium so local runs stay fast; CI runs one browser per matrix job.
const ALL = ['chromium', 'firefox', 'webkit'] as const;
type Browser = (typeof ALL)[number];

const requested = process.env.BROWSERS ?? 'chromium';
const browsers: readonly Browser[] =
  requested === 'all'
    ? ALL
    : requested
        .split(',')
        .map((name) => name.trim())
        .filter((name): name is Browser => (ALL as readonly string[]).includes(name));

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: browsers.map((browser) => ({ browser })),
    },
  },
});
