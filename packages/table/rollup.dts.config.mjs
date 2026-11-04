// Bundles the type declarations into one dist/index.d.ts. The private
// @argus-table/core is inlined, so no import of it is left for consumers;
// lit and TanStack stay as imports because they are real dependencies.
import { dts } from 'rollup-plugin-dts';

export default {
  input: 'src/index.ts',
  output: { file: 'dist/index.d.ts', format: 'es' },
  external: [/^lit(\/.*)?$/, /^@lit\//, /^@tanstack\//],
  plugins: [dts({ respectExternal: true, tsconfig: 'tsconfig.build.json' })],
};
