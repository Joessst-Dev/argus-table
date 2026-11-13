import { defineConfig } from 'vite';

// Library build: ESM only, one file per source module, so the XLSX and PDF
// writers stay separate chunks the plugin imports on first use. argus-table stays
// external: the plugin only reads the page's own table.
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
