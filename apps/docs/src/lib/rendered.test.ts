import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';
import { migrationGuides } from './migration';
import { packageGuides } from './packages';
import {
  renderedMarkdownIntegration,
  renderedPlugins,
  rewriteHref,
  type MdContext,
  type MdNode,
} from './rendered';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const pages = [...migrationGuides(repo), ...packageGuides(repo)];

describe('rewriteHref', () => {
  const from = 'skills/argus-table-integrate/references/migrate/tanstack.md';
  const context = { pages, base: '/argus-table', exists: () => true };
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

  test('a link between rendered pages of different kinds resolves', () => {
    expect(rewriteHref('../../../../packages/export/README.md#options', from, context)).toBe(
      '/argus-table/guides/export/#options',
    );
    expect(rewriteHref('../editing/README.md', 'packages/export/README.md', context)).toBe(
      '/argus-table/guides/editing/',
    );
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

describe('renderedPlugins', () => {
  const { mdast: factory } = renderedPlugins({ repoRoot: repo, base: '/argus-table', pages });
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

  test('leaves other markdown alone', () => {
    expect(
      factory({ fileURL: pathToFileURL(join(repo, 'apps/docs/src/content/docs/index.mdx')) }),
    ).toBeUndefined();
    expect(factory({ fileURL: undefined })).toBeUndefined();
  });

  test('markdown from outside the site that is no page fails', () => {
    const other = pathToFileURL(join(repo, 'skills/argus-table-integrate/references/api.md'));
    expect(() => factory({ fileURL: other })).toThrow(/references\/api\.md/);
    const table = pathToFileURL(join(repo, 'packages/table/README.md'));
    expect(() => factory({ fileURL: table })).toThrow(/packages\/table\/README\.md/);
    // The site's own pages pass through.
    expect(
      factory({ fileURL: pathToFileURL(join(repo, 'apps/docs/src/content/docs/index.mdx')) }),
    ).toBeUndefined();
  });

  test('a link to a missing file fails, naming the guide', () => {
    const plugin = factory({ fileURL: guide });
    expect(() => plugin?.link({ type: 'link', url: '../nope.md' }, context().ctx)).toThrow(
      'migrate/tanstack.md links to ../nope.md',
    );
  });
});

describe('renderedMarkdownIntegration', () => {
  test("adds the plugins to the processor's", () => {
    const mdastPlugins: unknown[] = ['starlight'];
    const config = { markdown: { processor: { options: { mdastPlugins } } } };
    renderedMarkdownIntegration({ repoRoot: repo, base: '/argus-table', pages }).hooks[
      'astro:config:setup'
    ]({ config });
    expect(mdastPlugins).toHaveLength(2);
    expect(typeof mdastPlugins[1]).toBe('function');
  });

  test('fails without a Sätteri processor', () => {
    const setup = renderedMarkdownIntegration({ repoRoot: repo, base: '/argus-table', pages })
      .hooks['astro:config:setup'];
    expect(() => {
      setup({ config: { markdown: {} } });
    }).toThrow('Sätteri');
  });
});
