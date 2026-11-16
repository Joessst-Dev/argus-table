import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test('the element page lists bindings in every wrapper', async ({ page }) => {
  await page.goto('api/argus-table/');
  const sizing = page.locator('#property-columnsizing');
  await expect(sizing).toContainText('v-model:column-sizing');
  await expect(sizing).toContainText('[(columnSizing)]');
  await expect(sizing.locator('a[href$="/api/types/#columnsizingstate"]')).toHaveText(
    'ColumnSizingState',
  );
  const sorting = page.locator('#event-argus-sorting-change');
  await expect(sorting).toContainText('onSortingChange');
  await expect(sorting).toContainText('@sorting-change');
  await expect(sorting).toContainText('(sortingChange)');
  await expect(page.locator('#event-argus-cell-edit')).toContainText('@argus-table/editing');
  await expect(page.locator('#method-scrolltorow')).toContainText('Promise<boolean>');
  await expect(page.locator('#token---argus-fg')).toContainText('CanvasText');
  await expect(page.locator('#part-row-selected')).toBeVisible();
  await expectAccessible(page);
});

test('the other elements have pages', async ({ page }) => {
  await page.goto('api/argus-column/');
  await expect(page.locator('#property-columnid')).toContainText('column-id');
  await page.goto('api/argus-column-group/');
  await expect(page.locator('#property-groupid')).toContainText('group-id');
});

test('the types page documents ColumnDef', async ({ page }) => {
  await page.goto('api/types/');
  const columnDef = page.locator('#columndef');
  await expect(columnDef).toBeVisible();
  await expect(page.locator('#columndef-accessor')).toBeVisible();
  await expect(page.locator('#sortdirection')).toBeVisible();
  await expectAccessible(page);
});

test('the overview says it documents main and links the changelogs', async ({ page }) => {
  await page.goto('api/');
  await expect(page.locator('main')).toContainText('main');
  await expect(page.locator('main a[href$="CHANGELOG.md"]')).toHaveCount(9);
  await expectAccessible(page);
});

test('long types wrap on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('api/argus-table/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
