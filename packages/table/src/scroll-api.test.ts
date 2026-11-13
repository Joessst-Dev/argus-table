import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ArgusTable } from './index.js';
import { setMaxElementHeightForTests } from './max-height.js';
import type { ColumnDef, DataSource } from './types.js';
import { bodyRows, fixture, people, rowText, settle, shadow, type Person } from './test-utils.js';

afterEach(() => {
  setMaxElementHeightForTests(undefined);
  document.body.replaceChildren();
});

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 160, sortable: true, filter: 'text' },
  { id: 'age', header: 'Age', accessor: 'age', width: 80, sortable: true },
  { id: 'city', header: 'City', accessor: 'address.city', width: 120 },
];

const getRowId = (p: Person) => p.id;

const scroller = (el: HTMLElement) => {
  const s = shadow(el).querySelector<HTMLElement>('[part~="table"]');
  if (!s) throw new Error('no scroller');
  return s;
};

const gridRow = (el: HTMLElement, ariaRowIndex: number) => {
  const row = shadow(el).querySelector<HTMLElement>(
    `[role='row'][aria-rowindex="${String(ariaRowIndex)}"]`,
  );
  if (!row) throw new Error(`no row ${String(ariaRowIndex)}`);
  return row.getBoundingClientRect();
};

/** The body's view: below the header (and top pinned rows), above the bottom pinned rows. */
function view(el: HTMLElement, { top = 0, bottom = 0 } = {}) {
  const s = scroller(el);
  const box = s.getBoundingClientRect();
  const header = gridRow(el, 1);
  const start = top > 0 ? gridRow(el, 1 + top).bottom : header.bottom;
  const inner = box.top + s.clientTop + s.clientHeight;
  // The bottom pinned rows sit at the bottom of the view.
  const end = bottom > 0 ? inner - bottom * header.height : inner;
  return { start, end };
}

/**
 * Expects an item from `from` to `to` (px, along one axis) where `align` puts it
 * in a view from `start` to `end`, to the px.
 */
function expectAligned(
  [from, to]: [number, number],
  align: 'start' | 'center' | 'end',
  [start, end]: [number, number],
) {
  const off = { start: from - start, end: to - end, center: (from + to - start - end) / 2 };
  expect(Math.abs(off[align])).toBeLessThan(1);
}

/** A body row's box, by index (no column groups; `top` pinned rows above the body). */
const rowBox = (el: HTMLElement, index: number, top = 0) => gridRow(el, index + 2 + top);

describe('scrollToRow', () => {
  test('puts the row at the top by default, as before, and resolves true', async () => {
    const el = await fixture({ columns, data: people(1000) });
    await expect(el.scrollToRow(500)).resolves.toBe(true);
    expect(rowBox(el, 500).top).toBeCloseTo(view(el).start, 0);
    expect(el.getState().scroll.row).toBe(500);
  });

  test.each(['start', 'center', 'end'] as const)('align %s', async (align) => {
    const el = await fixture({ columns, data: people(1000) });
    await el.scrollToRow(500, { align });
    const row = rowBox(el, 500);
    const { start, end } = view(el);
    expectAligned([row.top, row.bottom], align, [start, end]);
  });

  test("'nearest' doesn't move a row in view, and scrolls the least distance to one that isn't", async () => {
    const el = await fixture({ columns, data: people(1000) });
    await el.scrollToRow(100);
    const top = scroller(el).scrollTop;
    await el.scrollToRow(103, { align: 'nearest' });
    expect(scroller(el).scrollTop).toBe(top);
    // Below the view: it lands at the bottom.
    await el.scrollToRow(300, { align: 'nearest' });
    expect(rowBox(el, 300).bottom).toBeCloseTo(view(el).end, 0);
    // Above: at the top.
    await el.scrollToRow(50, { align: 'nearest' });
    expect(rowBox(el, 50).top).toBeCloseTo(view(el).start, 0);
  });

  test('aligns between the header and pinned rows', async () => {
    const pinned = people(3).map((p) => ({ ...p, id: `pin-${p.id}` }));
    const el = await fixture({
      columns,
      data: people(1000),
      getRowId,
      pinnedRows: { top: pinned.slice(0, 2), bottom: pinned.slice(2) },
    });
    const layout = { top: 2, bottom: 1 };
    await el.scrollToRow(400, { align: 'start' });
    expect(rowBox(el, 400, 2).top).toBeCloseTo(view(el, layout).start, 0);
    await el.scrollToRow(600, { align: 'end' });
    expect(rowBox(el, 600, 2).bottom).toBeCloseTo(view(el, layout).end, 0);
    await el.scrollToRow(800, { align: 'nearest' });
    expect(rowBox(el, 800, 2).bottom).toBeCloseTo(view(el, layout).end, 0);
    // A pinned row's id isn't a body row.
    await expect(el.scrollToRow({ id: 'pin-p0' })).resolves.toBe(false);
  });

  test('scrolls to a row by id, in the current order', async () => {
    const el = await fixture({
      columns,
      data: people(1000),
      getRowId,
      sorting: [{ id: 'name', desc: true }],
    });
    // Descending names: "Person 999" first, so p10 is far down.
    await expect(el.scrollToRow({ id: 'p10' }, { align: 'center' })).resolves.toBe(true);
    const row = bodyRows(el).find((r) => rowText(r)[0] === 'Person 10');
    if (!row) throw new Error('p10 not rendered');
    const box = row.getBoundingClientRect();
    const { start, end } = view(el);
    expect(Math.abs((box.top + box.bottom) / 2 - (start + end) / 2)).toBeLessThan(1);
  });

  test("resolves false for an id that isn't in the rows, and doesn't scroll", async () => {
    const el = await fixture({
      columns,
      data: people(1000),
      getRowId,
      columnFilters: { name: { kind: 'text', op: 'contains', value: 'Person 1' } },
    });
    await el.scrollToRow(20);
    const top = scroller(el).scrollTop;
    await expect(el.scrollToRow({ id: 'nobody' })).resolves.toBe(false);
    // Filtered out.
    await expect(el.scrollToRow({ id: 'p2' })).resolves.toBe(false);
    await expect(el.scrollToRow(-1)).resolves.toBe(false);
    await expect(el.scrollToRow(1.5)).resolves.toBe(false);
    expect(scroller(el).scrollTop).toBe(top);
  });

  test('an index past the last row scrolls to the end and resolves false', async () => {
    const el = await fixture({ columns, data: people(100) });
    await expect(el.scrollToRow(500, { align: 'center' })).resolves.toBe(false);
    expect(rowBox(el, 99).bottom).toBeCloseTo(view(el).end, 0);
  });

  test('aligns a row deep in a scaled body', async () => {
    // 10k rows of 40 px (400k px) render at 100k px.
    setMaxElementHeightForTests(100_000);
    const el = await fixture({ columns, data: people(10_000) });
    for (const align of ['center', 'end', 'start'] as const) {
      await el.scrollToRow(6543, { align });
      const row = rowBox(el, 6543);
      const { start, end } = view(el);
      expectAligned([row.top, row.bottom], align, [start, end]);
    }
  });

  test("with rowHeight: 'auto', lands rows of different heights where asked", async () => {
    const note = (p: Person) => 'word '.repeat(1 + (Number(p.id.slice(1)) % 4) * 9);
    const el = await fixture({
      columns: [...columns, { id: 'note', header: 'Note', cell: note, width: 160, wrap: true }],
      data: people(2000),
      rowHeight: 'auto',
    });
    for (const [index, align] of [
      [1500, 'end'],
      [700, 'center'],
      [1200, 'nearest'],
    ] as const) {
      await el.scrollToRow(index, { align });
      await settle(el);
      const row = rowBox(el, index);
      const { start, end } = view(el);
      if (align === 'center') {
        expect(Math.abs((row.top + row.bottom) / 2 - (start + end) / 2)).toBeLessThan(1);
      } else {
        expect(row.bottom).toBeCloseTo(end, 0);
      }
    }
  });

  describe('with a dataSource', () => {
    function server({ total = true } = {}) {
      const all = people(1000);
      const source: DataSource<Person> = {
        pageSize: 50,
        getRows: ({ start, end }) =>
          Promise.resolve({ rows: all.slice(start, end), total: total ? all.length : undefined }),
      };
      return source;
    }

    test('scrolls to a loaded row by id', async () => {
      const el = await fixture({ columns, dataSource: server(), getRowId });
      await vi.waitFor(() => {
        expect(shadow(el).querySelector('[part~="skeleton"]')).toBeNull();
      });
      await expect(el.scrollToRow({ id: 'p7' }, { align: 'end' })).resolves.toBe(true);
      // Not loaded.
      await expect(el.scrollToRow({ id: 'p900' })).resolves.toBe(false);
    });

    test('without a total, scrolls on toward a row as the rows are counted', async () => {
      const el = await fixture({ columns, dataSource: server({ total: false }) });
      await expect(el.scrollToRow(300, { align: 'center' })).resolves.toBe(false);
      await vi.waitFor(() => {
        const row = rowBox(el, 300);
        const { start, end } = view(el);
        expect(Math.abs((row.top + row.bottom) / 2 - (start + end) / 2)).toBeLessThan(1);
      });
    });

    test("the user's own scrolling stops it", async () => {
      const el = await fixture({ columns, dataSource: server({ total: false }) });
      await el.scrollToRow(300, { align: 'end' });
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true }));
      const reached = el.getState().scroll.row;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await settle(el);
      expect(el.getState().scroll.row).toBe(reached);
    });
  });
});

describe('scrollToColumn', () => {
  /** Twelve columns of 150 px: 1800 px in an 800 px table. */
  const wide = (extra: Partial<ColumnDef<Person>>[] = []): ColumnDef<Person>[] =>
    Array.from({ length: 12 }, (_, i) => ({
      id: `c${String(i)}`,
      header: `C${String(i)}`,
      cell: (p: Person) => `${p.name} ${String(i)}`,
      width: 150,
      ...extra[i],
    }));

  const headerBox = (el: HTMLElement, id: string) => {
    const cell = shadow(el).querySelector(`[role='row'][aria-rowindex="1"] > [data-col="${id}"]`);
    if (!cell) throw new Error(`no header ${id}`);
    return cell.getBoundingClientRect();
  };

  /** The scrolling area between the pinned columns, in viewport x. */
  function area(el: HTMLElement, pinStart = 0, pinEnd = 0) {
    const s = scroller(el);
    const box = s.getBoundingClientRect();
    const left = box.left + s.clientLeft;
    const right = left + s.clientWidth;
    const rtl = getComputedStyle(el).direction === 'rtl';
    return rtl
      ? { left: left + pinEnd, right: right - pinStart }
      : { left: left + pinStart, right: right - pinEnd };
  }

  async function table(props: Partial<ArgusTable<Person>> = {}) {
    return fixture({ columns: wide(), data: people(50), ...props });
  }

  test("'nearest' by default: scrolls only as far as needed, both ways", async () => {
    const el = await table();
    await expect(el.scrollToColumn('c9')).resolves.toBe(true);
    expect(headerBox(el, 'c9').right).toBeCloseTo(area(el).right, 0);
    const left = scroller(el).scrollLeft;
    // In view: no scroll.
    await el.scrollToColumn('c8');
    expect(scroller(el).scrollLeft).toBe(left);
    await el.scrollToColumn('c2');
    expect(headerBox(el, 'c2').left).toBeCloseTo(area(el).left, 0);
  });

  test.each(['start', 'center', 'end'] as const)(
    'align %s, between pinned columns',
    async (align) => {
      const el = await table({
        columns: wide([{ pin: 'start' }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, { pin: 'end' }]),
      });
      await el.scrollToColumn('c6', { align });
      const box = headerBox(el, 'c6');
      const { left, right } = area(el, 150, 150);
      expectAligned([box.left, box.right], align, [left, right]);
    },
  );

  test("a pinned column is in view without scrolling; a hidden or unknown one isn't", async () => {
    const el = await table({
      columns: wide([{ pin: 'end' }]),
      columnVisibility: { c3: false },
    });
    await el.scrollToColumn('c5', { align: 'start' });
    const left = scroller(el).scrollLeft;
    await expect(el.scrollToColumn('c0', { align: 'start' })).resolves.toBe(true);
    await expect(el.scrollToColumn('c3')).resolves.toBe(false);
    await expect(el.scrollToColumn('nope')).resolves.toBe(false);
    expect(scroller(el).scrollLeft).toBe(left);
  });

  test('right to left', async () => {
    const el = await table();
    el.dir = 'rtl';
    await settle(el);
    await el.scrollToColumn('c5', { align: 'start' });
    expect(scroller(el).scrollLeft).toBeLessThan(0);
    expect(headerBox(el, 'c5').right).toBeCloseTo(area(el).right, 0);
    await el.scrollToColumn('c11', { align: 'end' });
    expect(headerBox(el, 'c11').left).toBeCloseTo(area(el).left, 0);
  });

  test('flex columns: measured, not taken from their width', async () => {
    // No free space: the flex column is as wide as its minWidth, not its 150 px width.
    const el = await table({
      columns: [
        ...wide().slice(0, 6),
        { id: 'flex', header: 'Flex', accessor: 'name', width: { flex: 1 }, minWidth: 100 },
        ...wide().slice(6),
      ],
    });
    await el.scrollToColumn('flex', { align: 'end' });
    expect(headerBox(el, 'flex').width).toBeCloseTo(100, 0);
    expect(headerBox(el, 'flex').right).toBeCloseTo(area(el).right, 0);
    await el.scrollToColumn('c6', { align: 'start' });
    expect(headerBox(el, 'c6').left).toBeCloseTo(area(el).left, 0);
  });

  test('with virtualizeColumns, a column far out of view renders and lands', async () => {
    const el = await fixture({
      columns: Array.from({ length: 200 }, (_, i) => ({
        id: `c${String(i)}`,
        header: `C${String(i)}`,
        accessor: 'name' as const,
        width: 120,
      })),
      data: people(50),
      virtualizeColumns: true,
    });
    await expect(el.scrollToColumn('c150', { align: 'center' })).resolves.toBe(true);
    await settle(el);
    const box = headerBox(el, 'c150');
    const { left, right } = area(el);
    expect(Math.abs((box.left + box.right) / 2 - (left + right) / 2)).toBeLessThan(1);
  });
});
