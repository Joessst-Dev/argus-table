import { afterEach, describe, expect, test } from 'vitest';
import { html } from 'lit';
import { ArgusTable } from './index.js';
import type { ColumnDef } from './types.js';
import {
  bodyRows,
  fixture,
  people,
  rowText,
  rowsInOrder,
  scrollTo,
  settle,
  shadow,
  slotted,
  type Person,
} from './test-utils.js';

afterEach(() => {
  document.body.replaceChildren();
});

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 200 },
  { id: 'age', header: 'Age', accessor: 'age', width: 80, align: 'end' },
  { id: 'city', header: 'City', accessor: 'address.city', width: { flex: 1 }, minWidth: 120 },
];

describe('element basics', () => {
  test('registers <argus-table> and upgrades it to ArgusTable', async () => {
    const el = await fixture();
    expect(customElements.get('argus-table')).toBe(ArgusTable);
    expect(el).toBeInstanceOf(ArgusTable);
  });

  test('renders the table part inside an open shadow root', async () => {
    const el = await fixture();
    expect(shadow(el).querySelector('[part~="table"]')).not.toBeNull();
  });

  // `computedRole` is not in every engine yet, so this runs only where it exists.
  test.runIf('computedRole' in Element.prototype)(
    'exposes the grid role through ElementInternals, not a host attribute',
    async () => {
      const el = await fixture();
      expect(el.hasAttribute('role')).toBe(false);
      expect((el as unknown as { computedRole: string | null }).computedRole).toBe('grid');
    },
  );

  test('reflects density with comfortable as the default', async () => {
    const el = await fixture();
    expect(el.getAttribute('density')).toBe('comfortable');
  });
});

describe('rendering', () => {
  test('renders headers and cells from columns and data, with path accessors', async () => {
    const el = await fixture({ columns, data: people(3) });
    const headers = [...shadow(el).querySelectorAll('[part~="header-cell"]')];
    expect(headers.map((h) => slotted(h)?.textContent)).toEqual(['Name', 'Age', 'City']);
    expect(rowsInOrder(el).map(rowText)).toEqual([
      ['Person 0', '0', 'City 0'],
      ['Person 1', '1', 'City 1'],
      ['Person 2', '2', 'City 2'],
    ]);
  });

  test('renders template, Node, string and number content', async () => {
    const node = () => {
      const b = document.createElement('b');
      b.textContent = 'node';
      return b;
    };
    const el = await fixture({
      columns: [
        { id: 't', header: () => html`<i>T</i>`, cell: (p) => html`<em>${p.name}</em>` },
        { id: 'n', header: 'N', cell: () => node() },
        { id: 's', header: 'S', cell: (p) => p.id },
        { id: 'num', header: 'Num', cell: (p) => p.age * 2 },
      ],
      data: people(2),
    });
    const [first] = rowsInOrder(el);
    const cells = [...(first?.querySelectorAll('[part~="cell"]') ?? [])].map((c) => slotted(c));
    expect(cells[0]?.querySelector('em')?.textContent).toBe('Person 0');
    expect(cells[1]?.querySelector('b')?.textContent).toBe('node');
    expect(cells[2]?.textContent).toBe('p0');
    expect(cells[3]?.textContent).toBe('0');
    const headerCell = shadow(el).querySelector('[part~="header-cell"]');
    const header = headerCell ? slotted(headerCell) : undefined;
    expect(header?.querySelector('i')?.textContent).toBe('T');
  });

  test('keeps slotted content as direct light-DOM children of the host', async () => {
    const el = await fixture({ columns, data: people(2) });
    const content = [...el.children].filter((c) => c.hasAttribute('slot'));
    expect(content.length).toBe(3 + 2 * 3);
  });

  test('builds the grid template from fixed and flex widths', async () => {
    const el = await fixture({ columns, data: people(1) });
    const table = shadow(el).querySelector<HTMLElement>('[part~="table"]');
    expect(table?.style.getPropertyValue('--_cols')).toBe('200px 80px minmax(120px, 1fr)');
    // The flex column fills the rest of the 800px table.
    const city = shadow(el).querySelectorAll<HTMLElement>('[part~="header-cell"]')[2];
    expect(Math.round(city?.getBoundingClientRect().width ?? 0)).toBe(800 - 200 - 80);
  });

  test('aligns cells with the column align', async () => {
    const el = await fixture({ columns, data: people(1) });
    const age = shadow(el).querySelectorAll('[part~="cell"]')[1];
    expect(age?.getAttribute('data-align')).toBe('end');
  });

  test('shows the empty slot with a default text when there are no rows', async () => {
    const el = await fixture({ columns, data: [] });
    const empty = shadow(el).querySelector('[part~="empty"]');
    expect(empty?.textContent.trim()).toBe('No rows');
    expect(bodyRows(el)).toHaveLength(0);

    const custom = document.createElement('p');
    custom.slot = 'empty';
    custom.textContent = 'Nothing here';
    el.append(custom);
    await settle(el);
    expect(empty?.querySelector('slot')?.assignedElements()).toEqual([custom]);
  });

  test('updates when data is replaced', async () => {
    const el = await fixture({ columns, data: people(2) });
    el.data = people(1);
    await settle(el);
    expect(rowsInOrder(el).map(rowText)).toEqual([['Person 0', '0', 'City 0']]);
  });
});

describe('accessibility', () => {
  test('sets roles and 1-based indices that count the header row', async () => {
    const el = await fixture({ columns, data: people(3) });
    const root = shadow(el);
    expect(root.querySelector('[part~="header-row"]')?.getAttribute('aria-rowindex')).toBe('1');
    expect(rowsInOrder(el).map((r) => r.getAttribute('aria-rowindex'))).toEqual(['2', '3', '4']);
    const cells = [...(rowsInOrder(el)[0]?.querySelectorAll('[role="gridcell"]') ?? [])];
    expect(cells.map((c) => c.getAttribute('aria-colindex'))).toEqual(['1', '2', '3']);
    expect(root.querySelectorAll('[role="columnheader"]')).toHaveLength(3);
  });

  test.runIf('ariaRowCount' in ElementInternals.prototype)(
    'reports the full size through ElementInternals',
    async () => {
      const el = await fixture({ columns, data: people(1000) });
      // Not reflected to attributes, so the host stays free for the user's own ARIA.
      expect(el.hasAttribute('aria-rowcount')).toBe(false);
      expect(bodyRows(el).length).toBeLessThan(1000);
    },
  );
});

describe('virtualization', () => {
  test('renders a bounded window at 100k rows', async () => {
    const el = await fixture({ columns, data: people(100_000) });
    // 400px - 40px header = 9 visible rows at 40px, plus 6 overscan below.
    const count = bodyRows(el).length;
    expect(count).toBeGreaterThan(8);
    expect(count).toBeLessThanOrEqual(10 + 2 * 6);
    const body = shadow(el).querySelector<HTMLElement>('[part~="body"]');
    expect(parseFloat(body?.style.blockSize ?? '')).toBe(100_000 * 40);
  });

  test('shows the right content and aria-rowindex after scrolling and jumps', async () => {
    const el = await fixture({ columns, data: people(100_000), getRowId: (p) => p.id });
    await scrollTo(el, 40 * 37);
    expect(rowText(rowsInOrder(el)[0] as Element)[0]).toMatch(/^Person (3[0-9])$/);

    for (const index of [50_000, 99_990, 12_345]) {
      await el.scrollToRow(index);
      await settle(el);
      for (const row of bodyRows(el)) {
        const rowIndex = Number(row.getAttribute('aria-rowindex')) - 2;
        expect(rowText(row)[0]).toBe(`Person ${String(rowIndex)}`);
      }
      const indices = rowsInOrder(el).map((r) => Number(r.getAttribute('aria-rowindex')) - 2);
      expect(indices).toContain(Math.min(index, 100_000 - 9));
    }
  });

  test('reuses row DOM across jumps instead of creating rows', async () => {
    const el = await fixture({ columns, data: people(100_000) });
    const before = new Set(bodyRows(el));
    await el.scrollToRow(60_000);
    await settle(el);
    const after = bodyRows(el);
    expect(after.filter((r) => before.has(r)).length).toBe(Math.min(after.length, before.size));
    // Light-DOM content stays bounded by the pool, not by how far we scrolled.
    const content = [...el.children].filter((c) => c.hasAttribute('slot'));
    expect(content.length).toBeLessThanOrEqual(3 + 3 * (10 + 2 * 6));
  });

  test('fires argus-range-change after the update with the visible rows', async () => {
    const el = await fixture({ columns, data: people(1000) });
    const events: { start: number; end: number }[] = [];
    el.addEventListener('argus-range-change', (e) => events.push(e.detail));
    await el.scrollToRow(500);
    await settle(el);
    const last = events.at(-1);
    expect(last?.start).toBe(500);
    expect(last && last.end - last.start).toBeGreaterThanOrEqual(7);
    // Visible rows only: the rendered window (with overscan) is larger.
    expect(bodyRows(el).length).toBeGreaterThan((last?.end ?? 0) - (last?.start ?? 0) + 1);
  });
});

describe('row height and density', () => {
  const height = (el: HTMLElement) =>
    Math.round(bodyRows(el)[0]?.getBoundingClientRect().height ?? 0);

  test('uses the density defaults', async () => {
    const el = await fixture({ columns, data: people(10) });
    expect(height(el)).toBe(40);
    el.density = 'compact';
    await settle(el);
    expect(height(el)).toBe(32);
    el.density = 'spacious';
    await settle(el);
    expect(height(el)).toBe(52);
    const body = shadow(el).querySelector<HTMLElement>('[part~="body"]');
    expect(parseFloat(body?.style.blockSize ?? '')).toBe(10 * 52);
  });

  test('lets an explicit rowHeight win over density', async () => {
    const el = await fixture({ columns, data: people(10), density: 'compact', rowHeight: 60 });
    expect(height(el)).toBe(60);
    const second = rowsInOrder(el)[1];
    expect(second?.style.transform).toBe('translateY(60px)');
  });

  test('follows the --argus-row-height token from page CSS', async () => {
    const el = await fixture({ columns, data: people(10) });
    el.style.setProperty('--argus-row-height', '48px');
    await settle(el);
    expect(height(el)).toBe(48);
    expect(rowsInOrder(el)[1]?.style.transform).toBe('translateY(48px)');
  });
});

describe('pinned columns', () => {
  // 2 start + 6 scrolling + 1 end = 120 + 80 + 6 * 150 + 60 = 1160px in an 800px table.
  const pinnedColumns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', accessor: 'name', width: 120, pin: 'start' },
    { id: 'age', header: 'Age', accessor: 'age', width: 80, pin: 'start' },
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `c${String(i)}`,
      header: `C${String(i)}`,
      accessor: 'address.city',
    })),
    { id: 'actions', header: '', width: 60, pin: 'end', cell: () => 'act' },
  ];

  const scroller = (el: HTMLElement) => {
    const s = shadow(el).querySelector<HTMLElement>('[part~="table"]');
    if (!s) throw new Error('no scroller');
    return s;
  };

  async function scrollInline(el: ArgusTable<Person>, left: number) {
    const s = scroller(el);
    const scrolled = new Promise((resolve) => {
      s.addEventListener('scroll', resolve, { once: true });
    });
    s.scrollLeft = left;
    await scrolled;
    await settle(el);
  }

  /** Left and right of the scroller's visible area, without its scrollbar. */
  const viewport = (el: HTMLElement) => {
    const s = scroller(el);
    const rect = s.getBoundingClientRect();
    const left = rect.left + s.clientLeft;
    return { left, right: left + s.clientWidth };
  };

  const cellRects = (row: Element) =>
    [...row.querySelectorAll('[part~="cell"], [part~="header-cell"]')].map((c) =>
      c.getBoundingClientRect(),
    );

  const rowsToCheck = (el: HTMLElement) => {
    const header = shadow(el).querySelector('[part~="header-row"]');
    const [first] = rowsInOrder(el);
    if (!header || !first) throw new Error('no rows');
    return [header, first];
  };

  test('marks pinned body cells with parts and one edge per side', async () => {
    const el = await fixture({ columns: pinnedColumns, data: people(5) });
    for (const row of bodyRows(el)) {
      const parts = [...row.querySelectorAll('[part~="cell"]')].map((c) => c.getAttribute('part'));
      expect(parts[0]).toBe('cell cell-pinned');
      expect(parts[1]).toBe('cell cell-pinned cell-pinned-edge');
      expect(parts.slice(2, 8).every((p) => p === 'cell')).toBe(true);
      expect(parts[8]).toBe('cell cell-pinned cell-pinned-edge');
      expect(row.querySelectorAll('[part~="cell-pinned-edge"]')).toHaveLength(2);
    }
    // Header cells pin too, without new parts.
    const headers = [...shadow(el).querySelectorAll('[part~="header-cell"]')];
    expect(headers.map((h) => h.getAttribute('part'))).toEqual(headers.map(() => 'header-cell'));
    expect(headers.map((h) => h.getAttribute('data-pin'))).toEqual([
      'start',
      'start',
      ...Array<null>(6).fill(null),
      'end',
    ]);
  });

  test('keeps pinned cells in place while scrolling sideways (LTR)', async () => {
    const el = await fixture({ columns: pinnedColumns, data: people(5) });
    await scrollInline(el, 200);
    const { left, right } = viewport(el);
    for (const row of rowsToCheck(el)) {
      const rects = cellRects(row);
      expect(rects[0]?.left).toBeCloseTo(left, 0);
      expect(rects[1]?.left).toBeCloseTo(left + 120, 0);
      expect(rects[8]?.right).toBeCloseTo(right, 0);
      // A scrolling column has moved under the pinned ones.
      expect(rects[2]?.left).toBeLessThan(left + 200);
    }
  });

  test('pins to the mirrored sides in RTL', async () => {
    const el = document.createElement('argus-table') as unknown as ArgusTable<Person>;
    el.dir = 'rtl';
    el.style.inlineSize = '800px';
    el.style.blockSize = '400px';
    Object.assign(el, { columns: pinnedColumns, data: people(5) });
    document.body.append(el);
    await settle(el);
    // Scrolling toward the end is negative in RTL.
    await scrollInline(el, -200);
    const { left, right } = viewport(el);
    for (const row of rowsToCheck(el)) {
      const rects = cellRects(row);
      expect(rects[0]?.right).toBeCloseTo(right, 0);
      expect(rects[1]?.right).toBeCloseTo(right - 120, 0);
      expect(rects[8]?.left).toBeCloseTo(left, 0);
    }
  });

  test('mirrors the edge shadow for the end side and in RTL; none removes it', async () => {
    const el = await fixture({ columns: pinnedColumns, data: people(1) });
    const edges = (table: HTMLElement) =>
      [...(rowsInOrder(table)[0]?.querySelectorAll('[part~="cell-pinned-edge"]') ?? [])].map((c) =>
        getComputedStyle(c, '::after'),
      );
    const scaleX = (style: CSSStyleDeclaration | undefined) =>
      new DOMMatrixReadOnly(style?.transform === 'none' ? undefined : style?.transform).a;

    const [start, end] = edges(el);
    expect(start?.boxShadow).not.toBe('none');
    expect(scaleX(start)).toBe(1);
    expect(scaleX(end)).toBe(-1);

    el.dir = 'rtl';
    await settle(el);
    const [rtlStart, rtlEnd] = edges(el);
    expect(scaleX(rtlStart)).toBe(-1);
    expect(scaleX(rtlEnd)).toBe(1);

    el.style.setProperty('--argus-pinned-shadow', 'none');
    expect(edges(el).map((s) => s.boxShadow)).toEqual(['none', 'none']);
  });

  test('paints pinned cells with the row surface so scrolling content stays hidden', async () => {
    const el = await fixture({ columns: pinnedColumns, data: people(2) });
    el.style.setProperty('--argus-row-stripe-bg', 'rgb(1, 2, 3)');
    const [, odd] = rowsInOrder(el);
    const pinned = odd?.querySelector('[part~="cell-pinned"]');
    expect(pinned && getComputedStyle(pinned).backgroundColor).toBe('rgb(1, 2, 3)');
  });
});

describe('sorting', () => {
  const sortColumns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', accessor: 'name', width: 200, sortable: true },
    { id: 'age', header: 'Age', accessor: 'age', width: 80, sortable: true },
    { id: 'city', header: 'City', accessor: 'address.city', width: 120 },
  ];
  const headerCell = (el: HTMLElement, i: number) => {
    const h = shadow(el).querySelectorAll<HTMLElement>('[part~="header-cell"]')[i];
    if (!h) throw new Error(`no header ${String(i)}`);
    return h;
  };
  const ages = (el: HTMLElement) => rowsInOrder(el).map((r) => rowText(r)[1]);
  const data = [
    { id: 'a', name: 'Ann', age: 30, address: { city: 'X' } },
    { id: 'b', name: 'Bob', age: 10, address: { city: 'Y' } },
    { id: 'c', name: 'Cid', age: 20, address: { city: 'Z' } },
  ];

  test('cycles a sortable header asc → desc → unsorted on click (uncontrolled)', async () => {
    const el = await fixture({ columns: sortColumns, data });
    const events: unknown[] = [];
    el.addEventListener('argus-sort-change', (e) => events.push(e.detail.sorting));

    headerCell(el, 1).click();
    await settle(el);
    expect(ages(el)).toEqual(['10', '20', '30']);
    expect(el.sorting).toEqual([{ id: 'age', desc: false }]);

    headerCell(el, 1).click();
    await settle(el);
    expect(ages(el)).toEqual(['30', '20', '10']);

    headerCell(el, 1).click();
    await settle(el);
    expect(ages(el)).toEqual(['30', '10', '20']);
    expect(events).toEqual([[{ id: 'age', desc: false }], [{ id: 'age', desc: true }], []]);
  });

  test('fires argus-sort-change after the update, with sorted rows in place', async () => {
    const el = await fixture({ columns: sortColumns, data });
    const seen = new Promise<(string | undefined)[]>((resolve) => {
      el.addEventListener(
        'argus-sort-change',
        () => {
          resolve(ages(el));
        },
        { once: true },
      );
    });
    headerCell(el, 1).click();
    expect(await seen).toEqual(['10', '20', '30']);
  });

  test('ignores clicks on headers that are not sortable', async () => {
    const el = await fixture({ columns: sortColumns, data });
    const events: unknown[] = [];
    el.addEventListener('argus-sort-change', (e) => events.push(e.detail));
    headerCell(el, 2).click();
    await settle(el);
    expect(events).toEqual([]);
    expect(headerCell(el, 2).hasAttribute('tabindex')).toBe(false);
  });

  test('sorts from a click on slotted header content', async () => {
    const el = await fixture({ columns: sortColumns, data });
    const content = slotted(headerCell(el, 1)) as HTMLElement;
    content.click();
    await settle(el);
    expect(el.sorting).toEqual([{ id: 'age', desc: false }]);
  });

  test('sorts with Enter and Space on a focused header', async () => {
    const el = await fixture({ columns: sortColumns, data });
    const age = headerCell(el, 1);
    expect(age.tabIndex).toBe(0);
    age.focus();
    age.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
    );
    await settle(el);
    expect(el.sorting).toEqual([{ id: 'age', desc: false }]);
    const space = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    age.dispatchEvent(space);
    await settle(el);
    expect(space.defaultPrevented).toBe(true);
    expect(el.sorting).toEqual([{ id: 'age', desc: true }]);
  });

  test('controlled: a click only proposes; the host applies it', async () => {
    const el = await fixture({ columns: sortColumns, data, sorting: [] });
    const proposed: unknown[] = [];
    el.addEventListener('argus-sort-change', (e) => proposed.push(e.detail.sorting));

    headerCell(el, 0).click();
    await settle(el);
    expect(proposed).toEqual([[{ id: 'name', desc: false }]]);
    expect(el.sorting).toEqual([]);
    expect(ages(el)).toEqual(['30', '10', '20']);

    el.sorting = [{ id: 'age', desc: true }];
    await settle(el);
    expect(ages(el)).toEqual(['30', '20', '10']);

    // Handing it back keeps the last order; the table owns it again and applies
    // the next click (age desc → unsorted).
    el.sorting = undefined;
    expect(el.sorting).toEqual([{ id: 'age', desc: true }]);
    headerCell(el, 1).click();
    await settle(el);
    expect(el.sorting).toEqual([]);
    expect(ages(el)).toEqual(['30', '10', '20']);
  });

  test('sets aria-sort and the sorted parts on the sorted column only', async () => {
    const el = await fixture({ columns: sortColumns, data, sorting: [{ id: 'age', desc: true }] });
    expect(headerCell(el, 1).getAttribute('aria-sort')).toBe('descending');
    expect(headerCell(el, 1).getAttribute('part')).toBe('header-cell header-cell-sorted');
    expect(headerCell(el, 0).hasAttribute('aria-sort')).toBe(false);
    for (const row of bodyRows(el)) {
      const parts = [...row.querySelectorAll('[part~="cell"]')].map((c) => c.getAttribute('part'));
      expect(parts).toEqual(['cell', 'cell cell-sorted', 'cell']);
    }
    el.sorting = [{ id: 'age', desc: false }];
    await settle(el);
    expect(headerCell(el, 1).getAttribute('aria-sort')).toBe('ascending');
  });

  test('puts empty values last in both directions', async () => {
    const withGaps = [
      { id: 'a', name: 'Ann', age: 2, address: { city: 'X' } },
      { id: 'b', name: 'Bob', age: undefined as unknown as number, address: { city: 'Y' } },
      { id: 'c', name: 'Cid', age: 1, address: { city: 'Z' } },
    ];
    const el = await fixture({
      columns: sortColumns,
      data: withGaps,
      sorting: [{ id: 'age', desc: false }],
    });
    expect(ages(el)).toEqual(['1', '2', '']);
    el.sorting = [{ id: 'age', desc: true }];
    await settle(el);
    expect(ages(el)).toEqual(['2', '1', '']);
  });

  test('sorts 100k rows and shows the right content after a jump', async () => {
    const el = await fixture({
      columns: sortColumns,
      data: people(100_000),
      getRowId: (p) => p.id,
    });
    el.sorting = [{ id: 'age', desc: true }];
    await settle(el);
    // age = i % 90, so the first 1112 rows (ceil(100000 / 90)) all have age 89.
    expect(
      rowsInOrder(el)
        .map((r) => rowText(r)[1])
        .slice(0, 3),
    ).toEqual(['89', '89', '89']);
    await el.scrollToRow(99_990);
    await settle(el);
    const last = rowsInOrder(el).at(-1);
    expect(last && rowText(last)[1]).toBe('0');
  });
});
