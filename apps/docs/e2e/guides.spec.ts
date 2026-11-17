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
