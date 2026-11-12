import { afterEach, describe, expect, test, vi } from 'vitest';
import { html } from 'lit';
import type { ArgusTable } from './index.js';
import { setMaxElementHeightForTests } from './max-height.js';
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
  setMaxElementHeightForTests(undefined);
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** 1 to 4 lines of text in a 160 px column: rows of different heights, the same for a row id. */
const note = (p: Person) => 'word '.repeat(1 + (Number(p.id.slice(1)) % 4) * 9);

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 140, sortable: true },
  { id: 'note', header: 'Note', cell: note, width: 160, wrap: true },
  { id: 'age', header: 'Age', accessor: 'age', width: 80, align: 'end' },
];

const scroller = (el: HTMLElement) => {
  const s = shadow(el).querySelector<HTMLElement>('[part~="table"]');
  if (!s) throw new Error('no scroller');
  return s;
};
const body = (el: HTMLElement) => {
  const b = shadow(el).querySelector<HTMLElement>('[part~="body"]');
  if (!b) throw new Error('no body');
  return b;
};
const header = (el: HTMLElement) => shadow(el).querySelector<HTMLElement>('[part~="header"]');
const indexOf = (row: Element | null | undefined, top = 0) =>
  Number(row?.getAttribute('aria-rowindex')) - 2 - top;
const height = (row: Element | undefined) => row?.getBoundingClientRect().height ?? 0;

/** Rendered body rows in order sit one below the other, with no gaps or overlaps. */
function expectFlush(el: HTMLElement) {
  const rows = rowsInOrder(el);
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const row = rows[i];
    if (!prev || !row || indexOf(row) !== indexOf(prev) + 1) continue;
    expect(row.getBoundingClientRect().top).toBeCloseTo(prev.getBoundingClientRect().bottom, 0);
  }
}

/** The body row at the top of the view, just below the header and the top pinned rows. */
function topRow(el: HTMLElement): Element | undefined {
  const s = scroller(el).getBoundingClientRect();
  const below = (header(el)?.getBoundingClientRect().bottom ?? s.top) + 0.5;
  const pinned = shadow(el).querySelector('.pinned[data-side="top"]');
  const edge = Math.max(below, (pinned?.getBoundingClientRect().bottom ?? 0) + 0.5);
  return rowsInOrder(el).find((r) => r.getBoundingClientRect().bottom > edge);
}

async function auto(
  props: Partial<ArgusTable<Person>> = {},
  size?: { width: number; height: number },
) {
  const el = await fixture({ columns, data: people(1000), rowHeight: 'auto', ...props }, size);
  await settle(el);
  return el;
}

describe('rowHeight: auto', () => {
  test('reads row-height="auto", px and nothing else from the attribute', () => {
    const el = document.createElement('argus-table');
    const read = (value: string) => {
      el.setAttribute('row-height', value);
      return el.rowHeight;
    };
    expect(read('auto')).toBe('auto');
    expect(read(' AUTO ')).toBe('auto');
    expect(read('48')).toBe(48);
    expect(read('48px')).toBe(48);
    expect(read('wide')).toBeUndefined();
    expect(read('0')).toBeUndefined();
    expect(read('')).toBeUndefined();
  });

  test('leaves fixed heights alone: no auto rows, wrapped text clipped', async () => {
    const el = await fixture({ columns, data: people(20) });
    expect(scroller(el).hasAttribute('data-auto-rows')).toBe(false);
    expect(rowsInOrder(el).map((r) => Math.round(height(r)))).toEqual(
      rowsInOrder(el).map(() => 40),
    );
  });

  test('one-line rows look as they do with a fixed height', async () => {
    const plain: ColumnDef<Person>[] = [
      { id: 'name', header: 'Name', accessor: 'name', width: 140 },
      { id: 'age', header: 'Age', accessor: 'age', width: 80 },
    ];
    const fixed = await fixture({ columns: plain, data: people(30) });
    const measured = await auto({ columns: plain, data: people(30) });
    const textTop = (el: HTMLElement) => {
      const row = rowsInOrder(el)[3];
      const cell = row?.querySelector('[part~="cell"]');
      const text = cell ? slotted(cell) : undefined;
      return (text?.getBoundingClientRect().top ?? 0) - (row?.getBoundingClientRect().top ?? 0);
    };
    expect(rowsInOrder(measured).map((r) => Math.round(height(r)))).toEqual(
      rowsInOrder(fixed).map((r) => Math.round(height(r))),
    );
    expect(rowsInOrder(measured)[3]?.style.insetBlockStart).toBe('120px');
    expect(textTop(measured)).toBeCloseTo(textTop(fixed), 0);
    expect(scroller(measured).hasAttribute('data-auto-rows')).toBe(true);
  });

  test('grows rows to fit wrapped text, one below the other', async () => {
    const el = await auto();
    const rows = rowsInOrder(el);
    const heights = rows.slice(0, 4).map((r) => Math.round(height(r)));
    // Row 0 is one line; rows 1 to 3 wrap onto more lines, each taller.
    expect(heights[0]).toBe(40);
    expect(heights[1]).toBeGreaterThan(40);
    expect(heights[2]).toBeGreaterThan(heights[1] ?? 0);
    expect(heights[3]).toBeGreaterThan(heights[2] ?? 0);
    expectFlush(el);
    // Cells stretch to their row, so the borders line up.
    const cells = [...(rows[2]?.querySelectorAll('[part~="cell"]') ?? [])];
    expect(cells.map((c) => Math.round(height(c)))).toEqual(cells.map(() => heights[2]));
    // The header keeps its height.
    expect(Math.round(height(header(el) ?? undefined))).toBe(40);
  });

  test('counts rows not measured yet as one row', async () => {
    const el = await auto();
    const rendered = rowsInOrder(el);
    const last = rendered.at(-1);
    const measured = rendered.reduce((sum, r) => sum + height(r), 0);
    const total = measured + (1000 - rendered.length) * 40;
    expect(parseFloat(body(el).style.blockSize)).toBeCloseTo(total, 0);
    expect(indexOf(last)).toBe(rendered.length - 1);
  });

  test('grows a row whose content grows later, and moves the rows below', async () => {
    const box = document.createElement('div');
    box.style.blockSize = '10px';
    const el = await auto({
      columns: [
        { id: 'name', header: 'Name', accessor: 'name', width: 140 },
        { id: 'pic', header: 'Pic', cell: (p) => (p.id === 'p1' ? box : ''), width: 80 },
      ],
      data: people(50),
    });
    expect(Math.round(height(rowsInOrder(el)[1]))).toBe(40);
    box.style.blockSize = '150px';
    await settle(el);
    await settle(el);
    const [, second, third] = rowsInOrder(el);
    expect(Math.round(height(second))).toBeGreaterThanOrEqual(150);
    expect(third?.getBoundingClientRect().top).toBeCloseTo(
      second?.getBoundingClientRect().bottom ?? 0,
      0,
    );
  });

  test('grows a tall template', async () => {
    const el = await auto({
      columns: [
        { id: 'name', header: 'Name', accessor: 'name', width: 140 },
        {
          id: 'tall',
          header: 'Tall',
          cell: (p) => (p.age % 3 === 0 ? html`<div style="block-size: 90px">tall</div>` : 'x'),
          width: 80,
        },
      ],
      data: people(50),
    });
    const rows = rowsInOrder(el);
    expect(Math.round(height(rows[0]))).toBeGreaterThanOrEqual(90);
    expect(Math.round(height(rows[1]))).toBe(40);
    expectFlush(el);
  });

  test('grows pinned rows and keeps the body below them; the header stays one row', async () => {
    const [long] = people(1);
    if (!long) throw new Error('no row');
    const el = await auto({
      data: people(100),
      pinnedRows: { top: [{ ...long, id: 'p3' }], bottom: [{ ...long, id: 'p2' }] },
    });
    const top = shadow(el).querySelector<HTMLElement>('.pinned[data-side="top"]');
    const bottom = shadow(el).querySelector<HTMLElement>('.pinned[data-side="bottom"]');
    expect(height(top ?? undefined)).toBeGreaterThan(40);
    expect(height(bottom ?? undefined)).toBeGreaterThan(40);
    expect(Math.round(height(header(el) ?? undefined))).toBe(40);
    const style = scroller(el).style;
    expect(parseFloat(style.getPropertyValue('--_pin-top-h'))).toBeCloseTo(
      height(top ?? undefined),
      1,
    );
    expect(parseFloat(style.getPropertyValue('--_pin-bottom-h'))).toBeCloseTo(
      height(bottom ?? undefined),
      1,
    );
    // The first body row starts right below the top pinned rows.
    const first = shadow(el).querySelector('[part~="body"] > [aria-rowindex="3"]');
    expect(first?.getBoundingClientRect().top).toBeCloseTo(
      top?.getBoundingClientRect().bottom ?? 0,
      0,
    );
  });

  test('keeps the number of rendered rows while scrolling', async () => {
    const el = await auto();
    const count = rowsInOrder(el).length;
    for (const top of [300, 900, 2500, 1200, 0]) {
      scroller(el).scrollTop = top;
      await settle(el);
      await settle(el);
      expect(rowsInOrder(el).length).toBe(count);
      expectFlush(el);
    }
  });

  test('scrollToRow puts the row at the top, and it stays there as rows above are measured', async () => {
    const el = await auto();
    await el.scrollToRow(500);
    await settle(el);
    expect(indexOf(topRow(el))).toBe(500);
    const headerBottom = header(el)?.getBoundingClientRect().bottom ?? 0;
    expect(topRow(el)?.getBoundingClientRect().top).toBeCloseTo(headerBottom, 0);
    expectFlush(el);
    // Scrolling up through rows not measured yet keeps the content in order.
    for (let i = 0; i < 6; i++) {
      const before = topRow(el);
      const at = before?.getBoundingClientRect().top ?? 0;
      scroller(el).scrollTop -= 150;
      await settle(el);
      await settle(el);
      expectFlush(el);
      const row = rowsInOrder(el).find((r) => r === before);
      // The row that was at the top moved down by the 150 px scrolled.
      if (row) expect(row.getBoundingClientRect().top - at).toBeCloseTo(150, 0);
    }
  });

  test('getState and setState restore the row at the top', async () => {
    const el = await auto();
    await el.scrollToRow(321);
    await settle(el);
    expect(el.getState().scroll.row).toBe(321);
    const other = await auto();
    await other.setState({ scroll: { row: 321, inline: 0 } });
    await settle(other);
    expect(indexOf(topRow(other))).toBe(321);
  });

  test('heights follow rows through a sort', async () => {
    const el = await auto({ data: people(40) }, { width: 800, height: 3000 });
    const total = parseFloat(body(el).style.blockSize);
    const tallId = 'Person 3';
    el.sorting = [{ id: 'name', desc: true }];
    await settle(el);
    // Every row was measured: the body is as tall as before, without re-measuring.
    expect(parseFloat(body(el).style.blockSize)).toBeCloseTo(total, 0);
    const row = rowsInOrder(el).find((r) => {
      const cell = r.querySelector('[part~="cell"]');
      return cell ? slotted(cell)?.textContent === tallId : false;
    });
    expect(Math.round(height(row))).toBeGreaterThan(40);
    expectFlush(el);
  });

  test('a narrower column makes the rendered rows taller', async () => {
    const el = await auto();
    const before = height(rowsInOrder(el)[2]);
    el.columnSizing = { note: 100 };
    await settle(el);
    await settle(el);
    expect(height(rowsInOrder(el)[2])).toBeGreaterThan(before);
    expectFlush(el);
  });

  test('follows the density, and measures again', async () => {
    const el = await auto({
      columns: [{ id: 'name', header: 'Name', accessor: 'name', width: 140 }],
      data: people(50),
    });
    el.density = 'compact';
    await settle(el);
    await settle(el);
    expect(
      rowsInOrder(el)
        .slice(0, 5)
        .map((r) => Math.round(height(r))),
    ).toEqual([32, 32, 32, 32, 32]);
    expect(Math.round(height(header(el) ?? undefined))).toBe(32);
    expect(parseFloat(body(el).style.blockSize)).toBeCloseTo(50 * 32, 0);
  });

  test('switches back to fixed heights and to auto again', async () => {
    const el = await auto({ data: people(50) });
    el.rowHeight = undefined;
    await settle(el);
    expect(scroller(el).hasAttribute('data-auto-rows')).toBe(false);
    expect(parseFloat(body(el).style.blockSize)).toBe(50 * 40);
    expect(rowsInOrder(el)[3]?.style.transform).toBe('translateY(120px)');
    el.rowHeight = 'auto';
    await settle(el);
    await settle(el);
    expect(height(rowsInOrder(el)[3])).toBeGreaterThan(40);
    expectFlush(el);
  });

  test('ArrowDown shows a tall row in full; PageDown moves by the rows that fit', async () => {
    const el = await auto({}, { width: 800, height: 300 });
    const cell = rowsInOrder(el)[0]?.querySelector<HTMLElement>('[part~="cell"]');
    cell?.focus();
    await settle(el);
    const press = async (key: string) => {
      const active = shadow(el).activeElement;
      active?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
      await settle(el);
      await settle(el);
      return shadow(el).activeElement;
    };
    for (let i = 0; i < 4; i++) await press('ArrowDown');
    const focused = shadow(el).activeElement?.closest('[role="row"]');
    expect(indexOf(focused)).toBe(4);
    const box = scroller(el).getBoundingClientRect();
    const rect = focused?.getBoundingClientRect();
    expect(rect?.top).toBeGreaterThanOrEqual(
      (header(el)?.getBoundingClientRect().bottom ?? 0) - 0.5,
    );
    expect(rect?.bottom).toBeLessThanOrEqual(box.top + scroller(el).clientHeight + 0.5);
    const paged = (await press('PageDown'))?.closest('[role="row"]');
    const moved = indexOf(paged) - 4;
    expect(moved).toBeGreaterThanOrEqual(1);
    // Rows 4… are 40 to 160 px tall in a body view of 260 px: fewer than 260 / 40.
    expect(moved).toBeLessThan(6);
  });

  test('a scaled body measures without writing the scroll position, and reaches its end', async () => {
    setMaxElementHeightForTests(100_000);
    const el = await auto({ data: people(10_000) });
    const s = scroller(el);
    s.scrollTop = 40_000;
    await settle(el);
    await settle(el);
    const writes: number[] = [];
    const proto = Element.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'scrollTop');
    vi.spyOn(s, 'scrollTo').mockImplementation(() => writes.push(-1));
    Object.defineProperty(s, 'scrollTop', {
      configurable: true,
      get: () => descriptor?.get?.call(s) as number,
      set: (v: number) => {
        writes.push(v);
        descriptor?.set?.call(s, v);
      },
    });
    // Scroll by setting the offset underneath the spy: new rows render and are measured.
    descriptor?.set?.call(s, 41_000);
    await new Promise(requestAnimationFrame);
    await settle(el);
    await settle(el);
    expect(writes).toEqual([]);
    expectFlush(el);
    Reflect.deleteProperty(s, 'scrollTop');
    vi.restoreAllMocks();
    s.scrollTop = s.scrollHeight;
    await settle(el);
    await settle(el);
    s.scrollTop = s.scrollHeight;
    await settle(el);
    const last = rowsInOrder(el).find((r) => indexOf(r) === 9999);
    expect(last).toBeDefined();
    expect(last?.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      s.getBoundingClientRect().top + s.clientHeight + 1,
    );
  });
  test('rows still loading stay one row tall; loaded rows are measured', async () => {
    const all = people(200);
    let answer: (() => void) | undefined;
    const source: DataSource<Person> = {
      pageSize: 50,
      getRows: ({ start, end }) =>
        new Promise((resolve) => {
          answer = () => {
            resolve({ rows: all.slice(start, end), total: all.length });
          };
        }),
    };
    const el = await auto({ data: undefined, dataSource: source });
    await new Promise((resolve) => setTimeout(resolve, LOAD_DEBOUNCE_MS + 20));
    await settle(el);
    expect(
      rowsInOrder(el)
        .slice(0, 4)
        .map((r) => Math.round(height(r))),
    ).toEqual([40, 40, 40, 40]);
    answer?.();
    await settle(el);
    await settle(el);
    expect(height(rowsInOrder(el)[3])).toBeGreaterThan(40);
    expectFlush(el);
  });

  test('with virtualizeColumns, a tall column scrolling in grows its rows', async () => {
    const many: ColumnDef<Person>[] = Array.from({ length: 40 }, (_, i) => ({
      id: `c${String(i)}`,
      header: `C${String(i)}`,
      width: 100,
      wrap: true,
      cell: (p: Person) => (i === 35 && p.id === 'p1' ? 'word '.repeat(30) : 'x'),
    }));
    const el = await auto({ columns: many, data: people(50), virtualizeColumns: true });
    expect(Math.round(height(rowsInOrder(el)[1]))).toBe(40);
    scroller(el).scrollLeft = 3000;
    await settle(el);
    await settle(el);
    expect(height(rowsInOrder(el)[1])).toBeGreaterThan(40);
    expectFlush(el);
  });

  test('a width: auto column measures its text unwrapped, up to maxWidth, and wraps there', async () => {
    const el = await auto({
      columns: [
        { id: 'name', header: 'Name', accessor: 'name', width: 140 },
        { id: 'note', header: 'Note', cell: note, width: 'auto', maxWidth: 220, wrap: true },
      ],
      data: people(20),
    });
    const noteHeader = shadow(el).querySelector<HTMLElement>(
      '[part~="header-cell"][data-col="note"]',
    );
    expect(Math.round(noteHeader?.getBoundingClientRect().width ?? 0)).toBe(220);
    expect(height(rowsInOrder(el)[3])).toBeGreaterThan(40);
    expectFlush(el);
  });
});
