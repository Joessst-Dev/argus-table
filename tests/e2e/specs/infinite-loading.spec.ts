import { expect, test, type Page } from '@playwright/test';
import type { RowsRequest } from 'argus-table';
import { open, scrollTo, settle, visibleRows } from './helpers.js';

declare global {
  interface Window {
    /** Set by the playground with `source=remote`. */
    __argusRequests?: RowsRequest[];
  }
}

/** The requests the playground's pretend server has seen. */
const requests = (page: Page) =>
  page.evaluate(() =>
    (window.__argusRequests ?? []).map(({ start, end, sorting }) => ({ start, end, sorting })),
  );

/** Whether each request has been aborted. */
const aborted = (page: Page) =>
  page.evaluate(() => (window.__argusRequests ?? []).map((r) => r.signal.aborted));

/** Waits until no visible row is a skeleton any more. */
async function loaded(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = document.querySelector('argus-table')?.shadowRoot;
        return root?.querySelectorAll('[part~="row-loading"]').length ?? -1;
      }),
    )
    .toBe(0);
  await settle(page);
}

test.describe('infinite loading', () => {
  test('loads the first page, then the rows where scrolling stops', async ({ page }) => {
    // Slow answers, so pages asked for on the way are still in flight when scrolling stops.
    await open(page, { source: 'remote', rows: 100_000, cols: 8, latency: 1000 });
    await loaded(page);
    expect(await requests(page)).toEqual([{ start: 0, end: 100, sorting: [] }]);
    expect((await visibleRows(page))[0]?.cells.name).not.toBe('');

    // Several jumps in quick succession: the rows load where it stops. Pages
    // asked for on the way (only if a frame took longer than the debounce) are aborted.
    await page.evaluate(async () => {
      const scroller = document
        .querySelector('argus-table')
        ?.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
      if (!scroller) throw new Error('no scroller');
      for (const top of [400_000, 1_200_000, 2_000_000]) {
        scroller.scrollTop = top;
        await new Promise(requestAnimationFrame);
      }
    });
    await settle(page);
    const rows = await visibleRows(page);
    expect(rows.length).toBeGreaterThan(0);
    await loaded(page);
    const after = (await requests(page)).slice(1);
    const cancelled = (await aborted(page)).slice(1);
    const first = rows[0]?.rowIndex ?? 0;
    const near = after.map((r) => r.end > first - 100 && r.start < first + 100);
    expect(near).toContain(true);
    expect(near.map((n, i) => n || cancelled[i])).not.toContain(false);
    const shown = await visibleRows(page);
    expect(shown[0]?.cells.index).toBe(String((shown[0]?.rowIndex ?? 0) - 2));
  });

  test('sorting asks the server and starts from the top', async ({ page }) => {
    await open(page, { source: 'remote', rows: 5000, cols: 8, latency: 20 });
    await loaded(page);
    await scrollTo(page, 20_000);
    await loaded(page);

    await page.locator('argus-table [role="columnheader"][data-col="amount"]').click();
    await settle(page);
    await loaded(page);
    const last = (await requests(page)).at(-1);
    expect(last).toEqual({ start: 0, end: 100, sorting: [{ id: 'amount', desc: false }] });
    const rows = await visibleRows(page);
    expect(rows[0]?.rowIndex).toBe(2);
    const amounts = rows.map((r) => Number(r.cells.amount));
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  test('a failed page offers Retry', async ({ page }) => {
    await open(page, { source: 'remote', rows: 5000, cols: 8, latency: 20, fail: 0 });
    const retry = page.locator('argus-table [part~="retry"]');
    await expect(retry).toHaveCount(1);
    await expect(retry).toHaveAccessibleName('Retry loading rows 1 to 100');
    await retry.click();
    await loaded(page);
    expect((await visibleRows(page))[0]?.cells.index).toBe('0');
  });

  test('without a total, the rows end at the short page', async ({ page }) => {
    await open(page, { source: 'remote', rows: 250, cols: 8, latency: 20, total: 'unknown' });
    await loaded(page);
    for (let i = 0; i < 4; i++) {
      await scrollTo(page, -1);
      await loaded(page);
    }
    const rows = await visibleRows(page);
    expect(rows.at(-1)?.rowIndex).toBe(251);
    expect(rows.at(-1)?.cells.index).toBe('249');
  });
});
