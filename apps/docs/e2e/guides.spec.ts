import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectPageAccessible } from './pages';

/** The written guides' ids and titles. */
const GUIDES = {
  state: 'Controlled and uncontrolled state',
  'server-data': 'Server data',
  styling: 'Styling and themes',
  tailwind: 'Tailwind',
  plugins: 'Plugins',
  accessibility: 'Accessibility',
};
/** The package guides (src/lib/packages.ts). */
const PACKAGES = ['header-menu', 'formulas', 'export', 'editing', 'react', 'vue', 'angular'];

for (const [id, title] of Object.entries(GUIDES)) {
  test(`${id}: renders with its title`, async ({ page }) => {
    await page.goto(`guides/${id}/`);
    await expect(page.locator('h1')).toHaveText(title);
    await expectPageAccessible(page);
  });
}

test('every site link on the guide pages lands', async ({ page }) => {
  // Anchors by page: going to another anchor on the same page isn't a load.
  const targets = new Map<string, Set<string>>();
  const pages = ['getting-started', ...Object.keys(GUIDES), ...PACKAGES].map((id) =>
    id === 'getting-started' ? 'getting-started/' : `guides/${id}/`,
  );
  for (const path of pages) {
    await page.goto(path);
    const hrefs = await page
      .locator('.sl-markdown-content a[href^="/argus-table/"]')
      .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
    for (const href of hrefs) {
      const url = new URL(href);
      const hashes = targets.get(url.pathname) ?? new Set<string>();
      if (url.hash) hashes.add(decodeURIComponent(url.hash.slice(1)));
      targets.set(url.pathname, hashes);
    }
  }
  expect(targets.size).toBeGreaterThan(10);
  for (const [path, hashes] of targets) {
    const response = await page.goto(path);
    // 304 when the engine has it cached (Firefox).
    expect(response?.status() ?? 404, path).toBeLessThan(400);
    for (const hash of hashes) {
      await expect(page.locator(`[id="${hash}"]`), `${path}#${hash}`).toHaveCount(1);
    }
  }
});

test('the sidebar lists every guide', async ({ page }) => {
  await page.goto('guides/state/');
  const guides = page.locator('nav[aria-label="Main"] details', {
    has: page.locator('summary', { hasText: /^\s*Guides\s*$/ }),
  });
  await expect(guides.locator('a[href*="/guides/"]')).toHaveCount(
    Object.keys(GUIDES).length + 1 + PACKAGES.length,
  );
});

test('a table wider than a phone gets a tab stop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // The themes overview's table is wider than a phone.
  await page.goto('themes/');
  const table = page.locator('.sl-markdown-content table');
  await expect(table).toHaveAttribute('tabindex', '0');
  await expectPageAccessible(page);
  // Wide again: it fits, and leaves the tab order.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(table).not.toHaveAttribute('tabindex');
});

const benchmarks = JSON.parse(
  readFileSync(new URL('../../../benchmarks/published/latest.json', import.meta.url), 'utf8'),
) as { meta: { version: string; rows: number[] } };
const sizeLabel = (rows: number) =>
  rows >= 1e6 && rows % 1e6 === 0
    ? `${String(rows / 1e6)}M`
    : rows >= 1e3 && rows % 1e3 === 0
      ? `${String(rows / 1e3)}k`
      : String(rows);

test('performance shows the published benchmarks', async ({ page }) => {
  await page.goto('guides/performance/');
  await expect(page.locator('h1')).toHaveText('Performance');
  await expect(page.locator('main')).toContainText(`argus-table ${benchmarks.meta.version}`);
  const tables = page.locator('table.benchmarks');
  await expect(tables).toHaveCount(benchmarks.meta.rows.length);
  for (const [i, rows] of benchmarks.meta.rows.entries()) {
    await expect(tables.nth(i).locator('caption')).toContainText(`${sizeLabel(rows)} rows`);
    await expect(tables.nth(i).locator('tbody tr')).not.toHaveCount(0);
  }
  await expectPageAccessible(page);
});

test('the benchmark tables scroll inside themselves on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('guides/performance/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole('region', { name: /^Benchmarks, / }).first()).toHaveAttribute(
    'tabindex',
    '0',
  );
  await expectPageAccessible(page);
});
