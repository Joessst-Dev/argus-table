import { expect, test, type Page } from '@playwright/test';
import { focused, open, settle } from './helpers.js';

/** A body cell of the row at `index` (0-based, in the current order). */
const cell = (page: Page, index: number, col = 'name') =>
  page.locator(
    `argus-table [part~="body"] > [aria-rowindex="${String(index + 2)}"] > [data-col="${col}"]`,
  );

const selection = (page: Page) =>
  page.evaluate(() => document.querySelector('argus-table')?.selection ?? []);

/** `aria-rowindex` of the rendered rows marked selected, in order. */
const selectedRows = (page: Page) =>
  page.evaluate(() =>
    [
      ...(document
        .querySelector('argus-table')
        ?.shadowRoot?.querySelectorAll('[aria-selected="true"]') ?? []),
    ]
      .map((row) => Number(row.getAttribute('aria-rowindex')))
      .sort((a, b) => a - b),
  );

test.describe('row selection', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, { rows: 1000, cols: 8, selection: 'multi' });
  });

  test('click, Shift+click and Ctrl/Cmd+click select rows, without selecting text', async ({
    page,
  }) => {
    await cell(page, 1).click();
    await cell(page, 4).click({ modifiers: ['Shift'] });
    await cell(page, 7).click({ modifiers: ['ControlOrMeta'] });
    await settle(page);
    expect(await selectedRows(page)).toEqual([3, 4, 5, 6, 9]);
    expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('');

    await cell(page, 2).click();
    await settle(page);
    expect(await selectedRows(page)).toEqual([4]);
  });

  test('the selected row paints its pinned cells too', async ({ page }) => {
    await cell(page, 2).click();
    await settle(page);
    const backgrounds = await page.evaluate(() => {
      const row = document
        .querySelector('argus-table')
        ?.shadowRoot?.querySelector<HTMLElement>('[aria-selected="true"]');
      const pinned = row?.querySelector('[part~="cell-pinned"]');
      return {
        row: row ? getComputedStyle(row).backgroundColor : '',
        pinned: pinned ? getComputedStyle(pinned).backgroundColor : '',
      };
    });
    expect(backgrounds.pinned).toBe(backgrounds.row);
    // The playground's default page sets no token: the fallback still differs from Canvas.
    const unselected = await page.evaluate(() => {
      const row = document
        .querySelector('argus-table')
        ?.shadowRoot?.querySelector<HTMLElement>('[aria-selected="false"]');
      return row ? getComputedStyle(row).backgroundColor : '';
    });
    expect(backgrounds.row).not.toBe(unselected);
  });

  test('a button in a cell does not select its row', async ({ page }) => {
    // The button is light-DOM content, slotted into the cell by name.
    const slot = await cell(page, 3, 'actions').locator('slot').getAttribute('name');
    await page
      .locator(`argus-table > [slot="${String(slot)}"]`)
      .getByRole('button')
      .click();
    await settle(page);
    expect(await selection(page)).toEqual([]);
  });

  test('Space, Shift+Arrow and Ctrl/Cmd+A select from the keyboard', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await settle(page);
    expect(await selectedRows(page)).toEqual([3, 4, 5]);
    expect((await focused(page))?.rowIndex).toBe(5);

    await page.keyboard.press('ControlOrMeta+a');
    await settle(page);
    expect(await selection(page)).toHaveLength(1000);
    // Not the page's text.
    expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('');
  });
});
