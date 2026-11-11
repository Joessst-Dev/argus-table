// Types only: brings in the 'argus-table' entry of HTMLElementTagNameMap.
import type {} from 'argus-table';
import type { Page } from '@playwright/test';

/** Opens the playground with query parameters and waits for the first render. */
export async function open(page: Page, query: Record<string, string | number> = {}): Promise<void> {
  const params = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
  await page.goto(`/?${params.toString()}`);
  await page.locator('argus-table [part~="row"]').first().waitFor();
  await page.evaluate(() => document.querySelector('argus-table')?.updateComplete);
}

/** Waits until the table has rendered after a change. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const table = document.querySelector('argus-table');
    await table?.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await table?.updateComplete;
  });
}

/** The rendered body rows, in visual order: `aria-rowindex` and cell texts by column id. */
export async function visibleRows(
  page: Page,
): Promise<{ rowIndex: number; cells: Record<string, string> }[]> {
  return page.evaluate(() => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    const scroller = root?.querySelector<HTMLElement>('[part~="table"]');
    if (!root || !scroller) return [];
    const box = scroller.getBoundingClientRect();
    const text = (cell: Element) =>
      (cell.querySelector('slot')?.assignedNodes() ?? [])
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
    return [...root.querySelectorAll<HTMLElement>('[part~="body"] > [part~="row"]')]
      .filter((row) => {
        const r = row.getBoundingClientRect();
        return r.bottom > box.top + 1 && r.top < box.bottom - 1;
      })
      .map((row) => ({
        rowIndex: Number(row.getAttribute('aria-rowindex')),
        top: row.getBoundingClientRect().top,
        cells: Object.fromEntries(
          [...row.querySelectorAll<HTMLElement>('[role="gridcell"]')].map((c) => [
            c.dataset.col ?? '',
            text(c),
          ]),
        ),
      }))
      .sort((a, b) => a.top - b.top)
      .map(({ rowIndex, cells }) => ({ rowIndex, cells }));
  });
}

/** Sets the scroll container's scroll position. */
export async function scrollTo(
  page: Page,
  top: number | null,
  left: number | null = null,
): Promise<void> {
  await page.evaluate(
    ([t, l]) => {
      const scroller = document
        .querySelector('argus-table')
        ?.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
      if (!scroller) throw new Error('no scroll container');
      if (t !== null) scroller.scrollTop = t === -1 ? scroller.scrollHeight : t;
      if (l !== null) scroller.scrollLeft = l;
    },
    [top, left] as const,
  );
  await settle(page);
}

/** The focused cell inside the table: its role, column id and row index. */
export async function focused(
  page: Page,
): Promise<{ role: string | null; col: string | undefined; rowIndex: number } | null> {
  return page.evaluate(() => {
    const active = document.querySelector('argus-table')?.shadowRoot
      ?.activeElement as HTMLElement | null;
    if (!active) return null;
    const row = active.closest('[role="row"]');
    return {
      role: active.getAttribute('role'),
      col: active.dataset.col,
      rowIndex: Number(row?.getAttribute('aria-rowindex')),
    };
  });
}

/** Column ids in the order the headers show, by `aria-colindex`. */
export async function headerOrder(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector('argus-table')?.shadowRoot;
    return [...(root?.querySelectorAll<HTMLElement>('[role="columnheader"]') ?? [])]
      .sort((a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex))
      .map((h) => h.dataset.col ?? '');
  });
}
