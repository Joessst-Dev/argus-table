import { defineConfig } from 'vite';

// Library build: ESM only, one file per source module. Vue and argus-table stay
// external; argus-table registers the elements when imported. The source has
// no .vue files (render functions only), so the build needs no Vue plugin.
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
      external: [/^vue$/, /^argus-table$/],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
});
