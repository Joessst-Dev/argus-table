import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/** Each theme's `--argus-bg` in light and dark (packages/themes/src). */
const BACKGROUNDS = {
  material: ['rgb(254, 247, 255)', 'rgb(20, 18, 24)'],
  fluent: ['rgb(255, 255, 255)', 'rgb(41, 41, 41)'],
  bootstrap: ['rgb(255, 255, 255)', 'rgb(33, 37, 41)'],
  minimal: ['rgb(255, 255, 255)', 'rgb(15, 16, 18)'],
} as const;

/** The table of the page's `index`-th preview (through its shadow root). */
const previewTable = (page: Page, index: number): Locator =>
  page.locator('argus-theme-preview').nth(index).locator('argus-table');

const background = (table: Locator) => table.evaluate((el) => getComputedStyle(el).backgroundColor);

async function siteScheme(page: Page, scheme: 'light' | 'dark') {
  await page.locator('starlight-theme-select select').first().selectOption(scheme);
}

/** Waits for the preview's first body row. */
async function rendered(table: Locator) {
  await table.locator('[role="row"][aria-rowindex="2"]').waitFor();
}

for (const [theme, [light, dark]] of Object.entries(BACKGROUNDS)) {
  test(`${theme}: the preview follows the site, forced variants stay`, async ({ page }) => {
    await page.goto(`themes/${theme}/`);
    const main = previewTable(page, 0);
    const forcedDark = previewTable(page, 1);
    await rendered(main);
    await siteScheme(page, 'light');
    await expect.poll(() => background(main)).toBe(light);
    await expect.poll(() => background(forcedDark)).toBe(dark);
    await siteScheme(page, 'dark');
    await expect.poll(() => background(main)).toBe(dark);
    await expect.poll(() => background(forcedDark)).toBe(dark);
    await expectAccessible(page);
  });
}

test('default: follows the site, and its forced light stays', async ({ page }) => {
  await page.goto('themes/default/');
  const main = previewTable(page, 0);
  const forcedLight = previewTable(page, 2);
  await rendered(main);
  await siteScheme(page, 'light');
  const light = await background(forcedLight);
  await expect.poll(() => background(main)).toBe(light);
  await siteScheme(page, 'dark');
  await expect.poll(() => background(main)).not.toBe(light);
  await expect.poll(() => background(forcedLight)).toBe(light);
  await expectAccessible(page);
});

test('variants: compact rows are shorter, selection has checkboxes', async ({ page }) => {
  await page.goto('themes/material/');
  const main = previewTable(page, 0);
  const compact = previewTable(page, 2);
  const selection = previewTable(page, 3);
  await rendered(main);
  await rendered(compact);
  const height = (table: Locator) =>
    table
      .locator('[role="row"][aria-rowindex="2"]')
      .evaluate((row) => row.getBoundingClientRect().height);
  expect(await height(compact)).toBeLessThan(await height(main));
  await expect(selection.locator('[role="columnheader"] input[type="checkbox"]')).toHaveCount(1);
});

for (const [theme, family] of [
  ['material', 'Roboto'],
  ['minimal', 'Instrument Sans'],
] as const) {
  test(`${theme} loads its font`, async ({ page }) => {
    await page.goto(`themes/${theme}/`);
    const main = previewTable(page, 0);
    await rendered(main);
    const font = await main.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font.replaceAll('"', '').startsWith(family)).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(async (name) => {
          await document.fonts.ready;
          return document.fonts.check(`400 14px "${name}"`);
        }, family),
      )
      .toBe(true);
  });
}

test('the overview links every theme page and the creator', async ({ page }) => {
  await page.goto('themes/');
  const content = page.locator('.sl-markdown-content');
  for (const path of ['default', 'material', 'fluent', 'bootstrap', 'minimal', 'creator']) {
    await expect(content.locator(`a[href="/argus-table/themes/${path}/"]`).first()).toBeAttached();
  }
  await expectAccessible(page);
});
