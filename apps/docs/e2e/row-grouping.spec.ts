import { expect, test } from '@playwright/test';
import { cellText, expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: row grouping shows groups with totals, opens them and nests them`, async ({
    page,
  }) => {
    await page.goto('features/row-grouping/');
    const example = await openFlavour(page, 'row-grouping/sales', flavour);
    const table = example.locator('argus-table');
    // Three regions, closed, in order of their values; the amounts summed (row 1 is the header).
    await expect.poll(() => cellText(table, 2, 'customer')).toBe('Americas');
    expect(await cellText(table, 2, 'amount')).toBe('€56,100.00');
    expect(await cellText(table, 4, 'customer')).toBe('Europe');
    await expect(table.locator('[part~="row-group"]')).toHaveCount(3);
    // Open Europe: its five sales follow it.
    await table.locator('[part~="row-group"]').nth(2).locator('[part~="tree-toggle"]').click();
    await expect.poll(() => cellText(table, 5, 'customer')).toBe('Aurora Labs');
    await expect(table.locator('[part~="row-group"] [part~="group-count"]').nth(2)).toHaveText(
      '(5)',
    );
    // By status within each region: Europe's rows are now its statuses.
    await example.getByLabel('Group by status within each region').check();
    await expect.poll(() => cellText(table, 5, 'customer')).toBe('Lost');
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: a server groups the rows, and an open group loads its groups`, async ({
    page,
  }) => {
    await page.goto('features/row-grouping/');
    const example = await openFlavour(page, 'row-grouping/server', flavour);
    const table = example.locator('argus-table');
    await expect.poll(() => cellText(table, 2, 'customer')).toBe('Africa');
    await expect(table.locator('[part~="row-group"] [part~="group-count"]').first()).toHaveText(
      '(400)',
    );
    await table.locator('[part~="row-group"]').first().locator('[part~="tree-toggle"]').click();
    await expect.poll(() => cellText(table, 3, 'customer')).toBe('Lost');
    await expectAccessible(page, example);
  });
}
