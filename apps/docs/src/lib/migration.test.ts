import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';
import {
  migrationGuides,
  migrationGuidesIntegration,
  migrationPlugins,
  rewriteHref,
  type HastContext,
  type MdContext,
  type MdNode,
} from './migration';

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

describe('migrationPlugins', () => {
  const { mdast: factory, hast } = migrationPlugins({ repoRoot: repo, base: '/argus-table' });
  const guide = pathToFileURL(
    join(repo, 'skills/argus-table-integrate/references/migrate/tanstack.md'),
  );

  /** A visitor context that records what the plugin does. */
  function context() {
    const removed: MdNode[] = [];
    // Every field set, as [node type, field, value].
    const fields: string[][] = [];
    const ctx: MdContext = {
      removeNode: (node) => removed.push(node),
      setField: (node, key, value) => fields.push([node.type, key, value]),
    };
    return { ctx, removed, fields };
  }

  test('drops the title and rewrites links in a guide', () => {
    const plugin = factory({ fileURL: guide });
    if (!plugin) throw new Error('no plugin for a guide');
    const { ctx, removed, fields } = context();
    const title = { type: 'heading', depth: 1 };
    plugin.heading(title, ctx);
    plugin.heading({ type: 'heading', depth: 2 }, ctx);
    // Only the first: another depth-1 heading in the body stays.
    plugin.heading({ type: 'heading', depth: 1 }, ctx);
    expect(removed).toEqual([title]);
    plugin.link({ type: 'link', url: '../gaps.md#pagination' }, ctx);
    plugin.link({ type: 'link', url: '#concepts' }, ctx);
    plugin.definition({ type: 'definition', url: '../testing.md' }, ctx);
    const blob = 'https://github.com/Joessst-Dev/argus-table/blob/main/';
    expect(fields).toEqual([
      ['link', 'url', '/argus-table/migration/gaps/#pagination'],
      ['link', 'url', '#concepts'],
      ['definition', 'url', `${blob}skills/argus-table-integrate/references/testing.md`],
    ]);
  });

  test("wraps code blocks' long lines", () => {
    const plugin = factory({ fileURL: guide });
    const { ctx, fields } = context();
    plugin?.code({ type: 'code', meta: null }, ctx);
    plugin?.code({ type: 'code', meta: 'title="a.ts"' }, ctx);
    expect(fields).toEqual([
      ['code', 'meta', 'wrap'],
      ['code', 'meta', 'title="a.ts" wrap'],
    ]);
  });

  test('makes tables focusable: they scroll sideways', () => {
    const set: unknown[][] = [];
    const ctx: HastContext = {
      setProperty: (...args) => {
        set.push(args);
      },
    };
    const plugin = hast({ fileURL: guide });
    expect(plugin?.element.filter).toEqual(['table']);
    const table = { tagName: 'table' };
    plugin?.element.visit(table, ctx);
    expect(set).toEqual([[table, 'tabIndex', 0]]);
  });

  test('leaves other markdown alone', () => {
    expect(
      factory({ fileURL: pathToFileURL(join(repo, 'apps/docs/src/content/docs/index.mdx')) }),
    ).toBeUndefined();
    expect(factory({ fileURL: undefined })).toBeUndefined();
    expect(hast({ fileURL: undefined })).toBeUndefined();
  });

  test('a reference file that is no guide fails, rather than passing through', () => {
    const other = pathToFileURL(join(repo, 'skills/argus-table-integrate/references/api.md'));
    expect(() => factory({ fileURL: other })).toThrow(/references\/api\.md/);
  });

  test('a link to a missing file fails, naming the guide', () => {
    const plugin = factory({ fileURL: guide });
    expect(() => plugin?.link({ type: 'link', url: '../nope.md' }, context().ctx)).toThrow(
      'migrate/tanstack.md links to ../nope.md',
    );
  });
});

describe('migrationGuidesIntegration', () => {
  test("adds the plugins to the processor's", () => {
    const mdastPlugins: unknown[] = ['starlight'];
    const hastPlugins: unknown[] = [];
    const config = { markdown: { processor: { options: { mdastPlugins, hastPlugins } } } };
    migrationGuidesIntegration({ repoRoot: repo, base: '/argus-table' }).hooks[
      'astro:config:setup'
    ]({ config });
    expect(mdastPlugins).toHaveLength(2);
    expect(typeof mdastPlugins[1]).toBe('function');
    expect(hastPlugins).toHaveLength(1);
  });

  test('fails without a Sätteri processor', () => {
    const setup = migrationGuidesIntegration({ repoRoot: repo, base: '/argus-table' }).hooks[
      'astro:config:setup'
    ];
    expect(() => {
      setup({ config: { markdown: {} } });
    }).toThrow('Sätteri');
  });
});
