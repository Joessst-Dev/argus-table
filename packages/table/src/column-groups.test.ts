import { afterEach, describe, expect, test, vi } from 'vitest';
import { html } from 'lit';
import './argus-column-group.js';
import './argus-column.js';
import type { ArgusTable } from './argus-table.js';
import type { ArgusPlugin, CellTarget } from './plugins.js';
import type { ColumnDef, ColumnGroup, ColumnReorderDetail } from './types.js';
import { fixture, people, settle, shadow, slotted, type Person } from './test-utils.js';

afterEach(() => {
  document.body.replaceChildren();
});

const columns: ColumnDef<Person>[] = [
  { id: 'id', header: 'Id', accessor: 'id', width: 60 },
  { id: 'name', header: 'Name', accessor: 'name', width: 100 },
  { id: 'age', header: 'Age', accessor: 'age', width: 80 },
  { id: 'city', header: 'City', accessor: 'address.city', width: 100 },
  { id: 'note', header: 'Note', width: 90 },
];

// Who: [name, Where: [city]]; More: [age, note]. Order: id | name city | age note.
const groups: ColumnGroup[] = [
  {
    id: 'who',
    header: 'Who',
    columns: ['name', { id: 'where', header: 'Where', columns: ['city'] }],
  },
  { id: 'more', columns: ['age', 'note'] },
];

const rows = (el: HTMLElement) => [...shadow(el).querySelectorAll<HTMLElement>('[role="row"]')];
const groupRows = (el: HTMLElement) => [
  ...shadow(el).querySelectorAll<HTMLElement>('[part~="header-group-row"]'),
];
const groupCell = (el: HTMLElement, id: string, side = 'center') => {
  const cell = shadow(el).querySelector<HTMLElement>(`[data-group-key="g:${side}:${id}"]`);
  if (!cell) throw new Error(`no group cell ${id}`);
  return cell;
};
const header = (el: HTMLElement, id: string) => {
  const h = shadow(el).querySelector<HTMLElement>(`[part~="header-cell"][data-col="${id}"]`);
  if (!h) throw new Error(`no header ${id}`);
  return h;
};
/** Text slotted into a cell, through its slot. */
const text = (cell: Element) => slotted(cell)?.textContent.trim();
/** Each group row as [kind, label, colindex, colspan], in visual order. */
const layout = (el: HTMLElement) =>
  groupRows(el).map((row) =>
    [...row.children].map((c) => [
      c.getAttribute('part'),
      c.getAttribute('role') === 'columnheader' ? text(c) : undefined,
      Number(c.getAttribute('aria-colindex')),
      Number(c.getAttribute('aria-colspan')),
    ]),
  );
const order = (el: HTMLElement) =>
  [...shadow(el).querySelectorAll<HTMLElement>('[part~="header-cell"]')]
    .sort((a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex))
    .map((h) => h.dataset.col);
const press = (target: Element, key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};
const focused = (el: HTMLElement) => shadow(el).activeElement as HTMLElement | null;
/** The focused element; throws when nothing in the table has focus. */
const current = (el: HTMLElement) => {
  const f = focused(el);
  if (!f) throw new Error('nothing focused');
  return f;
};
/** What has focus: a group cell's key, or a column header's or cell's column id. */
const focus = (el: HTMLElement) => {
  const f = focused(el);
  return f?.dataset.groupKey ?? f?.dataset.col;
};

describe('column groups: rendering', () => {
  test('renders a header row per level above the column headers, with fillers', async () => {
    const el = await fixture({ columns, columnGroups: groups, data: people(3) });
    expect(order(el)).toEqual(['id', 'name', 'city', 'age', 'note']);
    expect(layout(el)).toEqual([
      [
        ['header-group-filler', undefined, 1, 1],
        ['header-group-cell', 'Who', 2, 2],
        ['header-group-cell', 'more', 4, 2],
      ],
      [
        ['header-group-filler', undefined, 1, 2],
        ['header-group-cell', 'Where', 3, 1],
        ['header-group-filler', undefined, 4, 2],
      ],
    ]);
    expect(
      rows(el)
        .map((r) => r.getAttribute('aria-rowindex'))
        .slice(0, 4),
    ).toEqual(['1', '2', '3', '4']);
    expect(shadow(el).querySelector('[part~="header-row"]')?.getAttribute('aria-rowindex')).toBe(
      '3',
    );
    // Fillers are empty cells, not headers; groups have no column of their own.
    const filler = shadow(el).querySelector('[part~="header-group-filler"]');
    expect(filler?.getAttribute('role')).toBe('gridcell');
    expect(groupCell(el, 'who').dataset.col).toBeUndefined();
  });

  test('lines group cells up with their columns, and the header grows a row per level', async () => {
    const el = await fixture({ columns, columnGroups: groups, data: people(3) });
    const who = groupCell(el, 'who').getBoundingClientRect();
    const name = header(el, 'name').getBoundingClientRect();
    const city = header(el, 'city').getBoundingClientRect();
    expect(who.left).toBeCloseTo(name.left, 0);
    expect(who.right).toBeCloseTo(city.right, 0);
    expect(who.height).toBeCloseTo(name.height, 0);
    const head = shadow(el).querySelector('[part~="header"]')?.getBoundingClientRect();
    expect(head?.height).toBeCloseTo(name.height * 3, 0);
    // The first body row starts below all three header rows.
    const row = shadow(el).querySelector('[part~="row"][aria-rowindex="4"]');
    expect(row?.getBoundingClientRect().top).toBeCloseTo(head?.bottom ?? 0, 0);
  });

  test('renders no group rows without groups, or when none of their columns shows', async () => {
    const el = await fixture({ columns, data: people(1) });
    expect(groupRows(el)).toHaveLength(0);
    el.columnGroups = [{ id: 'g', columns: ['missing'] }];
    await settle(el);
    expect(groupRows(el)).toHaveLength(0);
    el.columnGroups = [{ id: 'g', header: 'G', columns: ['age'] }];
    el.columnVisibility = { age: false };
    await settle(el);
    expect(groupRows(el)).toHaveLength(0);
    el.columnVisibility = {};
    await settle(el);
    expect(groupRows(el)).toHaveLength(1);
  });

  test('takes function headers and templates, and the id without a header', async () => {
    const el = await fixture({
      columns,
      columnGroups: [
        { id: 'a', header: () => html`<b>Bold</b>`, columns: ['id'] },
        { id: 'b', columns: ['name'] },
      ],
      data: people(1),
    });
    expect(slotted(groupCell(el, 'a'))?.querySelector('b')?.textContent).toBe('Bold');
    expect(text(groupCell(el, 'b'))).toBe('b');
  });

  test('splits a group across pin sides, each part sticky with its columns', async () => {
    const el = await fixture({
      columns,
      columnGroups: [{ id: 'g', header: 'G', columns: ['id', 'name', 'age'] }],
      columnPinning: { id: 'start' },
      data: people(3),
    });
    const start = groupCell(el, 'g', 'start');
    expect(start.dataset.pin).toBe('start');
    expect(start.getAttribute('aria-colspan')).toBe('1');
    expect(groupCell(el, 'g').getAttribute('aria-colspan')).toBe('2');
    const scroller = shadow(el).querySelector<HTMLElement>('[part~="table"]');
    if (!scroller) throw new Error('no scroller');
    el.style.inlineSize = '200px';
    await settle(el);
    const before = start.getBoundingClientRect().left;
    scroller.scrollLeft = 150;
    await settle(el);
    expect(start.getBoundingClientRect().left).toBeCloseTo(before, 0);
  });

  test('keeps every group cell rendered with virtualizeColumns, in stable slots', async () => {
    const many: ColumnDef<Person>[] = Array.from({ length: 60 }, (_, i) => ({
      id: `c${String(i)}`,
      header: `C${String(i)}`,
      width: 100,
    }));
    const el = await fixture({
      columns: many,
      columnGroups: [
        { id: 'first', header: 'First', columns: many.slice(0, 30).map((c) => c.id) },
        { id: 'second', header: 'Second', columns: many.slice(30).map((c) => c.id) },
      ],
      virtualizeColumns: true,
      data: people(5),
    });
    const slots = () => [...el.querySelectorAll('[slot^="g-"]')].map((s) => s.slot);
    expect(slots()).toEqual(['g-1', 'g-4']);
    const scroller = shadow(el).querySelector<HTMLElement>('[part~="table"]');
    if (!scroller) throw new Error('no scroller');
    scroller.scrollLeft = 3500;
    await settle(el);
    expect(slots()).toEqual(['g-1', 'g-4']);
    // The wide group's label stays in view while its columns scroll past.
    const label = groupCell(el, 'second').querySelector('.group-label')?.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    expect(label?.left).toBeGreaterThanOrEqual(view.left);
    expect(label?.right).toBeLessThanOrEqual(view.right);
  });

  test('puts rows pinned to the top below every header row', async () => {
    const el = await fixture({
      columns,
      columnGroups: groups,
      data: people(50),
      pinnedRows: { top: people(1) },
    });
    const head = shadow(el).querySelector('[part~="header"]')?.getBoundingClientRect();
    const pinned = shadow(el).querySelector('[part~="row-pinned-top"]')?.getBoundingClientRect();
    expect(pinned?.top).toBeCloseTo(head?.bottom ?? 0, 0);
    const scroller = shadow(el).querySelector<HTMLElement>('[part~="table"]');
    if (!scroller) throw new Error('no scroller');
    scroller.scrollTop = 500;
    await settle(el);
    const after = shadow(el).querySelector('[part~="row-pinned-top"]')?.getBoundingClientRect();
    expect(after?.top).toBeCloseTo(head?.bottom ?? 0, 0);
  });

  test('measures auto widths from the columns, not from wide group labels', async () => {
    const el = await fixture({
      columns: [
        { id: 'a', header: 'A', accessor: () => 'x', width: 'auto' },
        ...columns.slice(1, 2),
      ],
      columnGroups: [{ id: 'g', header: 'A very long group label indeed', columns: ['a'] }],
      data: people(3),
    });
    expect(header(el, 'a').getBoundingClientRect().width).toBeLessThan(100);
  });
});

describe('column groups: keyboard', () => {
  test('ArrowUp climbs to the groups over a column and ArrowDown comes back to it', async () => {
    const el = await fixture({ columns, columnGroups: groups, data: people(5) });
    header(el, 'city').focus();
    press(header(el, 'city'), 'ArrowUp');
    await settle(el);
    expect(focus(el)).toBe('g:center:where');
    press(current(el), 'ArrowUp');
    await settle(el);
    expect(focus(el)).toBe('g:center:who');
    // At the top it stays.
    press(current(el), 'ArrowUp');
    await settle(el);
    expect(focus(el)).toBe('g:center:who');
    press(current(el), 'ArrowDown');
    await settle(el);
    expect(focus(el)).toBe('g:center:where');
    press(current(el), 'ArrowDown');
    await settle(el);
    expect(focus(el)).toBe('city');
    // Over 'name' the second row is a filler: up goes straight to 'who', down back to 'name'.
    header(el, 'name').focus();
    press(header(el, 'name'), 'ArrowUp');
    await settle(el);
    expect(focus(el)).toBe('g:center:who');
    press(current(el), 'ArrowDown');
    await settle(el);
    expect(focus(el)).toBe('name');
    // Over 'id' there is no group: ArrowUp stays.
    header(el, 'id').focus();
    press(header(el, 'id'), 'ArrowUp');
    await settle(el);
    expect(focus(el)).toBe('id');
  });

  test('keeps a single tab stop across header rows', async () => {
    const el = await fixture({ columns, columnGroups: groups, data: people(5) });
    header(el, 'city').focus();
    press(header(el, 'city'), 'ArrowUp');
    await settle(el);
    expect([...shadow(el).querySelectorAll('[tabindex="0"]')]).toEqual([groupCell(el, 'where')]);
  });

  test('Left, Right, Home and End move between groups of a row, skipping fillers', async () => {
    const el = await fixture({ columns, columnGroups: groups, data: people(5) });
    groupCell(el, 'who').focus();
    press(groupCell(el, 'who'), 'ArrowRight');
    await settle(el);
    expect(focus(el)).toBe('g:center:more');
    press(current(el), 'ArrowRight');
    await settle(el);
    expect(focus(el)).toBe('g:center:more');
    press(current(el), 'Home');
    await settle(el);
    expect(focus(el)).toBe('g:center:who');
    press(current(el), 'End');
    await settle(el);
    expect(focus(el)).toBe('g:center:more');
    // Down from a group goes to its first column after a move along the row.
    press(current(el), 'ArrowDown');
    await settle(el);
    expect(focus(el)).toBe('age');
  });

  test('PageDown goes into the body; Ctrl+Home goes to the top header of the first column', async () => {
    const el = await fixture({
      columns,
      columnGroups: [{ id: 'g', header: 'G', columns: ['id', 'name'] }],
      data: people(100),
    });
    groupCell(el, 'g').focus();
    press(groupCell(el, 'g'), 'PageDown');
    await settle(el);
    const cell = focused(el);
    expect(cell?.getAttribute('role')).toBe('gridcell');
    expect(cell?.dataset.col).toBe('id');
    press(current(el), 'Home', { ctrlKey: true });
    await settle(el);
    expect(focus(el)).toBe('g:center:g');
  });

  test('Enter and Space on a group neither sort nor move', async () => {
    const el = await fixture({
      columns: columns.map((c) => ({ ...c, sortable: true })),
      columnGroups: groups,
      data: people(5),
    });
    groupCell(el, 'who').focus();
    expect(press(groupCell(el, 'who'), 'Enter').defaultPrevented).toBe(true);
    press(groupCell(el, 'who'), ' ');
    groupCell(el, 'who').click();
    await settle(el);
    expect(el.sorting).toEqual([]);
  });

  test('moves to the column header when the focused group goes away', async () => {
    const el = await fixture({ columns, columnGroups: groups, data: people(5) });
    header(el, 'city').focus();
    press(header(el, 'city'), 'ArrowUp');
    await settle(el);
    expect(focus(el)).toBe('g:center:where');
    el.columnGroups = [];
    await settle(el);
    expect(focus(el)).toBe('city');
    expect(shadow(el).querySelector('[part~="header-row"]')?.getAttribute('aria-rowindex')).toBe(
      '1',
    );
  });

  test('stays on a column header when group rows come and go above it', async () => {
    const el = await fixture({ columns, data: people(5) });
    header(el, 'age').focus();
    el.columnGroups = groups;
    await settle(el);
    expect(header(el, 'age').tabIndex).toBe(0);
    press(header(el, 'age'), 'ArrowDown');
    await settle(el);
    expect(focused(el)?.getAttribute('role')).toBe('gridcell');
    expect(focused(el)?.parentElement?.getAttribute('aria-rowindex')).toBe('4');
  });
});

describe('column groups: moving', () => {
  const altShift = (key: string) => ({ altKey: true, shiftKey: true, key });
  const opts = { bubbles: true, composed: true, pointerId: 1, button: 0 };

  test('Alt+Shift+Arrow moves a group as a block, with groupId in the event', async () => {
    const el = await fixture({ columns, columnGroups: groups, data: people(3) });
    const seen: ColumnReorderDetail[] = [];
    el.addEventListener('argus-column-reorder', (e) => seen.push(e.detail));
    groupCell(el, 'more').focus();
    const left = altShift('ArrowLeft');
    press(groupCell(el, 'more'), left.key, left);
    await settle(el);
    expect(order(el)).toEqual(['id', 'age', 'note', 'name', 'city']);
    expect(seen).toEqual([
      { columnId: 'age', groupId: 'more', order: ['id', 'age', 'note', 'name', 'city'] },
    ]);
    // Focus follows the group.
    expect(focus(el)).toBe('g:center:more');
    const region = document.querySelector('[data-argus-announcer]');
    await vi.waitFor(() => {
      expect(region?.textContent).toBe('more moved to columns 2 to 3 of 5');
    });
  });

  test('a column moves only within its innermost group', async () => {
    const el = await fixture({ columns, columnGroups: groups, data: people(3) });
    header(el, 'note').focus();
    const left = altShift('ArrowLeft');
    press(header(el, 'note'), left.key, left);
    await settle(el);
    expect(order(el)).toEqual(['id', 'name', 'city', 'note', 'age']);
    // At the start of 'more' it stays put.
    press(header(el, 'note'), left.key, left);
    await settle(el);
    expect(order(el)).toEqual(['id', 'name', 'city', 'note', 'age']);
    // 'city' is alone in 'where': it can't move at all.
    press(header(el, 'city'), left.key, left);
    await settle(el);
    expect(order(el)).toEqual(['id', 'name', 'city', 'note', 'age']);
  });

  test('keeps a group together in a columnOrder that splits it', async () => {
    const el = await fixture({
      columns,
      columnGroups: groups,
      columnOrder: ['age', 'id', 'note', 'name', 'city'],
      data: people(3),
    });
    expect(order(el)).toEqual(['age', 'note', 'id', 'name', 'city']);
  });

  test('drags a group header past another group', async () => {
    const el = await fixture({ columns, columnGroups: groups, data: people(3) });
    const cell = groupCell(el, 'who');
    const r = cell.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const start = r.left + 10;
    const end = groupCell(el, 'more').getBoundingClientRect().right - 5;
    cell.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: start, clientY: y }));
    cell.dispatchEvent(
      new PointerEvent('pointermove', { ...opts, clientX: start + 10, clientY: y }),
    );
    await new Promise(requestAnimationFrame);
    cell.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: end, clientY: y }));
    await new Promise(requestAnimationFrame);
    await settle(el);
    expect(groupCell(el, 'who').getAttribute('part')).toContain('header-group-cell-dragging');
    expect(header(el, 'name').getAttribute('part')).toContain('header-cell-dragging');
    expect(groupCell(el, 'more').querySelector('[part~="drop-indicator"]')).not.toBeNull();
    cell.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: end, clientY: y }));
    await settle(el);
    expect(order(el)).toEqual(['id', 'age', 'note', 'name', 'city']);
  });
});

describe('column groups: plugins and children', () => {
  test('plugins see the column headers as row 0 and never a group cell', async () => {
    const targets: (CellTarget | undefined)[] = [];
    const spy: ArgusPlugin<Person> = {
      name: 'spy',
      keydown: (_event, target) => {
        targets.push(target);
        return false;
      },
    };
    const el = await fixture({ columns, columnGroups: groups, plugins: [spy], data: people(3) });
    press(header(el, 'name'), 'x');
    press(groupCell(el, 'who'), 'x');
    expect(targets).toEqual([
      { section: 'header', columnId: 'name', rowIndex: 0, rowId: undefined },
    ]);
  });

  async function declarative(markup: string): Promise<ArgusTable> {
    const el = document.createElement('argus-table');
    el.innerHTML = markup;
    el.style.inlineSize = '800px';
    el.style.blockSize = '300px';
    document.body.append(el);
    await settle(el);
    return el;
  }

  test('reads nested <argus-column-group> children', async () => {
    const el = await declarative(`
      <argus-column column-id="id" header="Id"></argus-column>
      <argus-column-group group-id="who" header="Who">
        <argus-column column-id="first" header="First"></argus-column>
        <argus-column-group group-id="where" header="Where">
          <argus-column column-id="city" header="City"></argus-column>
        </argus-column-group>
      </argus-column-group>`);
    expect(order(el)).toEqual(['id', 'first', 'city']);
    expect(layout(el)).toEqual([
      [
        ['header-group-filler', undefined, 1, 1],
        ['header-group-cell', 'Who', 2, 2],
      ],
      [
        ['header-group-filler', undefined, 1, 2],
        ['header-group-cell', 'Where', 3, 1],
      ],
    ]);
  });

  test('follows changes to groups and the columns inside them', async () => {
    const el = await declarative(`
      <argus-column-group group-id="g" header="G">
        <argus-column column-id="a" header="A"></argus-column>
      </argus-column-group>`);
    const group = el.querySelector('argus-column-group');
    if (!group) throw new Error('no group');
    group.header = 'Renamed';
    await settle(el);
    expect(text(groupCell(el, 'g'))).toBe('Renamed');
    const b = document.createElement('argus-column');
    b.columnId = 'b';
    b.header = 'B';
    group.append(b);
    await settle(el);
    expect(order(el)).toEqual(['a', 'b']);
    expect(groupCell(el, 'g').getAttribute('aria-colspan')).toBe('2');
    b.header = 'Bee';
    await settle(el);
    expect(text(header(el, 'b'))).toBe('Bee');
    group.remove();
    await settle(el);
    expect(order(el)).toEqual([]);
  });

  test('a columnGroups property wins over group children, and columns turns them all off', async () => {
    const el = await declarative(`
      <argus-column-group group-id="g" header="G">
        <argus-column column-id="a" header="A"></argus-column>
        <argus-column column-id="b" header="B"></argus-column>
      </argus-column-group>`);
    el.columnGroups = [{ id: 'other', header: 'Other', columns: ['b'] }];
    await settle(el);
    expect(text(groupCell(el, 'other'))).toBe('Other');
    expect(shadow(el).querySelector('[data-group-key="g:center:g"]')).toBeNull();
    el.columnGroups = [];
    el.columns = [{ id: 'a', header: 'A' }];
    await settle(el);
    expect(groupRows(el)).toHaveLength(0);
  });
});
