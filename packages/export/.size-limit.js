// The XLSX and PDF writers, and collecting detail rows, are imported dynamically
// on first use: leave them out of the plugin's size (esbuild would otherwise
// bundle them in) and measure each on its own.
const lazyWriters = {
  name: 'lazy-writers',
  setup(build) {
    build.onResolve({ filter: /\/((xlsx|pdf)\/[a-z]+|detail)\.js$/ }, (args) =>
      args.kind === 'dynamic-import' ? { path: args.path, external: true } : undefined,
    );
  },
};

export default [
  {
    name: 'tableExport() with CSV (min+gzip, argus-table excluded)',
    path: 'dist/index.js',
    import: '{ tableExport, exportTable, downloadTable }',
    ignore: ['argus-table'],
    gzip: true,
    limit: '3.0 kB',
    modifyEsbuildConfig: (config) => ({
      ...config,
      plugins: [...(config.plugins ?? []), lazyWriters],
    }),
  },
  {
    name: 'The Excel writer, loaded on first use (min+gzip)',
    path: 'dist/xlsx/xlsx.js',
    import: '{ toXlsx }',
    gzip: true,
    limit: '3.3 kB',
  },
  {
    name: 'Collecting detail rows, loaded on first use (min+gzip)',
    path: 'dist/detail.js',
    import: '{ collectDetails }',
    gzip: true,
    limit: '0.6 kB',
  },
  {
    name: 'The PDF writer, loaded on first use (min+gzip)',
    path: 'dist/pdf/pdf.js',
    import: '{ toPdf }',
    gzip: true,
    limit: '3.1 kB',
  },
];
