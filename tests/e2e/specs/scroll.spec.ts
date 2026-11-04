import { expect, test } from '@playwright/test';
import { open, scrollTo, visibleRows } from './helpers.js';

test.describe('scrolling 100,000 rows', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, { rows: 100_000, cols: 8 });
  });

  test('jumps to the end and shows the last rows', async ({ page }) => {
    await scrollTo(page, -1);
    const rows = await visibleRows(page);
    const last = rows.at(-1);
    // The header is row 1, so the last of 100,000 body rows is 100,001.
    expect(last?.rowIndex).toBe(100_001);
    expect(last?.cells.index).toBe('99999');
  });

  test('keeps the DOM bounded and the content in step with the row index', async ({ page }) => {
    for (const top of [400, 120_000, 2_000_000, 3_999_000]) {
      await scrollTo(page, top);
      const rows = await visibleRows(page);
      expect(rows.length).toBeGreaterThan(5);
      for (const { rowIndex, cells } of rows) expect(cells.index).toBe(String(rowIndex - 2));
    }
    const rendered = await page.locator('argus-table [part~="body"] > [part~="row"]').count();
    expect(rendered).toBeLessThan(60);
  });

  test('scrolls with the mouse wheel', async ({ page }) => {
    await page.locator('argus-table [part~="body"]').hover();
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 400);
    await expect.poll(async () => (await visibleRows(page))[0]?.rowIndex ?? 0).toBeGreaterThan(50);
    const rows = await visibleRows(page);
    for (const { rowIndex, cells } of rows) expect(cells.index).toBe(String(rowIndex - 2));
  });
});
