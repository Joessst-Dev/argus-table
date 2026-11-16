import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { checkExamples } from './check-examples.mjs';

const roots: string[] = [];

/** A site folder with these files (path → content). */
function site(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'docs-check-'));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

/** An example's four flavours, its ids prefixed as required. */
const example = (id: string): Record<string, string> => ({
  [`src/examples/${id}/html/index.html`]: `<argus-table id="${id.replace('/', '-')}-table"></argus-table>`,
  [`src/examples/${id}/html/main.js`]: '',
  [`src/examples/${id}/react/X.tsx`]: '',
  [`src/examples/${id}/vue/X.vue`]: '',
  [`src/examples/${id}/angular/x.component.ts`]: '',
});

/** A page using these examples, its islands imported from each example's folders. */
const page = (...ids: string[]) =>
  [
    ...ids.flatMap((id, i) => [
      `import R${String(i)} from '../../examples/${id}/react/X.tsx';`,
      `import V${String(i)} from '../../examples/${id}/vue/X.vue';`,
      `import { A${String(i)} } from '../../examples/${id}/angular/x.component.ts';`,
    ]),
    '',
    ...ids.map(
      (id, i) =>
        `<FlavourTabs example="${id}">\n  <R${String(i)} slot="react" client:visible />\n  <V${String(i)} slot="vue" client:visible />\n  <A${String(i)} slot="angular" client:visible />\n</FlavourTabs>`,
    ),
  ].join('\n');

const spec = (...ids: string[]) => ids.map((id) => `openFlavour(page, '${id}', f);`).join('\n');

/** A complete, valid site with these examples on one page. */
const valid = (...ids: string[]): Record<string, string> => ({
  ...Object.fromEntries(ids.flatMap((id) => Object.entries(example(id)))),
  'src/content/docs/features/x.mdx': page(...ids),
  'e2e/x.spec.ts': spec(...ids),
});

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('checkExamples', () => {
  test('complete examples, used, with their islands and specs, are fine', () => {
    const root = site({
      ...valid('sorting/basic', 'sorting/multi'),
      'src/examples/sorting/data.ts': '',
      'src/examples/sorting/shared/helpers.ts': '',
    });
    expect(checkExamples(root)).toEqual([]);
  });

  test('pages in any folder count', () => {
    const files = valid('sorting/basic');
    const root = site({
      ...files,
      'src/content/docs/features/x.mdx': '',
      'src/content/docs/start/first-table.mdx': page('sorting/basic'),
    });
    expect(checkExamples(root)).toEqual([]);
  });

  test('names a missing flavour', () => {
    const files = valid('sorting/basic');
    delete files['src/examples/sorting/basic/vue/X.vue'];
    expect(checkExamples(site(files))).toEqual([
      'src/examples/sorting/basic: missing the vue flavour',
    ]);
  });

  test('names a flavour with two components', () => {
    const root = site({ ...valid('sorting/basic'), 'src/examples/sorting/basic/react/Y.tsx': '' });
    expect(checkExamples(root)).toEqual([
      'src/examples/sorting/basic/react: more than one component',
    ]);
  });

  test('names an example no page uses', () => {
    const root = site({ ...valid('sorting/basic'), ...example('sorting/extra') });
    expect(checkExamples(root)).toEqual([
      'src/examples/sorting/extra: not used on any page',
      'src/examples/sorting/extra: no e2e spec opens it',
    ]);
  });

  test('names a page example that does not exist', () => {
    const files = valid('sorting/basic');
    files['src/content/docs/features/x.mdx'] = page('sorting/basic', 'sorting/gone');
    expect(checkExamples(site(files))).toEqual([
      'src/content/docs/features/x.mdx: example "sorting/gone" does not exist',
    ]);
  });

  test('names an island imported from another example', () => {
    const files = valid('sorting/basic', 'sorting/multi');
    const text = files['src/content/docs/features/x.mdx'] ?? '';
    files['src/content/docs/features/x.mdx'] = text.replace(
      "import V1 from '../../examples/sorting/multi/vue/X.vue';",
      "import V1 from '../../examples/sorting/basic/vue/X.vue';",
    );
    expect(checkExamples(site(files))).toEqual([
      'src/content/docs/features/x.mdx: the vue island of "sorting/multi" comes from ../../examples/sorting/basic/vue/X.vue, not examples/sorting/multi/vue/',
    ]);
  });

  test('names a missing island and one that loads eagerly', () => {
    const files = valid('sorting/basic');
    const text = files['src/content/docs/features/x.mdx'] ?? '';
    files['src/content/docs/features/x.mdx'] = text
      .replace('  <V0 slot="vue" client:visible />\n', '')
      .replace('<A0 slot="angular" client:visible />', '<A0 slot="angular" client:load />');
    expect(checkExamples(site(files))).toEqual([
      'src/content/docs/features/x.mdx: example "sorting/basic" has no vue island',
      'src/content/docs/features/x.mdx: the angular island of "sorting/basic" must load client:visible',
    ]);
  });

  test('names ids without the example’s prefix, and ids two examples share', () => {
    const files = valid('sorting/basic', 'sorting/multi');
    files['src/examples/sorting/multi/html/index.html'] =
      '<argus-table id="sorting-basic-table"></argus-table><p id="total"></p>';
    expect(checkExamples(site(files))).toEqual([
      'src/examples/sorting/multi/html/index.html: id "sorting-basic-table" must start with "sorting-multi-"',
      'src/examples/sorting/multi/html/index.html: id "sorting-basic-table" is also used by sorting/basic',
      'src/examples/sorting/multi/html/index.html: id "total" must start with "sorting-multi-"',
    ]);
  });

  test('other attributes ending in id are not element ids', () => {
    const files = valid('sorting/basic');
    files['src/examples/sorting/basic/html/index.html'] =
      '<argus-table id="sorting-basic-table"><argus-column column-id="id"></argus-column></argus-table>';
    expect(checkExamples(site(files))).toEqual([]);
  });

  test("names a flavour that doesn't load its feature's styles.css", () => {
    const files = valid('sorting/basic');
    for (const path of Object.keys(files)) {
      if (/\/(main\.js|X\.tsx|X\.vue|x\.component\.ts)$/.test(path)) {
        files[path] = "import '../../styles.css';";
      }
    }
    files['src/examples/sorting/styles.css'] = '.x {}';
    files['src/examples/sorting/basic/vue/X.vue'] = '';
    expect(checkExamples(site(files))).toEqual([
      "src/examples/sorting/basic/vue: doesn't load ../../styles.css",
    ]);
  });

  test('names an example no e2e spec opens', () => {
    const files = valid('sorting/basic');
    files['e2e/x.spec.ts'] = '';
    expect(checkExamples(site(files))).toEqual([
      'src/examples/sorting/basic: no e2e spec opens it',
    ]);
  });
});
