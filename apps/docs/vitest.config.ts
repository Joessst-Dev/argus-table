import { defineConfig } from 'vitest/config';

// The site's pure helpers and scripts, in Node. Pages are tested with
// Playwright against the built site (e2e/).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
