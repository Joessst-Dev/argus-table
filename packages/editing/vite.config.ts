import { defineConfig } from 'vite';

// Library build: ESM only, one file per source module. Lit and argus-table stay
// external: the plugin plugs into the page's own table and uses its Lit.
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
      external: [/^lit(\/.*)?$/, /^@lit\//, /^argus-table$/],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
});
