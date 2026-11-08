import { defineConfig } from 'vitest/config';

// Pure Node: the generator reads JSON and writes source text.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
