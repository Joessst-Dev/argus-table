import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';
import { readTypes } from './types';

const root = mkdtempSync(join(tmpdir(), 'docs-types-'));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(path: string, text: string) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

write(
  'core.ts',
  `/** A row's column. */
export interface CoreDef<TData, C = unknown> {
  /** Stable key. */
  id: string;
  header?: C | ((t: boolean) => C);
  /** Reads the value. */
  read?: (row: TData) => unknown;
}
/** A sort direction. */
export type Sort = 'asc' | 'desc';
`,
);
write(
  'index.ts',
  `import type { CoreDef } from './core.js';
export type Def<T = unknown, C = string> = CoreDef<T, C>;
/** Its own words. */
export type Named<T = unknown> = CoreDef<T, number>;
export type { Sort } from './core.js';
export const notAType = 1;
interface Private { x: number }
export type { Private as Hidden };
`,
);
write(
  'tsconfig.json',
  JSON.stringify({
    compilerOptions: { strict: true, module: 'nodenext', moduleResolution: 'nodenext' },
  }),
);

describe('readTypes', () => {
  const types = readTypes(join(root, 'index.ts'), join(root, 'tsconfig.json'));
  const type = (name: string) => types.find((t) => t.name === name);

  // Core's type parameters (TData) read as the alias's (T).
  test('documents an alias of an interface with its members', () => {
    expect(type('Def')).toMatchObject({
      kind: 'interface',
      typeParameters: '<T = unknown, C = string>',
      description: "A row's column.",
    });
    expect(type('Def')?.members).toEqual([
      { name: 'id', optional: false, type: 'string', description: 'Stable key.' },
      { name: 'header', optional: true, type: 'C | ((t: boolean) => C)', description: '' },
      {
        name: 'read',
        optional: true,
        type: '(row: T) => unknown',
        description: 'Reads the value.',
      },
    ]);
  });

  test("an alias's own doc wins over the interface's", () => {
    expect(type('Named')?.description).toBe('Its own words.');
  });

  test('documents other aliases by their definition', () => {
    expect(type('Sort')).toMatchObject({
      kind: 'type',
      definition: "'asc' | 'desc'",
      description: 'A sort direction.',
      members: [],
    });
  });

  test('lists only exported types, sorted by name', () => {
    expect(types.map((t) => t.name)).toEqual(['Def', 'Hidden', 'Named', 'Sort']);
  });

  test('the real argus-table types are all there', () => {
    const repo = fileURLToPath(new URL('../../../../../', import.meta.url));
    const real = readTypes(
      join(repo, 'packages/table/src/index.ts'),
      join(repo, 'packages/table/tsconfig.json'),
    );
    const names = new Set(real.map((t) => t.name));
    const dts = readFileSync(join(repo, 'packages/table/dist/index.d.ts'), 'utf8');
    const exported =
      /export type \{([^}]*)\}/
        .exec(dts)?.[1]
        ?.split(',')
        .map((n) => n.trim()) ?? [];
    expect(exported.length).toBeGreaterThan(40);
    expect(exported.filter((n) => n && !names.has(n))).toEqual([]);
    expect(real.find((t) => t.name === 'ColumnDef')?.members.map((m) => m.name)).toContain(
      'accessor',
    );
    expect(real.find((t) => t.name === 'DataSource')?.members.map((m) => m.name)).toContain(
      'getRows',
    );
  });
});
