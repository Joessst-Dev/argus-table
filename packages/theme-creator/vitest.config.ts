import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// The creator's unit tests, next to its code, in the browser (it measures
// colours and renders tables). Chromium only by default; BROWSERS=firefox,webkit
// or all for more.
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
    name: 'theme-creator',
    include: ['src/**/*.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: browsers.map((name) => ({ browser: name })),
    },
  },
});
