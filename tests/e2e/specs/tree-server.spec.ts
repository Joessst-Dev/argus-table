import { expect, test, type Page } from '@playwright/test';
import type { ChildrenRequest, LoadErrorDetail } from 'argus-table';
import { focused, open, settle } from './helpers.js';

// The playground's `source=remote&tree`: every 10th top-level row (r0, r10, …) has
// children, 5 for r0 and 4 for r10 (r0.0 … r0.4); the first child of each has 2
// (r0.0.0, r0.0.1). The "#" column shows the row's id. `childlatency=hold` keeps each
// child answer until the test releases it.

declare global {
  interface Window {
    /** Set by the playground with `source=remote&tree`. */
    __argusChildRequests?: ChildrenRequest<unknown>[];
    /** Answers the held child requests (`childlatency=hold`). */
    __argusAnswerChildren?: () => void;
    /** The `argus-load-error` details a test collects. */
    __loadErrors?: Pick<LoadErrorDetail, 'parentId' | 'start' | 'end'>[];
  }
}

/** The body row at an `aria-rowindex`: its tree and loading state, its id and amount. */
const rowAt = (page: Page, ariaRowIndex: number) =>
  page.evaluate((i) => {
    const row = document
      .querySelector('argus-table')
      ?.shadowRoot?.querySelector(`[part~="body"] > [aria-rowindex="${String(i)}"]`);
    if (!row) return null;
    // The slotted light-DOM content of a cell.
    const text = (col: string) =>
      (row.querySelector<HTMLSlotElement>(`[data-col="${col}"] slot`)?.assignedNodes() ?? [])
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
    return {
      level: row.getAttribute('aria-level'),
      expanded: row.getAttribute('aria-expanded'),
      loading: row.getAttribute('part')?.includes('row-loading') ?? false,
      error: row.getAttribute('part')?.includes('row-error') ?? false,
      text: text('index'),
      amount: text('amount'),
    };
  }, ariaRowIndex);

/** The `aria-rowindex` of the rendered row with this id. */
const indexOf = (page: Page, id: string) =>
  page.evaluate((rowId) => {
    const rows = document
      .querySelector('argus-table')
      ?.shadowRoot?.querySelectorAll('[part~="body"] > [aria-rowindex]');
    const row = [...(rows ?? [])].find((r) =>
      (r.querySelector<HTMLSlotElement>('[data-col="index"] slot')?.assignedNodes() ?? []).some(
        (n) => n.textContent?.trim() === rowId,
      ),
    );
    return Number(row?.getAttribute('aria-rowindex') ?? -1);
  }, id);

/** The rows at `from`, `from + 1`, … `from + count - 1`. */
const rowsFrom = (page: Page, from: number, count: number) =>
  Promise.all(Array.from({ length: count }, (_, i) => rowAt(page, from + i)));

const treeExpanded = (page: Page) =>
  page.evaluate(() => [...(document.querySelector('argus-table')?.treeExpanded ?? [])]);

/** The child requests the pretend server has seen. */
const childRequests = (page: Page) =>
  page.evaluate(() =>
    (window.__argusChildRequests ?? []).map(({ parentId, sorting }) => ({ parentId, sorting })),
  );

/** Waits for the `count`th child request, then answers those `childlatency=hold` holds. */
async function answerChildren(page: Page, count: number) {
  await expect.poll(async () => (await childRequests(page)).length).toBe(count);
  await page.evaluate(() => {
    window.__argusAnswerChildren?.();
  });
}

const toggleAt = (page: Page, ariaRowIndex: number) =>
  page.locator(
    `argus-table [part~="body"] > [aria-rowindex="${String(ariaRowIndex)}"] [part~="tree-toggle"]`,
  );

/** Waits until no rendered row is loading any more. */
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

/** Presses a key and waits for the update and the focus that follows it. */
async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await settle(page);
}

const remote = { source: 'remote', tree: '', latency: 20 };

test.describe('tree rows from a data source', () => {
  test('rows expand by click and by ArrowRight, with a loading row until the answer', async ({
    page,
  }) => {
    await open(page, { ...remote, rows: 1000, childlatency: 'hold' });
    await loaded(page);
    expect(await rowAt(page, 2)).toMatchObject({ level: '1', expanded: 'false', text: 'r0' });
    expect(await rowAt(page, 3)).toMatchObject({ level: '1', expanded: null, text: 'r1' });

    // A click on the toggle opens r0: one request, a loading row one level deeper.
    await toggleAt(page, 2).click();
    await settle(page);
    expect(await treeExpanded(page)).toEqual(['r0']);
    // The request starts after the load debounce.
    await expect.poll(() => childRequests(page)).toEqual([{ parentId: 'r0', sorting: [] }]);
    expect(await rowAt(page, 2)).toMatchObject({ expanded: 'true', text: 'r0' });
    expect(await rowAt(page, 3)).toMatchObject({ level: '2', loading: true, error: false });
    expect(await rowAt(page, 4)).toMatchObject({ level: '1', text: 'r1' });
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: 2 });

    // The answer: five children, then the next top-level row.
    await answerChildren(page, 1);
    await expect.poll(() => rowAt(page, 3)).toMatchObject({ loading: false, text: 'r0.0' });
    expect(await rowsFrom(page, 3, 6)).toMatchObject([
      { level: '2', expanded: 'false', text: 'r0.0' },
      { level: '2', expanded: null, text: 'r0.1' },
      { level: '2', text: 'r0.2' },
      { level: '2', text: 'r0.3' },
      { level: '2', expanded: null, text: 'r0.4' },
      { level: '1', text: 'r1' },
    ]);

    // ArrowRight on r0.0 opens it: its two children load at the third level.
    await press(page, 'ArrowDown');
    await press(page, 'ArrowRight');
    expect(await treeExpanded(page)).toEqual(['r0', 'r0.0']);
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: 3 });
    expect(await rowAt(page, 4)).toMatchObject({ level: '3', loading: true });
    expect(await rowAt(page, 5)).toMatchObject({ level: '2', text: 'r0.1' });
    await answerChildren(page, 2);
    await expect.poll(() => rowAt(page, 4)).toMatchObject({ loading: false, text: 'r0.0.0' });
    expect(await rowsFrom(page, 3, 4)).toMatchObject([
      { level: '2', expanded: 'true', text: 'r0.0' },
      { level: '3', expanded: null, text: 'r0.0.0' },
      { level: '3', expanded: null, text: 'r0.0.1' },
      { level: '2', text: 'r0.1' },
    ]);
    expect(await childRequests(page)).toEqual([
      { parentId: 'r0', sorting: [] },
      { parentId: 'r0.0', sorting: [] },
    ]);

    // Ctrl+End: the last of the 1000 top-level rows, after the 7 children shown.
    await press(page, 'ControlOrMeta+End');
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'actions', rowIndex: 1008 });
    await expect.poll(() => rowAt(page, 1008)).toMatchObject({ level: '1', text: 'r999' });

    // Back to r0.0, then ArrowLeft: collapse it, to its parent, collapse that.
    // The top page was evicted: wait for it, since Left collapses only loaded rows.
    await press(page, 'ControlOrMeta+Home');
    await loaded(page);
    await press(page, 'ArrowDown');
    await press(page, 'ArrowDown');
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: 3 });
    await press(page, 'ArrowLeft');
    expect(await treeExpanded(page)).toEqual(['r0']);
    expect(await rowAt(page, 4)).toMatchObject({ level: '2', text: 'r0.1' });
    await press(page, 'ArrowLeft');
    expect(await focused(page)).toEqual({ role: 'gridcell', col: 'index', rowIndex: 2 });
    await press(page, 'ArrowLeft');
    expect(await treeExpanded(page)).toEqual([]);
    expect(await rowAt(page, 2)).toMatchObject({ expanded: 'false', text: 'r0' });
    expect(await rowAt(page, 3)).toMatchObject({ level: '1', text: 'r1' });

    // Collapsing kept the children: opening r0 again shows them with no new request.
    await press(page, 'ArrowRight');
    expect(await treeExpanded(page)).toEqual(['r0']);
    expect(await rowAt(page, 3)).toMatchObject({ level: '2', loading: false, text: 'r0.0' });
    // A smoke check: tree-server.test.ts proves no request follows the debounce.
    expect(await childRequests(page)).toHaveLength(2);
  });

  test('a failed child request offers Retry and fires argus-load-error', async ({ page }) => {
    await open(page, { ...remote, rows: 1000, childlatency: 20, failchildren: 'r10' });
    await loaded(page);
    await page.evaluate(() => {
      const errors: NonNullable<Window['__loadErrors']> = (window.__loadErrors = []);
      document.querySelector('argus-table')?.addEventListener('argus-load-error', (event) => {
        const { parentId, start, end } = event.detail;
        errors.push({ parentId, start, end });
      });
    });

    // r10 is the 11th row, its children (4) load in its place.
    expect(await rowAt(page, 12)).toMatchObject({ level: '1', expanded: 'false', text: 'r10' });
    await toggleAt(page, 12).click();
    const retry = page.locator('argus-table [part~="retry"]');
    await expect(retry).toHaveCount(1);
    await expect(retry).toHaveAccessibleName('Retry loading child rows');
    expect(await rowAt(page, 13)).toMatchObject({ level: '2', loading: true, error: true });
    expect(await rowAt(page, 14)).toMatchObject({ level: '1', text: 'r11' });
    expect(await page.evaluate(() => window.__loadErrors)).toEqual([
      { parentId: 'r10', start: 10, end: 11 },
    ]);

    await retry.click();
    await expect.poll(() => rowAt(page, 13)).toMatchObject({ loading: false, text: 'r10.0' });
    expect(await rowsFrom(page, 13, 5)).toMatchObject([
      { level: '2', text: 'r10.0' },
      { level: '2', text: 'r10.1' },
      { level: '2', text: 'r10.2' },
      { level: '2', text: 'r10.3' },
      { level: '1', text: 'r11' },
    ]);
    await expect(retry).toHaveCount(0);
    expect(await childRequests(page)).toEqual([
      { parentId: 'r10', sorting: [] },
      { parentId: 'r10', sorting: [] },
    ]);
    expect(await page.evaluate(() => window.__loadErrors)).toHaveLength(1);
  });

  test('a sort change reloads the open rows’ children in the new order', async ({ page }) => {
    await open(page, { ...remote, rows: 100, childlatency: 'hold' });
    await loaded(page);
    await toggleAt(page, 2).click();
    await answerChildren(page, 1);
    await expect.poll(() => rowAt(page, 3)).toMatchObject({ loading: false, text: 'r0.0' });
    const before = await rowsFrom(page, 3, 5);
    const amountsOf = (rows: typeof before) => rows.map((r) => Number(r?.amount));
    // Unsorted, the server's children aren't in amount order.
    expect(amountsOf(before)).not.toEqual(amountsOf(before).sort((a, b) => a - b));

    await page.locator('argus-table [role="columnheader"][data-col="amount"]').click();
    const amount = [{ id: 'amount', desc: false }];
    await expect
      .poll(() => childRequests(page))
      .toEqual([
        { parentId: 'r0', sorting: [] },
        { parentId: 'r0', sorting: amount },
      ]);

    // Until the answer, r0 keeps five loading rows in its children's place.
    await page.evaluate(() => document.querySelector('argus-table')?.scrollToRow({ id: 'r0' }));
    await settle(page);
    const at = await indexOf(page, 'r0');
    expect(at).toBeGreaterThan(1);
    expect(await rowsFrom(page, at + 1, 5)).toMatchObject(
      Array.from({ length: 5 }, () => ({ level: '2', loading: true })),
    );

    await answerChildren(page, 2);
    await expect.poll(() => rowAt(page, at + 1)).toMatchObject({ loading: false });
    const after = await rowsFrom(page, at + 1, 5);
    expect(after.map((r) => r?.level)).toEqual(['2', '2', '2', '2', '2']);
    expect(amountsOf(after)).toEqual(amountsOf(before).sort((a, b) => a - b));
    expect(after.map((r) => r?.text).sort()).toEqual(['r0.0', 'r0.1', 'r0.2', 'r0.3', 'r0.4']);
    expect(await rowAt(page, at + 6)).toMatchObject({ level: '1' });
  });
});
