import { expect, test, type Page } from '@playwright/test';
import { open, settle } from './helpers.js';

/**
 * The outer table's body row at an `aria-rowindex`: a data row or a panel. The
 * first match: the outer table's shadow root comes before the tables nested in its
 * panels, which have rows of their own.
 */
const rowAt = (page: Page, ariaRowIndex: number) =>
  page
    .locator(`body > argus-table [part~="body"] > [aria-rowindex="${String(ariaRowIndex)}"]`)
    .first();

const expanded = (page: Page) =>
  page.evaluate(() => document.querySelector('argus-table')?.expanded ?? []);

/** Scrolls the table's body to a data row through the API, and waits. */
async function scrollToRow(page: Page, index: number) {
  await page.evaluate((i) => document.querySelector('argus-table')?.scrollToRow(i), index);
  await settle(page);
}

test.describe('detail rows', () => {
  test('a chevron and the keyboard open panels; a form keeps what was typed', async ({ page }) => {
    await open(page, { rows: 1000, cols: 8, detail: 0 });
    const notes = page.locator('body > argus-table input[name="note"]');
    await rowAt(page, 3).locator('[part~="expand-toggle"]').click();
    await settle(page);
    expect(await expanded(page)).toEqual(['r1']);
    await expect(notes).toHaveCount(1);
    // Row 1 is at aria-rowindex 3 and its panel at 4, so row 3 is at 6: Enter on its
    // chevron cell opens its panel.
    await rowAt(page, 6).locator('[part~="cell-expand"]').focus();
    await page.keyboard.press('Enter');
    await settle(page);
    expect([...(await expanded(page))].sort()).toEqual(['r1', 'r3']);
    // Down onto the panel, Enter into its form, type, Escape out.
    // Focus moves after the update: each key waits for it.
    await page.keyboard.press('ArrowDown');
    await expect(rowAt(page, 7).locator('[part~="detail"]')).toBeFocused();
    await page.keyboard.press('Enter');
    const typed = page.locator('body > argus-table input[name="note"]:focus');
    await expect(typed).toHaveCount(1);
    await page.keyboard.type('fragile');
    await expect(typed).toHaveValue('fragile');
    await page.keyboard.press('Escape');
    await settle(page);
    await expect(rowAt(page, 7).locator('[part~="detail"]')).toBeFocused();
    // Away and back: the form still holds it.
    await scrollToRow(page, 600);
    await scrollToRow(page, 0);
    const values = await notes.evaluateAll((inputs) =>
      inputs.map((i) => (i as HTMLInputElement).value),
    );
    expect(values).toContain('fragile');
  });

  test('a panel follows its row when the rows are sorted', async ({ page }) => {
    await open(page, { rows: 200, cols: 8, detail: 0 });
    await page.evaluate(() => {
      const table = document.querySelector('argus-table');
      if (table) table.expanded = ['r5'];
    });
    await settle(page);
    await page.evaluate(() => {
      const table = document.querySelector('argus-table');
      if (table) table.sorting = [{ id: 'amount', desc: true }];
    });
    await settle(page);
    // Wherever row r5 is now, its panel comes right after it (r5 is the only row expanded).
    await page.evaluate(() => document.querySelector('argus-table')?.scrollToRow({ id: 'r5' }));
    await settle(page);
    const panel = page.locator('body > argus-table [part~="row-detail"]');
    await expect(panel).toHaveCount(1);
    const rowIndex = Number(await panel.getAttribute('aria-rowindex'));
    const owner = rowAt(page, rowIndex - 1);
    await expect(owner).toHaveAttribute('part', /row-expanded/);
  });

  test('reaches the last of 1M rows with panels open', async ({ page }) => {
    await open(page, { rows: 1_000_000, detail: 1000 });
    const found = await page.evaluate(
      () => document.querySelector('argus-table')?.scrollToRow(999_999) ?? false,
    );
    expect(found).toBe(true);
    await settle(page);
    // 1,000 panels are above it: rows 0, 1000, …, 999000.
    await expect(rowAt(page, 999_999 + 1000 + 2)).toBeVisible();
  });

  test('panels start at the inline start in RTL', async ({ page }) => {
    await open(page, { rows: 200, cols: 30, dir: 'rtl', detail: 50 });
    const panel = page
      .locator('body > argus-table [part~="row-detail"] > [part~="detail"]')
      .first();
    await expect(panel).toBeVisible();
    const [box, scroller] = await Promise.all([
      panel.boundingBox(),
      page
        .locator('body > argus-table [part~="table"]')
        .first()
        .evaluate((s) => {
          const r = s.getBoundingClientRect();
          return { left: r.left + s.clientLeft, width: s.clientWidth };
        }),
    ]);
    expect(Math.abs((box?.width ?? 0) - scroller.width)).toBeLessThan(2);
    expect(Math.abs((box?.x ?? 0) - scroller.left)).toBeLessThan(2);
  });
});
