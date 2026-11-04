import { defineConfig } from 'vitest/config';

// The theme tests parse CSS; they run in plain Node.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
