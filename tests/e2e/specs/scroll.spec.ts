import { expect, test, type Page } from '@playwright/test';
import { focused, open, scrollTo, settle, visibleRows } from './helpers.js';

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

// 1M rows of 40 px are 40M px: taller than any engine renders an element
// (Chromium and WebKit stop at about 33.5M px, Firefox drops it to 0 past about
// 17.9M px), so the body renders shorter and the scroll position is scaled.
// Firefox's body stops at 8M px: past about 8.95M px of scrolling it lets go of
// the sticky header and top pinned rows (#90).
test.describe('scrolling 1,000,000 rows', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, { rows: 1_000_000, cols: 8 });
  });

  /** Every visible row shows its own data, and they follow on from each other. */
  const expectConsistent = (rows: Awaited<ReturnType<typeof visibleRows>>) => {
    expect(rows.length).toBeGreaterThan(5);
    rows.forEach(({ rowIndex, cells }, i) => {
      expect(cells.index).toBe(String(rowIndex - 2));
      if (i > 0) expect(rowIndex).toBe((rows[i - 1]?.rowIndex ?? 0) + 1);
    });
  };

  test('renders a body the engine can scroll', async ({ page }) => {
    const { scrollHeight, body } = await page.evaluate(() => {
      const root = document.querySelector('argus-table')?.shadowRoot;
      return {
        scrollHeight: root?.querySelector('[part~="table"]')?.scrollHeight ?? 0,
        body: root?.querySelector<HTMLElement>('[part~="body"]')?.offsetHeight ?? 0,
      };
    });
    expect(body).toBeGreaterThan(1_000_000);
    expect(body).toBeLessThan(33_000_000);
    expect(scrollHeight).toBeGreaterThan(body);
  });

  test('scrolling to the bottom shows the last row', async ({ page }) => {
    await scrollTo(page, -1);
    const rows = await visibleRows(page);
    expect(rows.at(-1)?.rowIndex).toBe(1_000_001);
    expect(rows.at(-1)?.cells.index).toBe('999999');
    expectConsistent(rows);
  });

  test('a jump to the middle shows the rows there', async ({ page }) => {
    await page.evaluate(() => {
      const scroller = document
        .querySelector('argus-table')
        ?.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
      if (scroller) scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
    });
    await settle(page);
    const rows = await visibleRows(page);
    expect(rows[0]?.rowIndex).toBeGreaterThan(499_000);
    expect(rows[0]?.rowIndex).toBeLessThan(501_000);
    expectConsistent(rows);
  });

  test('scrollToRow() reaches the last rows', async ({ page }) => {
    for (const index of [999_999, 765_432]) {
      await page.evaluate((i) => document.querySelector('argus-table')?.scrollToRow(i), index);
      await settle(page);
      const rows = await visibleRows(page);
      expect(rows.map((r) => r.rowIndex)).toContain(index + 2);
      expectConsistent(rows);
    }
  });

  test('Ctrl+End focuses the last row in view', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ControlOrMeta+End');
    await settle(page);
    await expect.poll(async () => (await focused(page))?.rowIndex).toBe(1_000_001);
    const rows = await visibleRows(page);
    expect(rows.at(-1)?.rowIndex).toBe(1_000_001);
    await page.keyboard.press('PageUp');
    await settle(page);
    const row = (await focused(page))?.rowIndex ?? 0;
    expect(row).toBeLessThan(1_000_001);
    expect((await visibleRows(page)).map((r) => r.rowIndex)).toContain(row);
  });

  test('scrolls with the mouse wheel', async ({ page }) => {
    await page.locator('argus-table [part~="body"]').hover();
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 400);
    await expect.poll(async () => (await visibleRows(page))[0]?.rowIndex ?? 0).toBeGreaterThan(50);
    expectConsistent(await visibleRows(page));
  });
});

/**
 * The header and the top pinned rows: whether each is at its place below the
 * scroller's top edge, and the header cell at the point where it should be.
 */
async function stuck(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    const scroller = root?.querySelector('[part~="table"]');
    const header = root?.querySelector<HTMLElement>('[part~="header"]');
    const pinned = root?.querySelector('.pinned[data-side="top"]');
    if (!root || !scroller || !header) throw new Error('no table');
    const box = scroller.getBoundingClientRect();
    const top = box.top;
    const hit = root.elementFromPoint(box.left + 40, top + header.offsetHeight / 2);
    return {
      header: Math.round(header.getBoundingClientRect().top - top),
      pinned: pinned ? Math.round(pinned.getBoundingClientRect().top - top) : undefined,
      hit: hit?.closest('[role="columnheader"]') !== null,
    };
  });
}

test.describe('the header at the end of 1,000,000 rows', () => {
  for (const pinned of [false, true]) {
    const title = pinned
      ? 'stays at the top, with the top pinned rows below it'
      : 'stays at the top';
    test(title, async ({ page }) => {
      await open(page, { rows: 1_000_000, cols: 8, ...(pinned ? { pinned: 'top' } : {}) });
      for (const at of ['middle', 'end'] as const) {
        await page.evaluate((where) => {
          const scroller = document
            .querySelector('argus-table')
            ?.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
          if (!scroller) return;
          const range = scroller.scrollHeight - scroller.clientHeight;
          scroller.scrollTop = where === 'end' ? range : range / 2;
        }, at);
        await settle(page);
        const seen = await stuck(page);
        expect(seen.header, at).toBe(0);
        expect(seen.hit, at).toBe(true);
        if (pinned) expect(seen.pinned, at).toBe(40);
      }
    });
  }
});

/** Where a row (by aria-rowindex) sits in the body's view: its centre and the view's, in px. */
function rowInView(page: Page, ariaRowIndex: number) {
  return page.evaluate((index) => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    const scroller = root?.querySelector<HTMLElement>('[part~="table"]');
    const row = root?.querySelector(`[role='row'][aria-rowindex="${String(index)}"]`);
    const header = root?.querySelector(`[role='row'][aria-rowindex="1"]`);
    if (!scroller || !row || !header) return undefined;
    const box = scroller.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    const start = header.getBoundingClientRect().bottom;
    const end = box.top + scroller.clientTop + scroller.clientHeight;
    return { row: (r.top + r.bottom) / 2, view: (start + end) / 2, bottom: r.bottom, end };
  }, ariaRowIndex);
}

test.describe('scrollToRow() with align', () => {
  for (const rows of [100_000, 1_000_000]) {
    test(`centres a row and puts one at the bottom, ${String(rows)} rows`, async ({ page }) => {
      await open(page, { rows, cols: 8 });
      const index = Math.round(rows * 0.7654);
      // Firefox keeps scroll offsets past about 4M px to half a px, so deep in a
      // scaled body a row can land 1 px off, with the default 'start' as well.
      const slack = rows > 100_000 ? 1 : 0.5;
      const found = await page.evaluate(
        (i) => document.querySelector('argus-table')?.scrollToRow(i, { align: 'center' }),
        index,
      );
      expect(found).toBe(true);
      const centred = await rowInView(page, index + 2);
      expect(Math.abs((centred?.row ?? 0) - (centred?.view ?? 1e9))).toBeLessThanOrEqual(slack);

      // The playground's row ids are `r<index>`.
      const byId = await page.evaluate(
        (id) => document.querySelector('argus-table')?.scrollToRow({ id }, { align: 'end' }),
        `r${String(index - 500)}`,
      );
      expect(byId).toBe(true);
      const last = await rowInView(page, index - 498);
      expect(Math.abs((last?.bottom ?? 0) - (last?.end ?? 1e9))).toBeLessThanOrEqual(slack);
    });
  }
});

test.describe('scrollToColumn()', () => {
  for (const dir of ['ltr', 'rtl']) {
    test(`lands a column between the pinned ones, ${dir}`, async ({ page }) => {
      await open(page, { rows: 1000, cols: 40, ...(dir === 'rtl' ? { dir } : {}) });
      const edges = (id: string) =>
        page.evaluate((col) => {
          const root = document.querySelector('argus-table')?.shadowRoot;
          const header = (c: string) =>
            root
              ?.querySelector(`[role='row'][aria-rowindex="1"] > [data-col="${c}"]`)
              ?.getBoundingClientRect();
          const target = header(col);
          // The pinned columns next to the scrolling area: the last start one, the first end one.
          const pinned = [
            ...(root?.querySelectorAll('[part~="header-cell-pinned-edge"]') ?? []),
          ].map((c) => c.getBoundingClientRect());
          return { target, pinned };
        }, id);
      const rtl = dir === 'rtl';

      expect(
        await page.evaluate(() =>
          document.querySelector('argus-table')?.scrollToColumn('f20', { align: 'start' }),
        ),
      ).toBe(true);
      let { target, pinned } = await edges('f20');
      // The start-pinned edge column is the first pinned edge in the DOM.
      const start = pinned[0];
      expect(
        Math.abs(
          rtl
            ? (target?.right ?? 0) - (start?.left ?? 1e9)
            : (target?.left ?? 0) - (start?.right ?? 1e9),
        ),
      ).toBeLessThan(1);

      await page.evaluate(() =>
        document.querySelector('argus-table')?.scrollToColumn('f25', { align: 'end' }),
      );
      ({ target, pinned } = await edges('f25'));
      const end = pinned.at(-1);
      expect(
        Math.abs(
          rtl
            ? (target?.left ?? 0) - (end?.right ?? 1e9)
            : (target?.right ?? 0) - (end?.left ?? 1e9),
        ),
      ).toBeLessThan(1);
    });
  }
});
