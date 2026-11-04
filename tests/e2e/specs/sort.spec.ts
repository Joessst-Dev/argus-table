import { expect, test } from '@playwright/test';
import { open, settle, visibleRows } from './helpers.js';

const amounts = async (page: Parameters<typeof visibleRows>[0]) =>
  (await visibleRows(page)).map((r) => Number(r.cells.amount));

test.describe('sorting', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, { rows: 2000, cols: 8 });
  });

  test('a header click cycles ascending, descending and unsorted', async ({ page }) => {
    const header = page.locator('argus-table [role="columnheader"][data-col="amount"]');
    const unsorted = await amounts(page);

    await header.click();
    await settle(page);
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    const asc = await amounts(page);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));

    await header.click();
    await settle(page);
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    const desc = await amounts(page);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));

    await header.click();
    await settle(page);
    await expect(header).not.toHaveAttribute('aria-sort');
    expect(await amounts(page)).toEqual(unsorted);
  });

  test('Enter on the focused header sorts', async ({ page }) => {
    const header = page.locator('argus-table [role="columnheader"][data-col="amount"]');
    await header.focus();
    await page.keyboard.press('Enter');
    await settle(page);
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
  });
});
