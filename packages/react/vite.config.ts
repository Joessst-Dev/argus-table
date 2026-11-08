import { defineConfig } from 'vite';

// Library build: ESM only, one file per source module. React, @lit/react and
// argus-table stay external; argus-table registers the elements when imported.
// `'use client'` heads every file so the components work in React Server
// Components apps (Next.js): the elements only exist in the browser. A
// directive in the source would be dropped by the bundler, so it's a banner.
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
      external: [/^react(\/.*)?$/, /^@lit\/react$/, /^argus-table$/],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        banner: "'use client';",
      },
    },
  },
});
