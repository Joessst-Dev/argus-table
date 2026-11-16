export default [
  {
    name: 'cellEditing() and applyEdit() (min+gzip, lit and argus-table excluded)',
    path: 'dist/index.js',
    import: '{ cellEditing, applyEdit }',
    ignore: ['lit', 'argus-table'],
    gzip: true,
    limit: '3.5 kB',
  },
];
