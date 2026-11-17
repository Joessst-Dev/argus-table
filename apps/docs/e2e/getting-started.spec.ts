import { expect, test } from '@playwright/test';
import {
  bodyCell,
  cellText,
  expectAccessible,
  FLAVOURS,
  headerTexts,
  openFlavour,
} from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: the first table sorts, and a row click selects`, async ({ page }) => {
    await page.goto('getting-started/');
    const example = await openFlavour(page, 'getting-started/first-table', flavour);
    const table = example.locator('argus-table');
    const output = example.locator('output');
    await expect.poll(() => headerTexts(table)).toEqual(['Order', 'Customer', 'Total']);
    await expect(output).toHaveText('Click a row.');
    await table.locator('[role="columnheader"][data-col="customer"]').click();
    await expect.poll(() => cellText(table, 2, 'customer')).toBe('Customer 1');
    const order = await cellText(table, 2, 'id');
    await bodyCell(table, 0, 'customer').click();
    await expect(output).toHaveText(`Selected order ${order}`);
    await expectAccessible(page, example);
  });
}
