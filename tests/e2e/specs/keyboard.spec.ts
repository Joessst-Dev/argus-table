import { expect, test } from '@playwright/test';
import { focused, open, scrollTo, settle } from './helpers.js';

test.describe('keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, { rows: 100_000, cols: 8 });
  });

  test('Tab enters on the first header; arrows, Home and End move by cell', async ({ page }) => {
    await page.keyboard.press('Tab');
    expect(await focused(page)).toEqual({ role: 'columnheader', col: 'index', rowIndex: 1 });

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await settle(page);
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'name', rowIndex: 2 });

    await page.keyboard.press('End');
    await settle(page);
    expect((await focused(page))?.col).toBe('actions');
    await page.keyboard.press('Home');
    await settle(page);
    expect((await focused(page))?.col).toBe('index');

    await page.keyboard.press('ArrowUp');
    await settle(page);
    expect(await focused(page)).toEqual({ role: 'columnheader', col: 'index', rowIndex: 1 });
  });

  test('focus survives scrolling the focused row out of the window', async ({ page }) => {
    await page.keyboard.press('Tab');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
    await settle(page);
    expect((await focused(page))?.rowIndex).toBe(6);

    // 50,000 rows away: the focused row is far outside the rendered window.
    await scrollTo(page, 50_000 * 40);
    expect((await focused(page))?.rowIndex).toBe(6);

    await page.keyboard.press('ArrowDown');
    await settle(page);
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: 7 });
    const inView = await page.evaluate(() => {
      const root = document.querySelector('argus-table')?.shadowRoot;
      const cell = root?.activeElement?.getBoundingClientRect();
      const box = root?.querySelector('[part~="table"]')?.getBoundingClientRect();
      return !!cell && !!box && cell.top >= box.top && cell.bottom <= box.bottom;
    });
    expect(inView).toBe(true);
  });
});
