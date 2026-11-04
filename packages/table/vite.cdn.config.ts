import { defineConfig } from 'vite';

// CDN build: one minified ESM file with every dependency inlined, for
// `<script type="module" src="https://cdn.jsdelivr.net/npm/argus-table/dist/cdn/argus-table.js">`.
// size-limit measures this file. Runs after the library build, so it must not
// empty dist/.
export default defineConfig({
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
  },
});
