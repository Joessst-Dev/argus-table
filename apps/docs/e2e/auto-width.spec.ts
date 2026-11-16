import { expect, test, type Locator } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour, truncated } from './flavours';

const headerWidth = (table: Locator, id: string) =>
  table
    .locator(`[role="columnheader"][data-col="${id}"]`)
    .evaluate((el) => (el as HTMLElement).offsetWidth);

for (const flavour of FLAVOURS) {
  test(`${flavour}: auto width fits its columns to their content`, async ({ page }) => {
    await page.goto('features/auto-width/');
    const example = await openFlavour(page, 'auto-width/auto-columns', flavour);
    const table = example.locator('argus-table');
    await expect.poll(() => truncated(table, 'sku')).toBe(0);
    await expect.poll(() => truncated(table, 'category')).toBe(0);
    // Narrower than the 150 px default: fitted, not just wide enough.
    expect(await headerWidth(table, 'sku')).toBeLessThan(150);
    // The longest product name is wider than maxWidth: Product stops at 360 px.
    expect(await headerWidth(table, 'name')).toBe(360);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: fit to content fits a column, or all of them`, async ({ page }) => {
    await page.goto('features/auto-width/');
    const example = await openFlavour(page, 'auto-width/fit-to-content', flavour);
    const table = example.locator('argus-table');
    const resizes = example.locator('output');
    await expect.poll(() => truncated(table, 'price')).toBeGreaterThan(0);
    await expect.poll(() => truncated(table, 'category')).toBeGreaterThan(0);
    await expect(resizes).toHaveText('0');

    await table.locator('[data-resize-col="price"]').dblclick();
    await expect.poll(() => truncated(table, 'price')).toBe(0);
    await expect(resizes).toHaveText('1');

    await example.getByRole('button', { name: 'Fit all columns' }).click();
    await expect.poll(() => truncated(table, 'category')).toBe(0);
    await expect.poll(() => truncated(table, 'name')).toBe(0);
    // One event per column that changed: SKU, Product and Category.
    await expect(resizes).toHaveText('4');
    await expectAccessible(page, example);
  });
}
