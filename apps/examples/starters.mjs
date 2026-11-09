// Shared by scripts/*.mjs (plain Node) and the Playwright config and spec.

/** The starters: their folder, the port the smoke test serves them on, and their build output. */
export const starters = [
  { name: 'html', port: 4301, dist: 'dist' },
  { name: 'react', port: 4302, dist: 'dist' },
  { name: 'vue', port: 4303, dist: 'dist' },
  { name: 'angular', port: 4304, dist: 'dist/browser' },
];

/** The published packages a starter can depend on, by name: their folder in the repo. */
export const packages = {
  'argus-table': 'packages/table',
  '@argus-table/themes': 'packages/themes',
  '@argus-table/react': 'packages/react',
  '@argus-table/vue': 'packages/vue',
  '@argus-table/angular': 'packages/angular',
};
