import { expect, test, type Page } from '@playwright/test';
import { focused, open, scrollTo, settle } from './helpers.js';

// 300 columns: index and name pinned at the start, actions at the end, 297 scrolling.
const WIDE = { rows: 2000, cols: 300, vcols: '' };

/**
 * What the view shows: the headers in view, in visual order, whether they
 * cover the scrolling area without holes, and how many headers and cells
 * render in all.
 */
async function view(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    const scroller = root?.querySelector<HTMLElement>('[part~="table"]');
    if (!root || !scroller) throw new Error('table not rendered');
    const box = scroller.getBoundingClientRect();
    const rtl = getComputedStyle(scroller).direction === 'rtl';
    const headers = [...root.querySelectorAll<HTMLElement>('[role="columnheader"]')];
    const width = (pin: string) =>
      headers
        .filter((h) => h.dataset.pin === pin)
        .reduce((sum, h) => sum + h.getBoundingClientRect().width, 0);
    const start = width('start');
    const end = width('end');
    const left = box.left + scroller.clientLeft + (rtl ? end : start);
    const right = box.left + scroller.clientLeft + scroller.clientWidth - (rtl ? start : end);
    const inView = headers
      .filter((h) => h.dataset.pin === undefined)
      .map((h) => ({ h, r: h.getBoundingClientRect() }))
      .filter(({ r }) => r.right > left + 1 && r.left < right - 1)
      .sort((a, b) => (rtl ? b.r.left - a.r.left : a.r.left - b.r.left));
    const first = inView[0];
    const last = inView.at(-1);
    const covered =
      !!first &&
      !!last &&
      (rtl ? first.r.right >= right - 1 : first.r.left <= left + 1) &&
      (rtl ? last.r.left <= left + 1 : last.r.right >= right - 1) &&
      inView.every(
        ({ h }, i) =>
          i === 0 || Number(h.ariaColIndex) === Number(inView[i - 1]?.h.ariaColIndex) + 1,
      );
    // Every visible body row has a cell under each header in view, and every
    // cell and header fills its row's height (none wrapped into a second grid row).
    const rows = [...root.querySelectorAll('[part~="body"] > [part~="row"]')].filter((row) => {
      const r = row.getBoundingClientRect();
      return r.bottom > box.top + 1 && r.top < box.bottom - 1;
    });
    const onRow = (row: Element) => {
      const r = row.getBoundingClientRect();
      return [...row.querySelectorAll(':scope > [role]')].every((cell) => {
        const c = cell.getBoundingClientRect();
        return Math.abs(c.top - r.top) < 1 && Math.abs(c.bottom - r.bottom) < 1;
      });
    };
    const headerRow = root.querySelector('[part~="header"] [role="row"]');
    const aligned =
      !!headerRow &&
      onRow(headerRow) &&
      rows.every(
        (row) =>
          onRow(row) &&
          inView.every(({ h, r }) => {
            const cell = row.querySelector(`[data-col="${h.dataset.col ?? ''}"]`);
            return cell && Math.abs(cell.getBoundingClientRect().left - r.left) < 1;
          }),
      );
    return {
      ids: inView.map(({ h }) => h.dataset.col ?? ''),
      covered,
      aligned,
      headers: headers.length,
      cells: root.querySelectorAll('[role="gridcell"]').length,
      scrollLeft: scroller.scrollLeft,
    };
  });
}

test.describe('column virtualization', () => {
  test('renders the columns in view only, wherever it scrolls', async ({ page }) => {
    await open(page, WIDE);
    let v = await view(page);
    expect(v.headers).toBeLessThan(30);
    expect(v.covered).toBe(true);
    expect(v.aligned).toBe(true);
    const { headers, cells } = v;
    for (const left of [1234, 9000, 20_000, 1_000_000]) {
      await scrollTo(page, null, left);
      v = await view(page);
      expect(v.covered).toBe(true);
      expect(v.aligned).toBe(true);
      // The pool doesn't grow.
      expect(v.headers).toBe(headers);
      expect(v.cells).toBe(cells);
    }
    expect(v.ids.at(-1)).toBe('f291');
  });

  test('scrolls sideways with the mouse wheel', async ({ page }) => {
    await open(page, WIDE);
    const body = await page.locator('argus-table').boundingBox();
    if (!body) throw new Error('no table');
    await page.mouse.move(body.x + body.width / 2, body.y + body.height / 2);
    for (let i = 0; i < 10; i++) await page.mouse.wheel(400, 0);
    await expect.poll(async () => (await view(page)).scrollLeft).toBeGreaterThan(3000);
    await settle(page);
    const v = await view(page);
    expect(v.covered).toBe(true);
    expect(v.aligned).toBe(true);
  });

  test('keyboard focus moves across columns out of view', async ({ page }) => {
    await open(page, WIDE);
    await page.locator('argus-table [part~="body"] [data-col="date"]').first().click();
    for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowRight');
    await settle(page);
    expect((await focused(page))?.col).toBe('f25');
    let v = await view(page);
    expect(v.ids).toContain('f25');
    expect(v.covered).toBe(true);
    await page.keyboard.press('End');
    await settle(page);
    expect((await focused(page))?.col).toBe('actions');
    // Focus survives scrolling the focused column out of view, and comes back.
    await page.keyboard.press('ArrowLeft');
    await settle(page);
    expect((await focused(page))?.col).toBe('f291');
    await scrollTo(page, null, 0);
    expect((await focused(page))?.col).toBe('f291');
    await page.keyboard.press('ArrowLeft');
    await settle(page);
    expect((await focused(page))?.col).toBe('f290');
    v = await view(page);
    expect(v.ids).toContain('f290');
    expect(v.covered).toBe(true);
  });

  test('a column dragged to the edge moves past the columns rendered', async ({ page }) => {
    await open(page, WIDE);
    const header = page.locator('argus-table [role="columnheader"][data-col="email"]');
    const from = await header.boundingBox();
    const box = await page
      .locator('argus-table')
      .evaluate((el) => el.shadowRoot?.querySelector('[part~="table"]')?.getBoundingClientRect());
    if (!from || !box) throw new Error('no header');
    // The last scrolling column rendered before the drag, by position.
    const rendered = await page
      .locator('argus-table')
      .evaluate((el) =>
        Math.max(
          ...[...(el.shadowRoot?.querySelectorAll<HTMLElement>('[role="columnheader"]') ?? [])]
            .filter((h) => h.dataset.pin === undefined)
            .map((h) => Number(h.ariaColIndex)),
        ),
      );
    const y = from.y + from.height / 2;
    await page.mouse.move(from.x + from.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, y, { steps: 2 });
    await page.mouse.move(box.right - 100, y, { steps: 6 });
    // Auto-scroll moves a step per frame, so how fast it gets there depends on the frame rate.
    const lastInView = async () =>
      page.locator('argus-table').evaluate((el) => {
        const root = el.shadowRoot;
        const s = root?.querySelector('[part~="table"]')?.getBoundingClientRect();
        return Math.max(
          ...[...(root?.querySelectorAll<HTMLElement>('[role="columnheader"]') ?? [])]
            .filter(
              (h) =>
                h.dataset.pin === undefined &&
                h.getBoundingClientRect().left < (s?.right ?? 0) - 200,
            )
            .map((h) => Number(h.ariaColIndex)),
        );
      });
    await expect.poll(lastInView, { timeout: 20_000 }).toBeGreaterThan(rendered + 1);
    await page.mouse.up();
    await settle(page);
    const order = await page.evaluate(
      () => document.querySelector('argus-table')?.columnOrder ?? [],
    );
    // Past every column rendered when the drag started (positions are 1-based).
    expect(order.indexOf('email') + 1).toBeGreaterThan(rendered);
    const v = await view(page);
    expect(v.covered).toBe(true);
    expect(v.aligned).toBe(true);
  });

  test('works in RTL', async ({ page }) => {
    await open(page, { ...WIDE, dir: 'rtl' });
    for (const left of [-1500, -12_000]) {
      await scrollTo(page, null, left);
      const v = await view(page);
      expect(v.scrollLeft).toBeLessThan(-1000);
      expect(v.covered).toBe(true);
      expect(v.aligned).toBe(true);
    }
  });
});
