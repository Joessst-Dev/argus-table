import { expect, test, type Page } from '@playwright/test';
import { focused, open, scrollTo, settle } from './helpers.js';

/** Boxes of the scroller's content area, the header row and the pinned rows. */
async function boxes(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    const scroller = root?.querySelector<HTMLElement>('[part~="table"]');
    if (!root || !scroller) throw new Error('table not rendered');
    const box = scroller.getBoundingClientRect();
    const rect = (selector: string) => {
      const r = root.querySelector(selector)?.getBoundingClientRect();
      return r && { top: r.top, bottom: r.bottom };
    };
    const cell = (selector: string, col: string) =>
      root.querySelector(`${selector} > [data-col="${col}"]`)?.getBoundingClientRect().left;
    return {
      contentTop: box.top + scroller.clientTop,
      contentBottom: box.top + scroller.clientTop + scroller.clientHeight,
      header: rect('[part~="header-row"]'),
      top: rect('[part~="row-pinned-top"]'),
      bottom: rect('[part~="row-pinned-bottom"]'),
      topPinnedCol: cell('[part~="row-pinned-top"]', 'index'),
      topScrollingCol: cell('[part~="row-pinned-top"]', 'email'),
    };
  });
}

test('pinned rows stay below the header and at the bottom while the body scrolls', async ({
  page,
}) => {
  await open(page, { rows: 5000, pinned: 'top,bottom' });
  const before = await boxes(page);
  expect(before.top?.top).toBeCloseTo(before.header?.bottom ?? -1, 0);
  expect(before.bottom?.bottom).toBeCloseTo(before.contentBottom, 0);

  await scrollTo(page, 50_000, 600);
  const after = await boxes(page);
  expect(after.top?.top).toBeCloseTo(before.top?.top ?? -1, 0);
  expect(after.bottom?.bottom).toBeCloseTo(before.bottom?.bottom ?? -1, 0);
  // Sideways, pinned columns stay put and the others move, as in body rows.
  expect(after.topPinnedCol).toBeCloseTo(before.topPinnedCol ?? -1, 0);
  expect(after.topScrollingCol ?? 0).toBeLessThan((before.topScrollingCol ?? 0) - 500);
});

test('the keyboard moves through the pinned rows and scrolls body rows clear of them', async ({
  page,
}) => {
  await open(page, { rows: 5000, pinned: 'top,bottom' });
  await page
    .locator('argus-table')
    .evaluate((t) => t.shadowRoot?.querySelector<HTMLElement>('[role="columnheader"]')?.focus());
  await page.keyboard.press('ArrowDown');
  await settle(page);
  // Header 1, the top row 2.
  expect(await focused(page)).toMatchObject({ role: 'gridcell', rowIndex: 2 });

  await scrollTo(page, 20_000);
  await page.keyboard.press('ArrowDown');
  await settle(page);
  expect(await focused(page)).toMatchObject({ rowIndex: 3 });
  const clear = await page.evaluate(() => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    const cell = root?.activeElement?.getBoundingClientRect();
    const top = root?.querySelector('[part~="row-pinned-top"]')?.getBoundingClientRect();
    return !!cell && !!top && cell.top >= top.bottom - 0.5;
  });
  expect(clear).toBe(true);

  await page.keyboard.press('ControlOrMeta+End');
  await settle(page);
  // The last of 5003 rows: header, 1 top, 5000 body, 1 bottom.
  expect(await focused(page)).toMatchObject({ rowIndex: 5003 });
});

test('in RTL, pinned columns in pinned rows sit at the mirrored edge', async ({ page }) => {
  await open(page, { rows: 200, pinned: 'bottom', dir: 'rtl' });
  await scrollTo(page, null, -800);
  const edges = await page.evaluate(() => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    const scroller = root?.querySelector<HTMLElement>('[part~="table"]');
    const row = root?.querySelector('[part~="row-pinned-bottom"]');
    if (!scroller || !row) throw new Error('table not rendered');
    const box = scroller.getBoundingClientRect();
    return {
      contentRight: box.left + scroller.clientLeft + scroller.clientWidth,
      start: row.querySelector('[data-col="index"]')?.getBoundingClientRect().right,
    };
  });
  expect(edges.start).toBeCloseTo(edges.contentRight, 0);
});
