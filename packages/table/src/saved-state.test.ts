import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ColumnDef, DataSource, SortItem, TableState } from './index.js';
import { setMaxElementHeightForTests } from './max-height.js';
import {
  fixture,
  people,
  rowText,
  rowsInOrder,
  scrollTo,
  settle,
  shadow,
  type Person,
} from './test-utils.js';

afterEach(() => {
  setMaxElementHeightForTests(undefined);
  document.body.replaceChildren();
});

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 160, sortable: true, filter: 'text' },
  { id: 'age', header: 'Age', accessor: 'age', width: 80, sortable: true, filter: 'number' },
  { id: 'city', header: 'City', accessor: 'address.city', width: 120, filter: 'set' },
  { id: 'id', header: 'Id', accessor: 'id', width: 90 },
];

const getRowId = (p: Person) => p.id;

const EVENTS = [
  'argus-sorting-change',
  'argus-column-sizing-change',
  'argus-column-order-change',
  'argus-column-pinning-change',
  'argus-column-visibility-change',
  'argus-column-filters-change',
  'argus-selection-change',
] as const;

/** Records every state event the table fires. */
function events(el: HTMLElement): string[] {
  const seen: string[] = [];
  for (const type of EVENTS) {
    el.addEventListener(type, () => {
      seen.push(type);
    });
  }
  return seen;
}

const scroller = (el: HTMLElement) => {
  const s = shadow(el).querySelector<HTMLElement>('[part~="table"]');
  if (!s) throw new Error('no scroller');
  return s;
};

const headerIds = (el: HTMLElement) =>
  [...shadow(el).querySelectorAll<HTMLElement>('[role="columnheader"]')]
    .sort((a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex))
    .map((h) => h.dataset.col);

const headerOf = (el: HTMLElement, id: string) => {
  const h = shadow(el).querySelector<HTMLElement>(`[role="columnheader"][data-col="${id}"]`);
  if (!h) throw new Error(`no header ${id}`);
  return h;
};

/** The first body row wholly below the header, by its first cell's text. */
function topRowText(el: HTMLElement): string | undefined {
  const s = scroller(el);
  const header = shadow(el).querySelector<HTMLElement>('[part~="header"]');
  const top = (header?.getBoundingClientRect().bottom ?? s.getBoundingClientRect().top) - 0.5;
  const row = rowsInOrder(el).find((r) => r.getBoundingClientRect().top >= top);
  return row ? rowText(row)[0] : undefined;
}

const saved: Required<TableState> = {
  version: 1,
  sorting: [{ id: 'age', desc: true }],
  columnSizing: { name: 200 },
  columnOrder: ['city', 'name', 'age', 'id'],
  columnPinning: { id: 'start' },
  columnVisibility: { age: true, city: false },
  columnFilters: { age: { kind: 'number', op: 'ge', value: 10 } },
  selection: ['p12', 'p13'],
  quickFilter: 'Person 1',
  scroll: { row: 3, inline: 0 },
};

describe('getState()', () => {
  test('returns every key, with the defaults on a fresh table', async () => {
    const el = await fixture({ columns, data: people(100) });
    expect(el.getState()).toEqual({
      version: 1,
      sorting: [],
      columnSizing: {},
      columnOrder: [],
      columnPinning: {},
      columnVisibility: {},
      columnFilters: {},
      selection: [],
      quickFilter: '',
      scroll: { row: 0, inline: 0 },
    });
  });

  test('follows user changes and the values the host set', async () => {
    const el = await fixture({
      columns,
      data: people(100),
      selectionMode: 'multi',
      getRowId,
      columnSizing: { age: 100 },
    });
    shadow(el).querySelector<HTMLElement>('[data-sort-col="name"]')?.click();
    rowsInOrder(el)[1]?.querySelector<HTMLElement>('[part~="cell"]')?.click();
    await settle(el);
    const state = el.getState();
    expect(state.sorting).toEqual([{ id: 'name', desc: false }]);
    expect(state.columnSizing).toEqual({ age: 100 });
    expect(state.selection).toEqual(['p1']);
  });

  test('is a copy: changing it changes nothing in the table', async () => {
    const el = await fixture({ columns, data: people(100), columnSizing: { age: 100 } });
    const state = el.getState();
    state.columnSizing.age = 300;
    (state.sorting as SortItem[]).push({ id: 'name', desc: false });
    expect(el.columnSizing).toEqual({ age: 100 });
    expect(el.sorting).toEqual([]);
  });

  test('reads the row at the top and the inline offset', async () => {
    const wide = columns.map((c) => ({ ...c, width: 400 }));
    const el = await fixture({ columns: wide, data: people(1000) });
    await scrollTo(el, 40 * 25);
    scroller(el).scrollLeft = 150;
    await settle(el);
    expect(el.getState().scroll).toEqual({ row: 25, inline: 150 });
  });

  test('can be saved as JSON', async () => {
    const el = await fixture({ columns, data: people(100) });
    await el.setState(saved);
    const state = el.getState();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('setState()', () => {
  test("restores another table's state", async () => {
    const a = await fixture({ columns, data: people(1000), selectionMode: 'multi', getRowId });
    await a.setState(saved);
    const b = await fixture({ columns, data: people(1000), selectionMode: 'multi', getRowId });
    await b.setState(a.getState());

    expect(b.getState()).toEqual(a.getState());
    expect(headerIds(b)).toEqual(['id', 'name', 'age']);
    expect(headerOf(b, 'name').getBoundingClientRect().width).toBe(200);
    expect(headerOf(b, 'age').getAttribute('aria-sort')).toBe('descending');
    expect(topRowText(b)).toBe(topRowText(a));
  });

  test('applies only the keys given', async () => {
    const el = await fixture({ columns, data: people(100) });
    await el.setState({ columnSizing: { age: 120 } });
    await el.setState({ sorting: [{ id: 'name', desc: true }] });
    expect(el.columnSizing).toEqual({ age: 120 });
    expect(el.sorting).toEqual([{ id: 'name', desc: true }]);
  });

  test('ignores state of another version as a whole', async () => {
    const el = await fixture({ columns, data: people(100) });
    const later = { version: 2, columnSizing: { age: 120 } } as unknown as TableState;
    await el.setState(later);
    expect(el.columnSizing).toEqual({});
  });

  test('takes state without a version, and a scroll without inline, as before', async () => {
    const el = await fixture({ columns, data: people(100) });
    const old = {
      columnSizing: { age: 120 },
      scroll: { row: 4, left: 30 },
    } as unknown as TableState;
    await el.setState(old);
    expect(el.columnSizing).toEqual({ age: 120 });
    expect(el.getState().scroll).toEqual({ row: 4, inline: 0 });
  });

  test('fires no events', async () => {
    const el = await fixture({ columns, data: people(100), selectionMode: 'multi', getRowId });
    const seen = events(el);
    await el.setState(saved);
    await settle(el);
    expect(seen).toEqual([]);
  });

  test('leaves the keys the host controls alone, and they stay controlled', async () => {
    const el = await fixture({
      columns,
      data: people(100),
      sorting: [{ id: 'name', desc: false }],
    });
    await el.setState({ sorting: [{ id: 'age', desc: true }], columnSizing: { age: 120 } });
    expect(el.sorting).toEqual([{ id: 'name', desc: false }]);
    expect(el.columnSizing).toEqual({ age: 120 });

    // Still controlled: a click only proposes.
    const proposed: unknown[] = [];
    el.addEventListener('argus-sorting-change', (e) => {
      proposed.push(e.detail.sorting);
    });
    shadow(el).querySelector<HTMLElement>('[data-sort-col="age"]')?.click();
    await settle(el);
    expect(proposed).toEqual([[{ id: 'age', desc: false }]]);
    expect(el.sorting).toEqual([{ id: 'name', desc: false }]);
  });

  test('keeps keys uncontrolled: user changes still apply', async () => {
    const el = await fixture({ columns, data: people(100) });
    await el.setState({ sorting: [{ id: 'age', desc: false }] });
    shadow(el).querySelector<HTMLElement>('[data-sort-col="name"]')?.click();
    await settle(el);
    expect(el.sorting).toEqual([{ id: 'name', desc: false }]);
  });

  test('keeps its own copy of the state it was given', async () => {
    const el = await fixture({ columns, data: people(100) });
    const state: TableState = { columnSizing: { age: 120 } };
    await el.setState(state);
    if (state.columnSizing) state.columnSizing.age = 300;
    expect(el.columnSizing).toEqual({ age: 120 });
  });

  test('ignores ids of columns that no longer exist', async () => {
    const el = await fixture({ columns, data: people(100) });
    await el.setState({
      sorting: [{ id: 'gone', desc: false }],
      columnSizing: { gone: 300 },
      columnOrder: ['gone', 'id', 'name'],
      columnPinning: { gone: 'start' },
      columnVisibility: { gone: false },
      columnFilters: { gone: { kind: 'text', op: 'contains', value: 'x' } },
    });
    expect(headerIds(el)).toEqual(['id', 'name', 'age', 'city']);
    expect(rowText(rowsInOrder(el)[0] as Element)[1]).toBe('Person 0');
  });

  test('sets the quick filter', async () => {
    const el = await fixture({ columns, data: people(100) });
    await el.setState({ quickFilter: 'Person 42' });
    expect(el.quickFilter).toBe('Person 42');
    expect(rowsInOrder(el).map((r) => rowText(r)[0])).toEqual(['Person 42']);
  });

  test('a restored selection starts a new Shift range', async () => {
    const el = await fixture({ columns, data: people(100), selectionMode: 'multi', getRowId });
    rowsInOrder(el)[1]?.querySelector<HTMLElement>('[part~="cell"]')?.click();
    await settle(el);
    await el.setState({ selection: ['p5'] });
    rowsInOrder(el)[3]
      ?.querySelector<HTMLElement>('[part~="cell"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, shiftKey: true }));
    await settle(el);
    // From no anchor, Shift+click selects the row clicked (not 1 to 3).
    expect(el.selection).toEqual(['p3']);
  });

  test('scrolls the row to the top and restores the horizontal offset', async () => {
    const wide = columns.map((c) => ({ ...c, width: 400 }));
    const el = await fixture({ columns: wide, data: people(1000) });
    await el.setState({ scroll: { row: 120, inline: 200 } });
    expect(topRowText(el)).toBe('Person 120');
    expect(scroller(el).scrollLeft).toBe(200);
    expect(el.getState().scroll).toEqual({ row: 120, inline: 200 });
  });

  test('restores the horizontal offset in RTL', async () => {
    const wide = columns.map((c) => ({ ...c, width: 400 }));
    const el = await fixture({ columns: wide, data: people(100), dir: 'rtl' });
    await el.setState({ scroll: { row: 0, inline: 200 } });
    expect(scroller(el).scrollLeft).toBe(-200);
    expect(el.getState().scroll.inline).toBe(200);
  });

  test('restores the row at the top of a scaled body', async () => {
    // 10k rows of 40 px (400k px) render at 100k px.
    setMaxElementHeightForTests(100_000);
    const el = await fixture({ columns, data: people(10_000) });
    await el.setState({ scroll: { row: 6543, inline: 0 } });
    expect(topRowText(el)).toBe('Person 6543');
    expect(el.getState().scroll.row).toBe(6543);
  });

  describe('with a dataSource', () => {
    /** A server over 1000 people, sorted by name; `total: false` leaves the total out. */
    function server({ total = true } = {}) {
      const all = people(1000);
      const requests: number[] = [];
      const source: DataSource<Person> = {
        pageSize: 50,
        getRows: ({ start, end, sorting }) => {
          requests.push(start);
          const rows = sorting[0]?.desc ? [...all].reverse() : all;
          return Promise.resolve({
            rows: rows.slice(start, end),
            total: total ? all.length : undefined,
          });
        },
      };
      return { source, requests };
    }

    test('scrolls to a row the first pages bring in, after a restored sort', async () => {
      const el = await fixture({ columns, dataSource: server().source });
      await el.setState({ sorting: [{ id: 'name', desc: true }], scroll: { row: 200, inline: 0 } });
      await vi.waitFor(() => {
        expect(el.getState().scroll.row).toBe(200);
        expect(topRowText(el)).toBe('Person 799');
      });
    });

    test('without a total, scrolls on as the rows are counted', async () => {
      const el = await fixture({ columns, dataSource: server({ total: false }).source });
      await el.setState({ scroll: { row: 300, inline: 0 } });
      await vi.waitFor(() => {
        expect(topRowText(el)).toBe('Person 300');
      });
    });

    test("the user's own scrolling wins", async () => {
      const el = await fixture({ columns, dataSource: server({ total: false }).source });
      await el.setState({ scroll: { row: 300, inline: 0 } });
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true }));
      const reached = el.getState().scroll.row;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await settle(el);
      expect(el.getState().scroll.row).toBe(reached);
    });

    // #110: TanStack Virtual keeps the scroll command for a few frames, and the
    // next page arriving within them made it finish the scroll toward the restored
    // row (clamped to the rows counted when it started), after the user took over.
    // A slow frame (as under CI load) lets the debounced page request in first.
    test.each([
      ['wheel', () => new WheelEvent('wheel', { deltaY: 10, bubbles: true })],
      ['pointerdown', () => new PointerEvent('pointerdown', { bubbles: true })],
      ['keydown', () => new KeyboardEvent('keydown', { key: 'Shift', bubbles: true })],
    ])(
      'a %s stops the restore, even when the next page comes before the next frame',
      async (_, input) => {
        const el = await fixture({ columns, dataSource: server({ total: false }).source });
        await el.setState({ scroll: { row: 300, inline: 0 } });
        el.dispatchEvent(input());
        const reached = el.getState().scroll.row;
        const until = performance.now() + 80;
        while (performance.now() < until) {
          // A long frame: the page request (debounced 50 ms) runs before the next one.
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
        await settle(el);
        expect(el.getState().scroll.row).toBe(reached);
      },
    );
  });
});
