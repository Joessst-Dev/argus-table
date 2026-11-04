import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

// Every story runs as a test: it renders, its play function runs, and axe
// checks it (`a11y.test: 'error'` in preview.ts makes a violation fail).
// Chromium only by default; BROWSERS=firefox,webkit or all for more.
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
  plugins: [storybookTest({ configDir: '.storybook' })],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: browsers.map((browser) => ({ browser })),
    },
    setupFiles: ['.storybook/vitest.setup.ts'],
  },
});
