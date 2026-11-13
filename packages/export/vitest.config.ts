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

// The writers (`*.node.test.ts`) are DOM-free and run in Node; the plugin reads a
// table and needs a browser.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'writers',
          include: ['src/**/*.node.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'plugin',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.node.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: browsers.map((browser) => ({ browser })),
          },
        },
      },
    ],
  },
});
