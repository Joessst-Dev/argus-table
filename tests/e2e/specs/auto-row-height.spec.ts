import { expect, test, type Page } from '@playwright/test';
import { focused, open, scrollTo, settle, visibleRows } from './helpers.js';

/** The rendered body rows' boxes, in order of their index. */
async function boxes(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    return [...(root?.querySelectorAll<HTMLElement>('[part~="body"] > [part~="row"]') ?? [])]
      .map((row) => {
        const r = row.getBoundingClientRect();
        return { index: Number(row.getAttribute('aria-rowindex')), top: r.top, bottom: r.bottom };
      })
      .sort((a, b) => a.index - b.index);
  });
}

/**
 * Every visible row shows its own data, rows follow on from each other, and the
 * rendered rows sit one below the other without gaps or overlaps.
 */
async function expectConsistent(page: Page) {
  const rows = await visibleRows(page);
  expect(rows.length).toBeGreaterThan(1);
  rows.forEach(({ rowIndex, cells }, i) => {
    expect(cells.index).toBe(String(rowIndex - 2));
    expect(cells.note?.startsWith(`${String(rowIndex - 2)}:`)).toBe(true);
    if (i > 0) expect(rowIndex).toBe((rows[i - 1]?.rowIndex ?? 0) + 1);
  });
  const rendered = await boxes(page);
  for (let i = 1; i < rendered.length; i++) {
    const prev = rendered[i - 1];
    const row = rendered[i];
    if (!prev || row?.index !== prev.index + 1) continue;
    expect(Math.abs(row.top - prev.bottom)).toBeLessThan(1);
  }
}

/** The index of the first row whose bottom is below the header (the scroller's top plus its height). */
async function topIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    const scroller = root?.querySelector('[part~="table"]')?.getBoundingClientRect().top ?? 0;
    const header =
      scroller + (root?.querySelector<HTMLElement>('[part~="header"]')?.offsetHeight ?? 0);
    const rows = [...(root?.querySelectorAll<HTMLElement>('[part~="body"] > [part~="row"]') ?? [])]
      .map((row) => ({ row, r: row.getBoundingClientRect() }))
      .filter(({ r }) => r.bottom > header + 1)
      .sort((a, b) => a.r.top - b.r.top);
    return Number(rows[0]?.row.getAttribute('aria-rowindex')) - 2;
  });
}

/**
 * Puts the mouse over the middle of the table for wheel input. Not `hover()` on
 * the body: it is millions of px tall and grows as rows are measured, so
 * Playwright can find it "not stable" and scroll it into view, which jumped
 * WebKit to the end of the table on CI.
 */
async function pointAtTable(page: Page) {
  const box = await page.locator('argus-table').boundingBox();
  if (!box) throw new Error('no table');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/** The scroller's offset in px. */
async function scrollTop(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.querySelector('argus-table')?.shadowRoot?.querySelector('[part~="table"]')
        ?.scrollTop ?? 0,
  );
}

test.describe('rowHeight auto, 100,000 rows', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, { rows: 100_000, cols: 8, rowheight: 'auto', notes: '' });
  });

  test('rows fit their notes, one below the other', async ({ page }) => {
    const heights = (await boxes(page)).slice(0, 5).map((b) => Math.round(b.bottom - b.top));
    // Row 0's note is one line, but the playground's Open button (its size
    // differs by engine) is taller than a line of text: compare from row 1.
    expect(heights[1]).toBeGreaterThan(heights[0] ?? 0);
    for (let i = 2; i < 5; i++) expect(heights[i]).toBeGreaterThan(heights[i - 1] ?? 0);
    await expectConsistent(page);
  });

  test('keeps the DOM bounded and the content in step while jumping', async ({ page }) => {
    for (const top of [800, 150_000, 2_000_000, 600]) {
      await scrollTo(page, top);
      await settle(page);
      await expectConsistent(page);
    }
    const rendered = await page.locator('argus-table [part~="body"] > [part~="row"]').count();
    expect(rendered).toBeLessThan(60);
  });

  test('the mouse wheel scrolls down without stalling', async ({ page }) => {
    await pointAtTable(page);
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 400);
    // In px: how many rows that is depends on the fonts.
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(3200);
    expect(await topIndex(page)).toBeGreaterThan(10);
    await settle(page);
    await expectConsistent(page);
  });

  test('the mouse wheel scrolls up through rows not measured yet', async ({ page }) => {
    await page.evaluate(() => document.querySelector('argus-table')?.scrollToRow(50_000));
    await settle(page);
    expect(await topIndex(page)).toBe(50_000);
    await pointAtTable(page);
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, -400);
    // About 40 rows of 40 to 200 px; a wheel scroll cut short by a write to the
    // scroll position (WebKit) moved about 8. Leave room for a loaded machine.
    await expect.poll(() => topIndex(page)).toBeLessThan(49_980);
    await settle(page);
    await expectConsistent(page);
  });

  test('PageDown keeps the focused row in view; Ctrl+End reaches the last row', async ({
    page,
  }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('PageDown');
    await settle(page);
    const paged = (await focused(page))?.rowIndex ?? 0;
    expect(paged).toBeGreaterThan(3);
    expect((await visibleRows(page)).map((r) => r.rowIndex)).toContain(paged);
    await page.keyboard.press('ControlOrMeta+End');
    await settle(page);
    await expect.poll(async () => (await focused(page))?.rowIndex).toBe(100_001);
    await settle(page);
    expect((await visibleRows(page)).map((r) => r.rowIndex)).toContain(100_001);
  });
});

// 1M rows are at least 40M px: the body is scaled (see scroll.spec.ts).
test.describe('rowHeight auto, 1,000,000 rows', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, { rows: 1_000_000, cols: 8, rowheight: 'auto', notes: '' });
  });

  test('jumps to the middle and to the end', async ({ page }) => {
    await page.evaluate(() => {
      const scroller = document
        .querySelector('argus-table')
        ?.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
      if (scroller) scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
    });
    await settle(page);
    await settle(page);
    const middle = await topIndex(page);
    expect(middle).toBeGreaterThan(400_000);
    expect(middle).toBeLessThan(600_000);
    await expectConsistent(page);
    await scrollTo(page, -1);
    await settle(page);
    await scrollTo(page, -1);
    const rows = await visibleRows(page);
    expect(rows.at(-1)?.rowIndex).toBe(1_000_001);
    await expectConsistent(page);
  });

  test('scrollToRow() and the mouse wheel', async ({ page }) => {
    await page.evaluate(() => document.querySelector('argus-table')?.scrollToRow(765_432));
    await settle(page);
    expect(await topIndex(page)).toBe(765_432);
    await expectConsistent(page);
    await pointAtTable(page);
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 400);
    await expect.poll(() => topIndex(page)).toBeGreaterThan(765_432 + 10);
    await settle(page);
    await expectConsistent(page);
  });
});
