import { defineConfig } from 'vite';

// The playground: a sandbox for `pnpm play`, and the page that benchmarks,
// e2e and visual tests drive.
export default defineConfig({
  build: { target: 'es2022' },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
});
