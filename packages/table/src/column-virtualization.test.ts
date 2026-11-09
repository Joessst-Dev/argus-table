import { afterEach, describe, expect, test } from 'vitest';
import type { ArgusTable } from './index.js';
import { LOAD_DEBOUNCE_MS } from './controllers/data-controller.js';
import type { ColumnDef, DataSource } from './types.js';
import {
  fixture,
  people,
  rowsInOrder,
  settle,
  shadow,
  slotted,
  type Person,
} from './test-utils.js';

afterEach(() => {
  document.body.replaceChildren();
});

const SCROLLING = 100;

/**
 * 2 start-pinned columns (200 px), 100 scrolling columns of 100 px, 1
 * end-pinned (60 px). Column `c{i}` shows `{name}·{i}`.
 */
function wide(patch: (i: number) => Partial<ColumnDef<Person>> = () => ({})): ColumnDef<Person>[] {
  return [
    { id: 'name', header: 'Name', accessor: 'name', width: 120, pin: 'start' },
    { id: 'age', header: 'Age', accessor: 'age', width: 80, pin: 'start' },
    ...Array.from({ length: SCROLLING }, (_, i): ColumnDef<Person> => ({
      id: `c${String(i)}`,
      header: `C${String(i)}`,
      accessor: (p) => `${p.name}·${String(i)}`,
      width: 100,
      ...patch(i),
    })),
    { id: 'actions', header: 'Act', width: 60, pin: 'end', cell: () => 'act' },
  ];
}

const scroller = (el: HTMLElement) => {
  const s = shadow(el).querySelector<HTMLElement>('[part~="table"]');
  if (!s) throw new Error('no scroller');
  return s;
};

async function scrollInline(el: ArgusTable<Person>, left: number) {
  const s = scroller(el);
  if (s.scrollLeft === left) return;
  const scrolled = new Promise((resolve) => {
    s.addEventListener('scroll', resolve, { once: true });
  });
  s.scrollLeft = left;
  await scrolled;
  await settle(el);
}

const headers = (el: HTMLElement) => [
  ...shadow(el).querySelectorAll<HTMLElement>('[role="columnheader"]'),
];
const headerIds = (el: HTMLElement) => headers(el).map((h) => h.dataset.col ?? '');
const header = (el: HTMLElement, id: string) =>
  shadow(el).querySelector<HTMLElement>(`[role="columnheader"][data-col="${id}"]`);
const cellIn = (row: Element | undefined, id: string) =>
  row?.querySelector<HTMLElement>(`[data-col="${id}"]`) ?? null;
const focused = (el: HTMLElement) => shadow(el).activeElement as HTMLElement | null;

/** The scrolling columns that show at least partly in the view, by their headers' rects. */
function visibleIds(el: HTMLElement): string[] {
  const s = scroller(el);
  const rect = s.getBoundingClientRect();
  const left = rect.left + s.clientLeft + 200;
  const right = rect.left + s.clientLeft + s.clientWidth - 60;
  return Array.from({ length: SCROLLING }, (_, i) => `c${String(i)}`).filter((id) => {
    const h = header(el, id);
    if (!h) return false;
    const r = h.getBoundingClientRect();
    return r.right > left + 1 && r.left < right - 1;
  });
}

/** The scrolling columns that should show at `left` px: from the column widths. */
function expectedVisible(el: HTMLElement): string[] {
  const s = scroller(el);
  const offset = Math.abs(s.scrollLeft);
  const view = s.clientWidth - 260;
  return Array.from({ length: SCROLLING }, (_, i) => i)
    .filter((i) => i * 100 + 100 > offset + 1 && i * 100 < offset + view - 1)
    .map((i) => `c${String(i)}`);
}

function press(target: Element | null, key: string, init: KeyboardEventInit = {}) {
  if (!target) throw new Error(`nothing to press ${key} on`);
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }),
  );
}

describe('virtualizeColumns off', () => {
  test('renders every column in order, slotted by column index', async () => {
    const el = await fixture({ columns: wide(), data: people(5) });
    expect(headers(el)).toHaveLength(SCROLLING + 3);
    expect(headerIds(el).slice(0, 4)).toEqual(['name', 'age', 'c0', 'c1']);
    const [first] = headers(el);
    expect(first?.querySelector('slot')?.name).toBe('h-1');
    expect(first?.getAttribute('style')).toBe('--_pin-offset: 0px');
    expect(header(el, 'c0')?.hasAttribute('style')).toBe(false);
  });
});

describe('virtualizeColumns', () => {
  test('renders the pinned columns and the scrolling ones in view, plus overscan', async () => {
    const el = await fixture({ columns: wide(), data: people(50), virtualizeColumns: true });
    const ids = headerIds(el);
    expect(ids).toContain('name');
    expect(ids).toContain('age');
    expect(ids).toContain('actions');
    expect(ids.length).toBeLessThan(20);
    // Two columns of overscan past the visible ones.
    const visible = expectedVisible(el);
    expect(visibleIds(el)).toEqual(visible);
    const last = Number(visible.at(-1)?.slice(1));
    expect(ids).toContain(`c${String(last + 2)}`);
    // Every rendered row has a cell per rendered column, and content only for those.
    for (const row of rowsInOrder(el)) {
      expect(row.querySelectorAll('[role="gridcell"]')).toHaveLength(ids.length);
    }
    const contents = el.querySelectorAll(':scope > [slot^="c-"]');
    expect(contents).toHaveLength(rowsInOrder(el).length * ids.length);
  });

  test('shows the right columns, in the right place, wherever it scrolls', async () => {
    const el = await fixture({ columns: wide(), data: people(50), virtualizeColumns: true });
    const before = new Set(headers(el));
    for (const left of [450, 3000, 5012, 9000, 100 * SCROLLING]) {
      await scrollInline(el, Math.min(left, scroller(el).scrollWidth - scroller(el).clientWidth));
      expect(visibleIds(el)).toEqual(expectedVisible(el));
      const s = scroller(el);
      const origin = s.getBoundingClientRect().left + s.clientLeft + 200 - s.scrollLeft;
      for (const id of visibleIds(el)) {
        const i = Number(id.slice(1));
        expect(header(el, id)?.getBoundingClientRect().left).toBeCloseTo(origin + i * 100, 0);
        // Body cells line up under their header and show their column's content.
        const row = rowsInOrder(el)[3];
        const cell = cellIn(row, id);
        expect(cell?.getBoundingClientRect().left).toBeCloseTo(origin + i * 100, 0);
        expect(slotted(cell as Element)?.textContent).toBe(`Person 3·${String(i)}`);
        expect(cell?.getAttribute('aria-colindex')).toBe(String(i + 3));
      }
      // The pool doesn't grow while scrolling: the same header nodes, reused.
      expect(new Set(headers(el))).toEqual(before);
    }
  });

  test('mirrors in RTL', async () => {
    const el = document.createElement('argus-table') as unknown as ArgusTable<Person>;
    el.dir = 'rtl';
    el.style.inlineSize = '800px';
    el.style.blockSize = '400px';
    Object.assign(el, { columns: wide(), data: people(20), virtualizeColumns: true });
    document.body.append(el);
    await settle(el);
    await scrollInline(el, -4000);
    const s = scroller(el);
    const right = s.getBoundingClientRect().left + s.clientLeft + s.clientWidth;
    const visible = expectedVisible(el);
    expect(visible.length).toBeGreaterThan(3);
    for (const id of visible) {
      const i = Number(id.slice(1));
      // RTL: column i starts 200 + i * 100 px from the right edge, less the scroll.
      expect(header(el, id)?.getBoundingClientRect().right).toBeCloseTo(
        right - 200 - i * 100 + 4000,
        0,
      );
    }
  });

  test('keeps the focused cell rendered and focused while it scrolls out of view', async () => {
    const el = await fixture({ columns: wide(), data: people(50), virtualizeColumns: true });
    cellIn(rowsInOrder(el)[2], 'c1')?.focus();
    await settle(el);
    await scrollInline(el, 6000);
    const cell = focused(el);
    expect(cell?.dataset.col).toBe('c1');
    expect(cell?.getAttribute('tabindex')).toBe('0');
    expect(visibleIds(el)).not.toContain('c1');
    // The next column renders and scrolls into view.
    press(cell, 'ArrowRight');
    await settle(el);
    await settle(el);
    expect(focused(el)?.dataset.col).toBe('c2');
    expect(visibleIds(el)).toContain('c2');
    expect(visibleIds(el)).toEqual(expectedVisible(el));
  });

  test('keyboard moves reach columns out of view', async () => {
    const el = await fixture({ columns: wide(), data: people(50), virtualizeColumns: true });
    header(el, 'c3')?.focus();
    await settle(el);
    for (let i = 0; i < 12; i++) {
      press(focused(el), 'ArrowRight');
      await settle(el);
    }
    expect(focused(el)?.dataset.col).toBe('c15');
    expect(visibleIds(el)).toContain('c15');
    press(focused(el), 'ArrowDown');
    await settle(el);
    expect(focused(el)?.getAttribute('role')).toBe('gridcell');
    expect(focused(el)?.dataset.col).toBe('c15');
  });

  test('measures auto columns out of view', async () => {
    const el = await fixture({
      columns: wide((i) =>
        i === 80
          ? { width: 'auto', accessor: (p) => `${p.name} with a much longer text in it` }
          : {},
      ),
      data: people(20),
      virtualizeColumns: true,
    });
    await settle(el);
    expect(headerIds(el)).not.toContain('c80');
    await scrollInline(el, 7800);
    const width = header(el, 'c80')?.getBoundingClientRect().width ?? 0;
    expect(width).toBeGreaterThan(200);
    const content = slotted(cellIn(rowsInOrder(el)[0], 'c80') as Element) as HTMLElement;
    expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
  });

  test('autosizeColumns() fits columns out of view', async () => {
    // The width every column's content needs, with every column rendered.
    const all = await fixture({ columns: wide(), data: people(20) });
    await all.autosizeColumns(['c70']);
    const fitted = all.columnSizing.c70;
    expect(fitted).not.toBe(100);
    all.remove();
    const el = await fixture({ columns: wide(), data: people(20), virtualizeColumns: true });
    const seen: { columnId: string; width: number }[] = [];
    el.addEventListener('argus-column-resize', (e) => seen.push(e.detail));
    await el.autosizeColumns(['c70']);
    expect(seen).toEqual([{ columnId: 'c70', width: fitted, sizing: { c70: fitted } }]);
    expect(el.columnSizing.c70).toBe(fitted);
    // Rendered for the measurement only.
    await settle(el);
    expect(headerIds(el)).not.toContain('c70');
  });

  test('moves a column by keyboard', async () => {
    const el = await fixture({ columns: wide(), data: people(20), virtualizeColumns: true });
    await scrollInline(el, 4000);
    header(el, 'c42')?.focus();
    await settle(el);
    press(header(el, 'c42'), 'ArrowRight', { altKey: true, shiftKey: true });
    await settle(el);
    expect(el.columnOrder.indexOf('c42')).toBe(el.columnOrder.indexOf('c43') + 1);
    expect(focused(el)?.dataset.col).toBe('c42');
    expect(header(el, 'c42')?.getAttribute('aria-colindex')).toBe('46');
    const s = scroller(el);
    const origin = s.getBoundingClientRect().left + s.clientLeft + 200 - s.scrollLeft;
    expect(header(el, 'c42')?.getBoundingClientRect().left).toBeCloseTo(origin + 43 * 100, 0);
    expect(header(el, 'c43')?.getBoundingClientRect().left).toBeCloseTo(origin + 42 * 100, 0);
  });

  test('pinned rows and the checkbox column follow the window', async () => {
    const el = await fixture({
      columns: wide(),
      data: people(20),
      pinnedRows: { top: [{ id: 'top', name: 'Total', age: 0, address: { city: '' } }] },
      selectionMode: 'multi',
      selectionCheckboxes: true,
      virtualizeColumns: true,
    });
    await scrollInline(el, 3000);
    const pinned = shadow(el).querySelector('[part~="row-pinned"]');
    for (const id of visibleIds(el)) {
      const cell = cellIn(pinned ?? undefined, id);
      expect(slotted(cell as Element)?.textContent).toBe(`Total·${id.slice(1)}`);
    }
    const body = shadow(el).querySelector('[part~="body"]');
    expect(body?.querySelectorAll('[part~="selection-checkbox"]')).toHaveLength(
      body?.querySelectorAll('[role="row"]').length ?? -1,
    );
    expect(header(el, 'name')).not.toBeNull();
  });

  test('skeleton rows render the window too, and Retry stays in the first column', async () => {
    const source: DataSource<Person> = {
      pageSize: 20,
      getRows: () => Promise.reject(new Error('offline')),
    };
    const columns = wide().filter((c) => c.pin === undefined);
    const el = await fixture({ columns, dataSource: source, virtualizeColumns: true });
    await scrollInline(el, 3000);
    await new Promise((resolve) => setTimeout(resolve, LOAD_DEBOUNCE_MS + 20));
    await settle(el);
    await settle(el);
    const row = rowsInOrder(el)[0];
    expect(row?.getAttribute('part')).toContain('row-loading');
    expect(row?.querySelectorAll('[role="gridcell"]').length).toBeLessThan(20);
    for (const id of visibleIds(el)) {
      expect(cellIn(row, id)?.querySelector('[part~="skeleton-error"]')).not.toBeNull();
    }
    expect(cellIn(row, 'c0')?.querySelector('[part~="retry"]')).not.toBeNull();
  });

  test('turning it off renders every column again', async () => {
    const el = await fixture({ columns: wide(), data: people(20), virtualizeColumns: true });
    await scrollInline(el, 3000);
    el.virtualizeColumns = false;
    await settle(el);
    expect(headers(el)).toHaveLength(SCROLLING + 3);
    expect(headerIds(el).slice(0, 3)).toEqual(['name', 'age', 'c0']);
    const row = rowsInOrder(el)[0];
    expect(slotted(cellIn(row, 'c31') as Element)?.textContent).toBe('Person 0·31');
  });
});
