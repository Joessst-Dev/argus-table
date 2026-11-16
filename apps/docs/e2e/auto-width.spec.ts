import { expect, test } from '@playwright/test';
import { expectAccessible, FLAVOURS, openFlavour, truncated } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: auto width fits its columns to their content`, async ({ page }) => {
    await page.goto('features/auto-width/');
    const example = await openFlavour(page, 'auto-width/auto-columns', flavour);
    const table = example.locator('argus-table');
    await expect.poll(() => truncated(table, 'sku')).toBe(0);
    await expect.poll(() => truncated(table, 'category')).toBe(0);
    const product = table.locator('[role="columnheader"][data-col="name"]');
    expect(await product.evaluate((el) => (el as HTMLElement).offsetWidth)).toBeLessThanOrEqual(
      360,
    );
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: fit to content fits a column, or all of them`, async ({ page }) => {
    await page.goto('features/auto-width/');
    const example = await openFlavour(page, 'auto-width/fit-to-content', flavour);
    const table = example.locator('argus-table');
    await expect.poll(() => truncated(table, 'price')).toBeGreaterThan(0);
    await table.locator('[data-resize-col="price"]').dblclick();
    await expect.poll(() => truncated(table, 'price')).toBe(0);
    await example.getByRole('button', { name: 'Fit all columns' }).click();
    await expect.poll(() => truncated(table, 'category')).toBe(0);
    await expect(example.locator('output')).not.toHaveText('0');
    await expectAccessible(page, example);
  });
}
