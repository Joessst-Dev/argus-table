import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

// Two projects:
// - storybook: every story runs as a test: it renders, its play function runs,
//   and axe checks it (`a11y.test: 'error'` in preview.ts makes a violation fail).
// - theme-creator: the creator's unit tests, next to its code.
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

// A fresh object per project: Vitest names the instances after their project.
const browser = () => ({
  enabled: true,
  headless: true,
  provider: playwright(),
  instances: browsers.map((name) => ({ browser: name })),
});

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [storybookTest({ configDir: '.storybook' })],
        test: {
          name: 'storybook',
          browser: browser(),
          setupFiles: ['.storybook/vitest.setup.ts'],
        },
      },
      {
        test: {
          name: 'theme-creator',
          include: ['theme-creator/**/*.test.ts'],
          browser: browser(),
        },
      },
    ],
  },
});
