import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/** Each page's id and title (the file's first line, without `# ` and backticks). */
const GUIDES = {
  'ag-grid': 'From AG Grid',
  'angular-material': 'From Angular Material mat-table',
  antd: 'From Ant Design Table',
  'element-plus': 'From Element Plus el-table',
  'html-table': 'From a plain <table>',
  'mui-x': 'From MUI X Data Grid',
  'primeng-primevue': 'From PrimeNG and PrimeVue DataTable',
  tanstack: 'From TanStack Table',
  vuetify: 'From Vuetify v-data-table',
  gaps: 'Gaps',
};

const REFERENCES =
  'https://github.com/Joessst-Dev/argus-table/blob/main/skills/argus-table-integrate/references/';

for (const [id, title] of Object.entries(GUIDES)) {
  test(`${id}: its title and the skill note`, async ({ page }) => {
    await page.goto(`migration/${id}/`);
    await expect(page.locator('h1')).toHaveText(title);
    // The file's own `# ` title is dropped: the page's is the only one.
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main')).toContainText('argus-table-integrate');
    await expectAccessible(page);
  });
}

test('a guide keeps its tables and code', async ({ page }) => {
  await page.goto('migration/tanstack/');
  const concepts = page.locator('main table', { has: page.locator('th', { hasText: 'Fit' }) });
  await expect(concepts).toBeVisible();
  // It scrolls sideways on narrow screens: keyboard users can reach it.
  await expect(concepts).toHaveAttribute('tabindex', '0');
  const code = page.locator('main .expressive-code', { hasText: 'useReactTable' }).first();
  await expect(code).toBeVisible();
  // Long lines wrap: the block doesn't scroll sideways.
  await expect(code.locator('pre')).toHaveClass(/\bwrap\b/);
});

test('every link into the section lands on an element', async ({ page }) => {
  // Anchors by page: going to another anchor on the same page isn't a load.
  const targets = new Map<string, Set<string>>();
  for (const id of Object.keys(GUIDES)) {
    await page.goto(`migration/${id}/`);
    const hrefs = await page
      .locator('.sl-markdown-content a[href*="/migration/"]')
      .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
    for (const href of hrefs) {
      const url = new URL(href);
      const hashes = targets.get(url.pathname) ?? new Set<string>();
      if (url.hash) hashes.add(url.hash.slice(1));
      targets.set(url.pathname, hashes);
    }
  }
  expect([...targets.values()].reduce((n, hashes) => n + hashes.size, 0)).toBeGreaterThan(5);
  for (const [path, hashes] of targets) {
    const response = await page.goto(path);
    // 304 when the engine has it cached (Firefox).
    expect(response?.status() ?? 404, path).toBeLessThan(400);
    for (const hash of hashes) {
      await expect(page.locator(`[id="${hash}"]`), `${path}#${hash}`).toHaveCount(1);
    }
  }
});

test('links to other references go to GitHub', async ({ page }) => {
  await page.goto('migration/tanstack/');
  await expect(page.locator(`main a[href="${REFERENCES}server-data.md"]`).first()).toBeAttached();
  await expect(
    page.locator(`main a[href="${REFERENCES}addons.md#cell-editing-argus-tableediting"]`).first(),
  ).toBeAttached();
  // Written without ../ in gaps.md.
  await page.goto('migration/gaps/');
  await expect(page.locator(`main a[href="${REFERENCES}server-data.md"]`).first()).toBeAttached();
  for (const id of Object.keys(GUIDES)) {
    await page.goto(`migration/${id}/`);
    const local = await page
      .locator('main a[href*=".md"]')
      .evaluateAll((links) =>
        links
          .map((a) => a.getAttribute('href') ?? '')
          .filter((href) => !href.startsWith('https://github.com/')),
      );
    expect(local, id).toEqual([]);
  }
});

test('the overview explains fit and lists every guide', async ({ page }) => {
  await page.goto('migration/');
  const main = page.locator('.sl-markdown-content');
  for (const fit of ['maps', 'partial', 'builtin', 'gap']) {
    await expect(main.locator('dt', { hasText: new RegExp(`^${fit}$`) })).toBeVisible();
  }
  for (const id of Object.keys(GUIDES)) {
    await expect(main.locator(`a[href$="/migration/${id}/"]`)).toHaveCount(1);
  }
  const sidebar = page.locator('nav[aria-label="Main"] details', { hasText: 'Migration' });
  await expect(sidebar.locator('a[href*="/migration/"]')).toHaveCount(11);
  await expectAccessible(page);
});

test('a guide fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('migration/tanstack/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expectAccessible(page);
});
