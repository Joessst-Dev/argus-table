import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';
import { migrationGuides, remarkMigration, rewriteHref, type MdNode } from './migration';

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
    });
    expect(guides.find((g) => g.id === 'vuetify')?.title).toBe('From Vuetify v-data-table');
    expect(guides[0]?.label).toBe('A plain <table>');
    expect(guides.at(-1)).toEqual({
      id: 'gaps',
      title: 'Gaps',
      label: 'Gaps',
      file: 'skills/argus-table-integrate/references/gaps.md',
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

describe('rewriteHref', () => {
  const from = 'skills/argus-table-integrate/references/migrate/tanstack.md';
  const context = { guides: migrationGuides(repo), base: '/argus-table', exists: () => true };
  const github = 'https://github.com/Joessst-Dev/argus-table/blob/main/';

  test('a rendered file goes to its page, anchor kept', () => {
    expect(rewriteHref('../gaps.md#pagination', from, context)).toBe(
      '/argus-table/migration/gaps/#pagination',
    );
    expect(rewriteHref('../gaps.md', from, context)).toBe('/argus-table/migration/gaps/');
    expect(
      rewriteHref('migrate/ag-grid.md', 'skills/argus-table-integrate/references/gaps.md', context),
    ).toBe('/argus-table/migration/ag-grid/');
  });

  test('another file goes to GitHub, anchor kept', () => {
    expect(rewriteHref('../addons.md#cell-editing-argus-tableediting', from, context)).toBe(
      `${github}skills/argus-table-integrate/references/addons.md#cell-editing-argus-tableediting`,
    );
  });

  test('a link written without ../ resolves from its own folder', () => {
    expect(
      rewriteHref('server-data.md', 'skills/argus-table-integrate/references/gaps.md', context),
    ).toBe(`${github}skills/argus-table-integrate/references/server-data.md`);
  });

  test('URLs, mailto and same-page anchors are left alone', () => {
    for (const href of ['https://ag-grid.com/', 'mailto:a@b.c', '#concepts', '/argus-table/']) {
      expect(rewriteHref(href, from, context)).toBe(href);
    }
  });

  test('throws for a missing file', () => {
    expect(() => rewriteHref('../nope.md#x', from, { ...context, exists: () => false })).toThrow(
      "migrate/tanstack.md links to ../nope.md, which doesn't exist",
    );
  });
});

describe('remarkMigration', () => {
  const tree = (): MdNode => ({
    type: 'root',
    children: [
      { type: 'heading', depth: 1, children: [{ type: 'text' }] },
      {
        type: 'paragraph',
        children: [
          { type: 'link', url: '../gaps.md#pagination', children: [{ type: 'text' }] },
          { type: 'link', url: '../server-data.md', children: [{ type: 'text' }] },
        ],
      },
      { type: 'heading', depth: 2, children: [{ type: 'text' }] },
      { type: 'definition', url: '../testing.md' },
    ],
  });
  const transform = remarkMigration({ repoRoot: repo, base: '/argus-table' });

  test('drops the title and rewrites links in a guide', () => {
    const root = tree();
    transform(root, {
      path: join(repo, 'skills/argus-table-integrate/references/migrate/tanstack.md'),
    });
    expect(root.children?.map((n) => [n.type, n.depth])).toEqual([
      ['paragraph', undefined],
      ['heading', 2],
      ['definition', undefined],
    ]);
    const blob = 'https://github.com/Joessst-Dev/argus-table/blob/main/';
    expect(root.children?.[0]?.children?.map((n) => n.url)).toEqual([
      '/argus-table/migration/gaps/#pagination',
      `${blob}skills/argus-table-integrate/references/server-data.md`,
    ]);
    expect(root.children?.[2]?.url).toBe(`${blob}skills/argus-table-integrate/references/testing.md`);
  });

  test('leaves other markdown alone', () => {
    const root = tree();
    transform(root, { path: join(repo, 'apps/docs/src/content/docs/index.mdx') });
    expect(root).toEqual(tree());
    transform(root, {});
    expect(root).toEqual(tree());
  });
});
