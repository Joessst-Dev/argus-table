// The editor is imported dynamically when it first opens: leave it out of the
// plugin's size (esbuild would otherwise bundle it in) and measure it on its own.
const lazyEditor = {
  name: 'lazy-editor',
  setup(build) {
    build.onResolve({ filter: /\/editor\/[a-z]+\.js$/ }, (args) =>
      args.kind === 'dynamic-import' ? { path: args.path, external: true } : undefined,
    );
  },
};

export default [
  {
    name: 'formulas() with every built-in function (min+gzip, lit and argus-table excluded)',
    path: 'dist/index.js',
    import: '{ formulas }',
    ignore: ['lit', 'argus-table'],
    gzip: true,
    limit: '9 kB',
    modifyEsbuildConfig: (config) => ({
      ...config,
      plugins: [...(config.plugins ?? []), lazyEditor],
    }),
  },
  {
    name: 'The formula editor, loaded when it first opens (min+gzip, lit excluded)',
    path: ['dist/editor/editor.js', 'dist/editor/docs.js'],
    import: { 'dist/editor/editor.js': '{ openEditor }', 'dist/editor/docs.js': '{ DOCS }' },
    ignore: ['lit', 'argus-table'],
    gzip: true,
    limit: '8 kB',
  },
];
