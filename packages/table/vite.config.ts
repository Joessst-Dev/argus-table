import { defineConfig } from 'vite';

// Library build: ESM only, one output file per source module so that
// `sideEffects` in package.json can name the file that registers the element.
// Dependencies (lit) stay external; consumers' bundlers dedupe them.
export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    minify: false,
    emptyOutDir: true,
    lib: {
      entry: { index: 'src/index.ts' },
      formats: ['es'],
    },
    rollupOptions: {
      external: [/^lit(\/.*)?$/, /^@lit\//],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
});
