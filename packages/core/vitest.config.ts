import { defineConfig } from 'vitest/config';

// Core is DOM-free, so its tests run in plain Node.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
