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

  test('Ctrl+Home/End jump to the corners; PageUp/PageDown move by a page', async ({ page }) => {
    const focusInView = () =>
      page.evaluate(() => {
        const root = document.querySelector('argus-table')?.shadowRoot;
        const cell = root?.activeElement?.getBoundingClientRect();
        const box = root?.querySelector('[part~="table"]')?.getBoundingClientRect();
        return !!cell && !!box && cell.top >= box.top - 0.5 && cell.bottom <= box.bottom + 0.5;
      });

    await page.keyboard.press('Tab');
    await page.keyboard.press('ControlOrMeta+End');
    await settle(page);
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'actions', rowIndex: 100_001 });
    expect(await focusInView()).toBe(true);

    await page.keyboard.press('ControlOrMeta+Home');
    await settle(page);
    expect(await focused(page)).toEqual({ role: 'columnheader', col: 'index', rowIndex: 1 });

    // Into the body, then a page at a time: the step is the rows that fit.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('PageDown');
    await settle(page);
    const first = (await focused(page))?.rowIndex ?? 0;
    expect(first).toBeGreaterThan(3);
    const step = first - 2;
    await page.keyboard.press('PageDown');
    await settle(page);
    expect((await focused(page))?.rowIndex).toBe(first + step);
    expect(await focusInView()).toBe(true);
    await page.keyboard.press('PageUp');
    await settle(page);
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: first });
    expect(await focusInView()).toBe(true);
  });

  test('the grid is one tab stop in both directions', async ({ page }) => {
    // Something to tab to on either side; without it, Firefox wraps Shift+Tab
    // around the page and lands back in the grid.
    await page.evaluate(() => {
      const table = document.querySelector('argus-table');
      const button = (id: string) =>
        Object.assign(document.createElement('button'), { id, textContent: id });
      table?.before(button('before'));
      table?.after(button('after'));
    });
    const activeId = () => page.evaluate(() => document.activeElement?.id ?? '');

    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    expect((await focused(page))?.role).toBe('columnheader');
    await page.keyboard.press('ArrowDown');
    await settle(page);

    // Forward: one stop in the grid, then out.
    await page.keyboard.press('Tab');
    expect(await activeId()).toBe('after');
    // Back in lands on the cell that was active.
    await page.keyboard.press('Shift+Tab');
    await settle(page);
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: 2 });
    // Backward: out of the grid with no stop on the scroll container.
    await page.keyboard.press('Shift+Tab');
    expect(await activeId()).toBe('before');
  });

  test('Enter on a body cell fires the click events', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { seen: string[] };
      w.seen = [];
      const table = document.querySelector('argus-table');
      table?.addEventListener('argus-cell-click', (e) => w.seen.push(`cell:${e.detail.columnId}`));
      table?.addEventListener('argus-row-click', (e) =>
        w.seen.push(`row:${String(e.detail.index)}`),
      );
    });
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await settle(page);
    await page.keyboard.press('Enter');
    const seen = await page.evaluate(() => (window as unknown as { seen: string[] }).seen);
    expect(seen).toEqual(['cell:name', 'row:1']);
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
