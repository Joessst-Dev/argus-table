import { expect, test } from '@playwright/test';
import { bodyRows, expectAccessible, FLAVOURS, openFlavour } from './flavours';

for (const flavour of FLAVOURS) {
  test(`${flavour}: the quick filter keeps rows with every word`, async ({ page }) => {
    await page.goto('features/filtering/');
    const example = await openFlavour(page, 'filtering/quick-filter', flavour);
    const table = example.locator('argus-table');
    const search = example.getByRole('searchbox', { name: 'Search orders' });
    await search.fill('oslo 777');
    await expect
      .poll(async () => {
        const rows = await bodyRows(table);
        return (
          rows.length > 0 &&
          rows.every((r) => r.city === 'Oslo' && Object.values(r).some((t) => t.includes('777')))
        );
      })
      .toBe(true);
    await search.fill('');
    await expect.poll(async () => new Set((await bodyRows(table)).map((r) => r.city)).size).toBe(5);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: column filters follow the form`, async ({ page }) => {
    await page.goto('features/filtering/');
    const example = await openFlavour(page, 'filtering/column-filters', flavour);
    const table = example.locator('argus-table');
    await expect
      .poll(async () => {
        const rows = await bodyRows(table);
        return rows.length > 0 && rows.every((r) => r.status === 'open' && Number(r.total) >= 500);
      })
      .toBe(true);
    await expect(table.locator('[role="columnheader"][data-col="status"]')).toHaveAttribute(
      'part',
      /\bheader-cell-filtered\b/,
    );
    await example.getByRole('combobox', { name: 'Status' }).selectOption('paid');
    await expect
      .poll(async () => {
        const rows = await bodyRows(table);
        return rows.length > 0 && rows.every((r) => r.status === 'paid');
      })
      .toBe(true);
    await example.getByRole('spinbutton', { name: 'Total at least' }).fill('900');
    await expect
      .poll(async () => {
        const rows = await bodyRows(table);
        return rows.length > 0 && rows.every((r) => Number(r.total) >= 900);
      })
      .toBe(true);
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: a data source gets the filters`, async ({ page }) => {
    await page.goto('features/filtering/');
    const example = await openFlavour(page, 'filtering/data-source', flavour);
    const table = example.locator('argus-table');
    await expect
      .poll(async () => {
        const rows = await bodyRows(table);
        return (
          rows.length > 0 && rows.every((r) => r.status === 'shipped' && r.customer?.includes('9'))
        );
      })
      .toBe(true);
    await expect(example.locator('output')).toContainText('"values":["shipped"]');
    await expect(example.locator('output')).toContainText('"customer 9"');
    await expectAccessible(page, example);
  });
}

for (const flavour of FLAVOURS) {
  test(`${flavour}: columnFilters applies to column children`, async ({ page }) => {
    await page.goto('features/filtering/');
    const example = await openFlavour(page, 'filtering/declarative', flavour);
    const table = example.locator('argus-table');
    await expect
      .poll(async () => {
        const rows = await bodyRows(table);
        return rows.length > 0 && rows.every((r) => r.city === 'Quito');
      })
      .toBe(true);
    await expectAccessible(page, example);
  });
}
