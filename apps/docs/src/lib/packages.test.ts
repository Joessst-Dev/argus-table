import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';
import { PACKAGE_GUIDES, packageGuides } from './packages';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));

const fixtures = mkdtempSync(join(tmpdir(), 'docs-packages-'));
afterAll(() => {
  rmSync(fixtures, { recursive: true, force: true });
});

/** A repo root with a titled README for every package guide, but `except`, plus `files`. */
function fixture(name: string, files: Record<string, string>, except?: string): string {
  const root = join(fixtures, name);
  for (const { id } of PACKAGE_GUIDES) {
    if (id === except) continue;
    mkdirSync(join(root, 'packages', id), { recursive: true });
    writeFileSync(join(root, 'packages', id, 'README.md'), `# @argus-table/${id}\n`);
  }
  for (const [path, text] of Object.entries(files)) writeFileSync(join(root, path), text);
  return root;
}

describe('packageGuides', () => {
  test('lists the seven package guides with their README', () => {
    const guides = packageGuides(repo);
    expect(guides.map((g) => g.id)).toEqual([
      'header-menu',
      'formulas',
      'export',
      'editing',
      'react',
      'vue',
      'angular',
    ]);
    expect(guides.find((g) => g.id === 'export')).toEqual({
      id: 'export',
      title: 'Export add-on',
      label: 'Export',
      group: 'Add-ons',
      file: 'packages/export/README.md',
      path: 'guides/export/',
    });
    expect(guides.find((g) => g.id === 'vue')?.group).toBe('Frameworks');
  });

  test('a README without a "# " first line fails, naming it', () => {
    const root = fixture('untitled', { 'packages/export/README.md': 'No title.\n' });
    expect(() => packageGuides(root)).toThrow(/packages\/export\/README\.md/);
  });

  test('a missing README fails, naming it', () => {
    const root = fixture('missing', {}, 'vue');
    expect(() => packageGuides(root)).toThrow(/packages\/vue\/README\.md/);
  });
});
