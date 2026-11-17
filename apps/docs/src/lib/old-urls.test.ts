import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test, vi } from 'vitest';
import { PACKAGE_GUIDES } from './packages';
import { oldUrlTarget, redirectScript, STORYBOOK_PAGES } from './old-urls';

const base = '/argus-table';
const site = fileURLToPath(new URL('../../', import.meta.url));
const stories = fileURLToPath(new URL('../../../storybook/stories/', import.meta.url));
const to = (href: string) => oldUrlTarget(href, base, STORYBOOK_PAGES);

/** Every file under `dir`. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Storybook's id for a title: lower case, other characters → `-`. */
const idOf = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Whether the site builds a page at `path` (no base, trailing slash). */
function isPage(path: string): boolean {
  const route = path.slice(0, -1);
  return (
    existsSync(join(site, 'src/content/docs', `${route}.mdx`)) ||
    existsSync(join(site, 'src/content/docs', route, 'index.mdx')) ||
    existsSync(join(site, 'src/pages', route, 'index.astro')) ||
    PACKAGE_GUIDES.some((g) => route === `guides/${g.id}`)
  );
}

describe('oldUrlTarget', () => {
  test('a theme-creator link keeps its hash', () => {
    expect(
      to(
        'https://x.io/argus-table/iframe.html?id=themes-theme-creator--creator&viewMode=story#theme=abc',
      ),
    ).toBe('/argus-table/themes/creator/#theme=abc');
  });

  test('manager URLs for docs and stories', () => {
    expect(to('https://x.io/argus-table/?path=/docs/features-sorting--docs')).toBe(
      '/argus-table/features/sorting/',
    );
    expect(
      to(
        'https://x.io/argus-table/?path=/story/themes-material-inspired--dark&globals=theme:material&args=scheme:dark',
      ),
    ).toBe('/argus-table/themes/material/');
    expect(to('https://x.io/argus-table/?path=/docs/benchmarks--docs')).toBe(
      '/argus-table/guides/performance/',
    );
    expect(to('https://x.io/argus-table/iframe.html?viewMode=docs&id=recipes-vue--docs')).toBe(
      '/argus-table/guides/vue/',
    );
  });

  test('an unknown page falls back to the home page', () => {
    expect(to('https://x.io/argus-table/?path=/story/features-gone--x')).toBe('/argus-table/');
    expect(to('https://x.io/argus-table/iframe.html?id=nope--x#theme=abc')).toBe(
      '/argus-table/#theme=abc',
    );
    // Not a page title Storybook has, even if it's a property of every object.
    expect(to('https://x.io/argus-table/?path=/docs/constructor--docs')).toBe('/argus-table/');
  });

  test("other URLs don't redirect", () => {
    for (const href of [
      'https://x.io/argus-table/',
      'https://x.io/argus-table/?q=sorting',
      'https://x.io/argus-table/features/sorting/',
      'https://x.io/argus-table/?path=/settings/about',
    ]) {
      expect(to(href), href).toBeUndefined();
    }
  });
});

test('every Storybook title maps to a page', () => {
  const titles = walk(stories)
    .filter((file) => /\.(ts|mdx)$/.test(file))
    .flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return [
        ...text.matchAll(/^\s*title: '([^']+)'/gm),
        ...text.matchAll(/<Meta title="([^"]+)"/g),
      ].map((m) => m[1] ?? '');
    });
  expect(titles.length).toBeGreaterThanOrEqual(40);
  for (const title of titles) {
    const page = STORYBOOK_PAGES[idOf(title)];
    expect(page, title).toBeDefined();
    expect(isPage(page ?? ''), `${title} → ${page ?? ''}`).toBe(true);
  }
  for (const page of Object.values(STORYBOOK_PAGES)) expect(isPage(page), page).toBe(true);
});

describe('redirectScript', () => {
  // The script as the browser runs it: its own text, with only `location`.
  const run = (href: string, orHome = false) => {
    const location = { href, replace: vi.fn() };
    // On purpose: the script is text the page runs inline.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const script = new Function('location', redirectScript(base, orHome)) as (location: {
      href: string;
      replace: (url: string) => void;
    }) => void;
    script(location);
    return location.replace;
  };

  test('sends an old URL on', () => {
    expect(
      run('https://x.io/argus-table/iframe.html?id=themes-theme-creator--creator#theme=abc'),
    ).toHaveBeenCalledWith('/argus-table/themes/creator/#theme=abc');
  });

  test('leaves the home page alone', () => {
    expect(run('https://x.io/argus-table/')).not.toHaveBeenCalled();
  });

  test('the iframe page sends anything else home', () => {
    expect(run('https://x.io/argus-table/iframe.html', true)).toHaveBeenCalledWith('/argus-table/');
    expect(run('https://x.io/argus-table/iframe.html?viewMode=story', true)).toHaveBeenCalledWith(
      '/argus-table/',
    );
  });
});
