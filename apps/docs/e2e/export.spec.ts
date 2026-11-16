import { expect, test } from '@playwright/test';
import { bodyRows, downloadedText, expectAccessible, FLAVOURS, openFlavour } from './flavours';

const lines = (csv: string) => csv.trim().split('\r\n');

for (const flavour of FLAVOURS) {
  test(`${flavour}: CSV of what the table shows, or of the selected rows`, async ({ page }) => {
    await page.goto('features/export/');
    const example = await openFlavour(page, 'export/basic', flavour);
    const table = example.locator('argus-table');
    const csv = example.getByRole('button', { name: 'CSV' });
    await example.getByRole('searchbox', { name: 'Search' }).fill('Oslo');
    await expect
      .poll(async () => {
        const rows = await bodyRows(table);
        return rows.length > 0 && rows.every((r) => r.city === 'Oslo');
      })
      .toBe(true);
    const shown = lines(await downloadedText(page, csv));
    // The group row, the header row, then every Oslo order.
    expect(shown.slice(0, 2)).toEqual([',,Delivery,,', 'Order,Customer,City,Status,Total']);
    expect(shown).toHaveLength(2 + 200);
    expect(shown.slice(2).every((line) => line.includes(',Oslo,'))).toBe(true);

    // A group row and the column headers come first: body rows start at aria-rowindex 3.
    const box = (row: number) =>
      table.locator(
        `[part~="body"] > [aria-rowindex="${String(row + 3)}"] > [data-col="--argus-selection"] input`,
      );
    await box(0).click();
    await box(1).click();
    await example.getByRole('checkbox', { name: 'Selected rows only' }).check();
    const selected = lines(await downloadedText(page, csv));
    expect(selected.slice(2).map((line) => line.split(',')[0])).toEqual(['o2', 'o7']);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: meta.export renames, converts and leaves out columns`, async ({ page }) => {
    await page.goto('features/export/');
    const example = await openFlavour(page, 'export/column-meta', flavour);
    const exported = lines(
      await downloadedText(page, example.getByRole('button', { name: 'Download CSV' })),
    );
    expect(exported[0]).toBe('Order,Customer,City,Total (EUR)');
    expect(exported[1]).toMatch(/^o\d+,Customer \d+,\w+,\d+$/);
    await expectAccessible(page, example);
  });
}
