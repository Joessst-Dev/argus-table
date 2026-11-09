import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { ArgusTable } from './index.js';
import { setMaxElementHeightForTests } from './max-height.js';
import type { ColumnDef } from './types.js';
import { fixture, people, rowText, scrollTo, settle, shadow, type Person } from './test-utils.js';

// Engines render bodies up to 16M–33M px; pretend 100k px so 10k rows of 40 px
// (400k px) scale, about 4 px of rows per px scrolled.
const MAX = 100_000;
const ROWS = 10_000;

beforeEach(() => {
  setMaxElementHeightForTests(MAX);
});

afterEach(() => {
  setMaxElementHeightForTests(undefined);
  document.body.replaceChildren();
});

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 200 },
  { id: 'age', header: 'Age', accessor: 'age', width: 80, align: 'end' },
  { id: 'city', header: 'City', accessor: 'address.city', width: { flex: 1 }, minWidth: 120 },
];

const scroller = (el: HTMLElement) => {
  const s = shadow(el).querySelector<HTMLElement>('[part~="table"]');
  if (!s) throw new Error('no scroller');
  return s;
};
const body = (el: HTMLElement) => shadow(el).querySelector<HTMLElement>('[part~="body"]');
const rows = (el: HTMLElement) => [
  ...shadow(el).querySelectorAll<HTMLElement>('[part~="body"] > [role="row"]'),
];
/** Body row index of a row element (aria-rowindex less the header and `top` pinned rows). */
const indexOf = (row: Element, top = 0) => Number(row.getAttribute('aria-rowindex')) - 2 - top;

/** The visible area of the body: below the header and top pinned rows, above the bottom ones. */
function view(el: HTMLElement, top = 0, bottom = 0) {
  const box = scroller(el).getBoundingClientRect();
  const s = scroller(el);
  return {
    top: box.top + (1 + top) * 40,
    bottom: box.top + s.clientHeight - bottom * 40,
  };
}

/** Body rows wholly in view, by index. */
function visible(el: HTMLElement, top = 0, bottom = 0): number[] {
  const v = view(el, top, bottom);
  return rows(el)
    .filter((r) => {
      const rect = r.getBoundingClientRect();
      return rect.top >= v.top - 0.5 && rect.bottom <= v.bottom + 0.5;
    })
    .map((r) => indexOf(r, top))
    .sort((a, b) => a - b);
}

/** Every rendered row shows its own data, and rows lie 40 px apart by index. */
function expectConsistent(el: HTMLElement) {
  const rendered = rows(el);
  for (const row of rendered) expect(rowText(row)[0]).toBe(`Person ${String(indexOf(row))}`);
  const first = rendered[0];
  if (!first) return;
  const origin = first.getBoundingClientRect().top - indexOf(first) * 40;
  for (const row of rendered) {
    expect(row.getBoundingClientRect().top - indexOf(row) * 40).toBeCloseTo(origin, 0);
  }
}

describe('scroll scaling', () => {
  test('renders the body at the cap, not at full height', async () => {
    const el = await fixture({ columns, data: people(ROWS) });
    // The cap less the header and a margin.
    expect(parseFloat(body(el)?.style.blockSize ?? '')).toBeLessThan(MAX);
    expect(parseFloat(body(el)?.style.blockSize ?? '')).toBeGreaterThan(MAX - 2000);
    expect(scroller(el).scrollHeight).toBeLessThanOrEqual(MAX);
    expect(visible(el)[0]).toBe(0);
  });

  test('stays unscaled when the rows fit', async () => {
    const el = await fixture({ columns, data: people(1000) });
    expect(parseFloat(body(el)?.style.blockSize ?? '')).toBe(1000 * 40);
  });

  test('scrolling to the bottom shows the last row', async () => {
    const el = await fixture({ columns, data: people(ROWS) });
    await scrollTo(el, scroller(el).scrollHeight);
    expect(visible(el).at(-1)).toBe(ROWS - 1);
    expectConsistent(el);
  });

  test('a jump to the middle shows the rows there, in order', async () => {
    const el = await fixture({ columns, data: people(ROWS) });
    const s = scroller(el);
    await scrollTo(el, (s.scrollHeight - s.clientHeight) / 2);
    const first = visible(el)[0] ?? -1;
    // Half the logical range: (rows × 40 + 40 − 400) / 2 px of rows.
    expect(first).toBeGreaterThan((ROWS * 40 - 360) / 2 / 40 - 2);
    expect(first).toBeLessThan((ROWS * 40 - 360) / 2 / 40 + 2);
    expectConsistent(el);
  });

  test('scrollToRow() puts the row at the top', async () => {
    const el = await fixture({ columns, data: people(ROWS) });
    for (const index of [5000, 1234, 9000]) {
      await el.scrollToRow(index);
      await settle(el);
      expect(visible(el)[0]).toBe(index);
      const row = rows(el).find((r) => indexOf(r) === index);
      expect(row?.getBoundingClientRect().top).toBeCloseTo(view(el).top, 0);
      expectConsistent(el);
    }
    await el.scrollToRow(ROWS - 1);
    await settle(el);
    expect(visible(el).at(-1)).toBe(ROWS - 1);
  });

  test('keeps the logical position when the row count changes', async () => {
    const el = await fixture({ columns, data: people(ROWS), getRowId: (p) => p.id });
    await el.scrollToRow(4000);
    await settle(el);
    el.data = people(ROWS * 2);
    await settle(el);
    await settle(el);
    expect(visible(el)[0]).toBe(4000);
    expectConsistent(el);
  });

  describe('keyboard', () => {
    const press = (target: Element, key: string, init: KeyboardEventInit = {}) => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          composed: true,
          cancelable: true,
          ...init,
        }),
      );
    };
    const focused = (el: HTMLElement) => shadow(el).activeElement as HTMLElement | null;

    async function key(el: ArgusTable<Person>, name: string, init?: KeyboardEventInit) {
      const cell = focused(el);
      if (!cell) throw new Error('nothing focused');
      press(cell, name, init);
      await settle(el);
      await settle(el);
    }

    async function focusFirstBodyCell(el: ArgusTable<Person>) {
      shadow(el).querySelector<HTMLElement>('[part~="header-cell"]')?.focus();
      await settle(el);
      await key(el, 'ArrowDown');
    }

    /** The focused body row's index, and whether it is wholly in view. */
    function focusedRow(el: HTMLElement, top = 0, bottom = 0) {
      const row = focused(el)?.parentElement;
      if (!row) return undefined;
      const index = indexOf(row, top);
      return { index, inView: visible(el, top, bottom).includes(index) };
    }

    test('ArrowDown past the view keeps the focused row in view', async () => {
      const el = await fixture({ columns, data: people(ROWS) });
      await focusFirstBodyCell(el);
      for (let i = 1; i <= 14; i++) {
        await key(el, 'ArrowDown');
        expect(focusedRow(el)).toEqual({ index: i, inView: true });
      }
      for (let i = 13; i >= 0; i--) {
        await key(el, 'ArrowUp');
        expect(focusedRow(el)).toEqual({ index: i, inView: true });
      }
      expectConsistent(el);
    });

    test('PageDown and PageUp move a page and keep the row in view', async () => {
      const el = await fixture({ columns, data: people(ROWS) });
      await focusFirstBodyCell(el);
      // 400 px fit 10 rows; less the header, a page is 9.
      await key(el, 'PageDown');
      expect(focusedRow(el)).toEqual({ index: 9, inView: true });
      await key(el, 'PageDown');
      expect(focusedRow(el)).toEqual({ index: 18, inView: true });
      await key(el, 'PageUp');
      expect(focusedRow(el)).toEqual({ index: 9, inView: true });
      expectConsistent(el);
    });

    test('Shift+PageDown selects a page of rows and keeps the row in view', async () => {
      const el = await fixture({
        columns,
        data: people(ROWS),
        getRowId: (p) => p.id,
        selectionMode: 'multi',
      });
      await focusFirstBodyCell(el);
      await key(el, 'PageDown', { shiftKey: true });
      await key(el, 'PageDown', { shiftKey: true });
      expect(focusedRow(el)).toEqual({ index: 18, inView: true });
      expect(el.selection).toHaveLength(19);
      expect(el.selection.at(-1)).toBe('p18');
      expectConsistent(el);
    });

    test('Ctrl+End and Ctrl+Home reach the last and the first row', async () => {
      const el = await fixture({ columns, data: people(ROWS) });
      await focusFirstBodyCell(el);
      await key(el, 'End', { ctrlKey: true });
      expect(focusedRow(el)).toEqual({ index: ROWS - 1, inView: true });
      await key(el, 'ArrowUp');
      expect(focusedRow(el)).toEqual({ index: ROWS - 2, inView: true });
      await key(el, 'Home', { ctrlKey: true });
      expect(focused(el)?.getAttribute('role')).toBe('columnheader');
      await key(el, 'ArrowDown');
      expect(focusedRow(el)).toEqual({ index: 0, inView: true });
    });

    test('keeps the focused row clear of pinned rows', async () => {
      const total: Person = { id: 'total', name: 'Total', age: 0, address: { city: '' } };
      const el = await fixture({
        columns,
        data: people(ROWS),
        pinnedRows: { top: [total], bottom: [{ ...total, id: 'total2' }] },
      });
      shadow(el).querySelector<HTMLElement>('[part~="header-cell"]')?.focus();
      await settle(el);
      await key(el, 'ArrowDown');
      await key(el, 'ArrowDown');
      expect(focusedRow(el, 1, 1)).toEqual({ index: 0, inView: true });
      for (let i = 1; i <= 10; i++) await key(el, 'ArrowDown');
      expect(focusedRow(el, 1, 1)).toEqual({ index: 10, inView: true });
      await key(el, 'PageDown');
      expect(focusedRow(el, 1, 1)?.inView).toBe(true);
      // Ctrl+End goes to the bottom pinned row; ArrowUp to the last body row.
      await key(el, 'End', { ctrlKey: true });
      await key(el, 'ArrowUp');
      expect(focusedRow(el, 1, 1)).toEqual({ index: ROWS - 1, inView: true });
    });

    test('the focused row survives scrolling far away while scaled', async () => {
      const el = await fixture({ columns, data: people(ROWS) });
      await focusFirstBodyCell(el);
      const cell = focused(el);
      await scrollTo(el, scroller(el).scrollHeight / 2);
      expect(focused(el)).toBe(cell);
      // Kept within the capped body.
      expect(scroller(el).scrollHeight).toBeLessThanOrEqual(MAX);
      await key(el, 'ArrowDown');
      expect(focusedRow(el)).toEqual({ index: 1, inView: true });
    });
  });
});
