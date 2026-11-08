import { defineConfig } from 'vite';
import { minifyLitCss } from './scripts/minify-lit-css.js';

// CDN build: one minified ESM file with every dependency inlined, for
// `<script type="module" src="https://cdn.jsdelivr.net/npm/argus-table/dist/cdn/argus-table.js">`.
// size-limit measures this file. Runs after the library build, so it must not
// empty dist/.
export default defineConfig({
  plugins: [minifyLitCss()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    target: 'es2022',
    sourcemap: true,
    minify: true,
    outDir: 'dist/cdn',
    emptyOutDir: false,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'argus-table.js',
    },
    rolldownOptions: {
      // Library mode minifies ES output only partly: it keeps the /* @__PURE__ */
      // annotations a downstream bundler needs to tree-shake. This file is the
      // end of the line (nobody bundles it again), so minify it fully: about
      // 5 kB less gzipped.
      output: { minify: true },
    },
  },
});
