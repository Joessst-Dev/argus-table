import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';
import { migrationGuides } from './migration';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));

const fixtures = mkdtempSync(join(tmpdir(), 'docs-migration-'));
afterAll(() => {
  rmSync(fixtures, { recursive: true, force: true });
});

/** A repo root holding the given reference files. */
function fixture(name: string, files: Record<string, string>): string {
  const root = join(fixtures, name);
  for (const [path, text] of Object.entries(files)) {
    const file = join(root, 'skills/argus-table-integrate/references', path);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text);
  }
  return root;
}

describe('migrationGuides', () => {
  test('lists the real guides by label, gaps last', () => {
    const guides = migrationGuides(repo);
    expect(guides.map((g) => g.id)).toEqual([
      'html-table',
      'ag-grid',
      'angular-material',
      'antd',
      'element-plus',
      'mui-x',
      'primeng-primevue',
      'tanstack',
      'vuetify',
      'gaps',
    ]);
    expect(guides.find((g) => g.id === 'tanstack')).toEqual({
      id: 'tanstack',
      title: 'From TanStack Table',
      label: 'TanStack Table',
      file: 'skills/argus-table-integrate/references/migrate/tanstack.md',
      path: 'migration/tanstack/',
    });
    expect(guides.find((g) => g.id === 'vuetify')?.title).toBe('From Vuetify v-data-table');
    expect(guides[0]?.label).toBe('A plain <table>');
    expect(guides.at(-1)).toEqual({
      id: 'gaps',
      title: 'Gaps',
      label: 'Gaps',
      file: 'skills/argus-table-integrate/references/gaps.md',
      path: 'migration/gaps/',
    });
  });

  test('a new file in migrate/ is a new guide', () => {
    const root = fixture('new', {
      'migrate/foo.md': '# From Foo Grid\n\nText.\n',
      'gaps.md': '# Gaps\n',
    });
    expect(migrationGuides(root).map((g) => [g.id, g.label])).toEqual([
      ['foo', 'Foo Grid'],
      ['gaps', 'Gaps'],
    ]);
  });

  test('a guide without a "# " first line fails, naming it', () => {
    const root = fixture('untitled', { 'migrate/bad.md': 'No title.\n', 'gaps.md': '# Gaps\n' });
    expect(() => migrationGuides(root)).toThrow(/migrate\/bad\.md/);
  });

  test('a guide named index or gaps fails', () => {
    const root = fixture('reserved', { 'migrate/index.md': '# From X\n', 'gaps.md': '# Gaps\n' });
    expect(() => migrationGuides(root)).toThrow(/migrate\/index\.md/);
  });
});
