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

const example = (id: string): Record<string, string> => ({
  [`src/examples/${id}/html/index.html`]: '',
  [`src/examples/${id}/html/main.js`]: '',
  [`src/examples/${id}/react/Sorting.tsx`]: '',
  [`src/examples/${id}/vue/Sorting.vue`]: '',
  [`src/examples/${id}/angular/sorting.component.ts`]: '',
});
const page = (...ids: string[]) =>
  ids.map((id) => `<FlavourTabs example="${id}">\n</FlavourTabs>`).join('\n');

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('checkExamples', () => {
  test('a complete example used on a page is fine', () => {
    const root = site({
      ...example('sorting/basic'),
      'src/examples/sorting/data.ts': '',
      'src/content/docs/features/sorting.mdx': page('sorting/basic'),
    });
    expect(checkExamples(root)).toEqual([]);
  });

  test('names a missing flavour', () => {
    const files = example('sorting/basic');
    delete files['src/examples/sorting/basic/vue/Sorting.vue'];
    const root = site({ ...files, 'src/content/docs/features/sorting.mdx': page('sorting/basic') });
    expect(checkExamples(root)).toEqual(['src/examples/sorting/basic: missing the vue flavour']);
  });

  test('names a flavour with two components', () => {
    const root = site({
      ...example('sorting/basic'),
      'src/examples/sorting/basic/react/Other.tsx': '',
      'src/content/docs/features/sorting.mdx': page('sorting/basic'),
    });
    expect(checkExamples(root)).toEqual([
      'src/examples/sorting/basic/react: more than one component',
    ]);
  });

  test('names an example no feature page uses', () => {
    const root = site({
      ...example('sorting/basic'),
      ...example('sorting/extra'),
      'src/content/docs/features/sorting.mdx': page('sorting/basic'),
    });
    expect(checkExamples(root)).toEqual([
      'src/examples/sorting/extra: not used on any feature page',
    ]);
  });

  test('names a page example that does not exist', () => {
    const root = site({
      ...example('sorting/basic'),
      'src/content/docs/features/sorting.mdx': page('sorting/basic', 'sorting/gone'),
    });
    expect(checkExamples(root)).toEqual([
      'src/content/docs/features/sorting.mdx: example "sorting/gone" does not exist',
    ]);
  });
});
