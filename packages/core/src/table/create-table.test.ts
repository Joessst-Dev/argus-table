import { describe, expect, it, vi } from 'vitest';
import { sameSelection, toggleBranch, withBranches } from '../state/selection.js';
import type { ColumnDef } from '../types.js';
import {
  createTableModel,
  EXPAND_COLUMN_ID,
  EXPAND_COLUMN_WIDTH,
  SELECTION_COLUMN_ID,
  SELECTION_COLUMN_WIDTH,
  type TableModelOptions,
} from './create-table.js';

interface Person {
  id: string;
  name: string;
  age: number | undefined;
  address: { city: string };
}

const people: Person[] = [
  { id: 'p1', name: 'Cleo', age: 30, address: { city: 'Bonn' } },
  { id: 'p2', name: 'ada', age: undefined, address: { city: 'Aachen' } },
  { id: 'p3', name: 'Bea', age: 9, address: { city: 'Celle' } },
  { id: 'p4', name: 'Dan', age: 41, address: { city: 'Dresden' } },
];

const columns: ColumnDef<Person, string>[] = [
  { id: 'id', accessor: 'id', width: 60, pin: 'start' },
  { id: 'name', accessor: 'name', width: 120, pin: 'start', sortable: true },
  { id: 'age', accessor: 'age', width: 80, sortable: true, align: 'end' },
  { id: 'city', accessor: 'address.city', width: { flex: 1 }, minWidth: 100 },
  { id: 'note', width: 90 },
  { id: 'actions', width: 64, pin: 'end', sortable: true },
];

function model(overrides: Partial<TableModelOptions<Person, string>> = {}) {
  return createTableModel<Person, string>({
    columns,
    data: people,
    getRowId: undefined,
    sorting: [],
    columnSizing: {},
    ...overrides,
  });
}

const column = (id: string) => ({ kind: 'column' as const, id });

const ids = (m: ReturnType<typeof model>) =>
  Array.from({ length: m.rowCount }, (_, i) => m.rowAt(i)?.id);
const names = (m: ReturnType<typeof model>) =>
  Array.from({ length: m.rowCount }, (_, i) => m.valueAt(i, 'name'));

describe('createTableModel: rows and values', () => {
  it('keys rows by index by default', () => {
    expect(ids(model())).toEqual(['0', '1', '2', '3']);
  });

  it('changes rowOrder only when the rows may have moved', () => {
    const m = model();
    const first = m.rowOrder;
    m.update({ columnSizing: { age: 120 } });
    expect(m.rowOrder).toBe(first);
    m.update({ sorting: [{ id: 'name', desc: false }] });
    const sorted = m.rowOrder;
    expect(sorted).not.toBe(first);
    m.update({ columnFilters: { name: { kind: 'text', op: 'contains', value: 'a' } } });
    const filtered = m.rowOrder;
    expect(filtered).not.toBe(sorted);
    m.update({ data: [...people] });
    expect(m.rowOrder).not.toBe(filtered);
    const remote = {
      rowCount: 0,
      entryAt: () => undefined,
      indexOf: () => undefined,
      loadedIds: () => [],
    };
    m.update({ remote });
    expect(m.rowOrder).toBe(remote);
  });

  it('uses getRowId when given', () => {
    expect(ids(model({ getRowId: (p) => p.id }))).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('reads values through accessors, including paths', () => {
    const m = model();
    expect(m.valueAt(0, 'city')).toBe('Bonn');
    expect(m.valueAt(1, 'age')).toBeUndefined();
    expect(m.valueAt(0, 'note')).toBeUndefined();
    expect(m.valueAt(99, 'name')).toBeUndefined();
  });

  it('returns the original row and a cell context', () => {
    const m = model({ getRowId: (p) => p.id });
    expect(m.rowAt(2)).toEqual({ id: 'p3', index: 2, original: people[2] });
    expect(m.cellContext(0, 'city')).toEqual({
      row: people[0],
      rowId: 'p1',
      index: 0,
      columnId: 'city',
      value: 'Bonn',
    });
    expect(m.cellContext(0, 'missing')).toBeUndefined();
  });

  it('follows a new getRowId', () => {
    const m = model();
    const order = m.rowOrder;
    expect(m.indexOf('p3')).toBeUndefined();
    m.update({ getRowId: (p) => p.id });
    expect(m.rowOrder).not.toBe(order);
    expect(m.rowAt(2)?.id).toBe('p3');
    expect(m.indexOf('p3')).toBe(2);
  });

  it('follows new data', () => {
    const m = model();
    m.update({ data: people.slice(0, 2) });
    expect(m.rowCount).toBe(2);
  });
});

describe('createTableModel: columns', () => {
  it('lists columns in visual order with 1-based aria indices', () => {
    const m = model();
    expect(m.columns.map((c) => [c.id, c.colIndex])).toEqual([
      ['id', 1],
      ['name', 2],
      ['age', 3],
      ['city', 4],
      ['note', 5],
      ['actions', 6],
    ]);
  });

  it('computes sticky offsets and one edge per pinned side', () => {
    const m = model();
    const byId = Object.fromEntries(m.columns.map((c) => [c.id, c]));
    expect(byId.id).toMatchObject({ pin: 'start', offset: 0, pinEdge: false });
    expect(byId.name).toMatchObject({ pin: 'start', offset: 60, pinEdge: true });
    expect(byId.actions).toMatchObject({ pin: 'end', offset: 0, pinEdge: true });
    expect(byId.age).toMatchObject({ pin: undefined, offset: 0, pinEdge: false });
    expect(byId.city).toMatchObject({ offset: 80, flex: 1, width: 100 });
    expect(m.columns.filter((c) => c.pinEdge)).toHaveLength(2);
  });

  it('moves end-pinned columns to the end, whatever their position', () => {
    const m = model({
      columns: [{ id: 'actions', pin: 'end', width: 50 }, { id: 'a' }, { id: 'b', pin: 'end' }],
    });
    expect(m.columns.map((c) => c.id)).toEqual(['a', 'actions', 'b']);
    // The last end column sits at the end edge; the first is the edge next to scrolling columns.
    expect(m.columns.map((c) => [c.id, c.offset, c.pinEdge])).toEqual([
      ['a', 0, false],
      ['actions', 150, true],
      ['b', 0, false],
    ]);
  });

  it('carries the column options the renderer needs', () => {
    const age = model().columns.find((c) => c.id === 'age');
    expect(age).toMatchObject({ align: 'end', sortable: true, resizable: true, sorted: false });
    expect(age?.wrap).toBe(false);
  });

  it('carries wrap into the column views, not into the checkbox column', () => {
    const m = model({
      columns: [{ id: 'name', accessor: 'name', wrap: true }],
      selectionColumn: true,
    });
    expect(m.columns.map((c) => [c.id, c.wrap])).toEqual([
      [SELECTION_COLUMN_ID, false],
      ['name', true],
    ]);
  });

  it('carries meta into the column views as given, hidden columns too', () => {
    const meta = { unit: 'kg' };
    const m = model({
      columns: [
        { id: 'name', accessor: 'name', meta },
        { id: 'age', accessor: 'age', hidden: true, meta: { unit: 'years' } },
      ],
      selectionColumn: true,
    });
    expect(m.columns.map((c) => [c.id, c.meta])).toEqual([
      [SELECTION_COLUMN_ID, undefined],
      ['name', meta],
    ]);
    expect(m.columns[1]?.meta).toBe(meta);
    expect(m.allColumns.find((c) => c.id === 'age')?.meta).toEqual({ unit: 'years' });
  });

  it('follows new columns', () => {
    const m = model();
    m.update({ columns: [{ id: 'name', accessor: 'name' }] });
    expect(m.columns.map((c) => c.id)).toEqual(['name']);
    expect(m.totalWidth).toBe(150);
  });
});

describe('createTableModel: selection column', () => {
  const W = SELECTION_COLUMN_WIDTH;

  it('comes first, pinned to the start, and shifts the other columns', () => {
    const m = model({ selectionColumn: true });
    expect(m.columns.map((c) => [c.id, c.colIndex, c.kind])).toEqual([
      [SELECTION_COLUMN_ID, 1, 'selection'],
      ['id', 2, 'data'],
      ['name', 3, 'data'],
      ['age', 4, 'data'],
      ['city', 5, 'data'],
      ['note', 6, 'data'],
      ['actions', 7, 'data'],
    ]);
    const byId = Object.fromEntries(m.columns.map((c) => [c.id, c]));
    expect(byId[SELECTION_COLUMN_ID]).toMatchObject({
      pin: 'start',
      offset: 0,
      pinEdge: false,
      width: W,
      sortable: false,
      resizable: false,
      reorderable: false,
    });
    expect(byId.id).toMatchObject({ offset: W, pinEdge: false });
    expect(byId.name).toMatchObject({ offset: W + 60, pinEdge: true });
    // Scrolling and end-pinned columns keep their offsets.
    expect(byId.city?.offset).toBe(80);
    expect(byId.actions?.offset).toBe(0);
    expect(m.totalWidth).toBe(model().totalWidth + W);
  });

  it('is the start edge when no other column is pinned to the start', () => {
    const m = model({ columns: [{ id: 'a' }, { id: 'b' }], selectionColumn: true });
    expect(m.columns.map((c) => [c.id, c.pinEdge, c.offset])).toEqual([
      [SELECTION_COLUMN_ID, true, 0],
      ['a', false, 0],
      ['b', false, 150],
    ]);
  });

  it('stays out of sorting, sizing, the column order and values', () => {
    const m = model({ selectionColumn: true, getRowId: (p) => p.id });
    expect(m.nextSorting(SELECTION_COLUMN_ID)).toBeUndefined();
    expect(m.nextSizing(SELECTION_COLUMN_ID, 100)).toBeUndefined();
    expect(m.orderOf()).toEqual(['id', 'name', 'age', 'city', 'note', 'actions']);
    expect(m.nextMove(column(SELECTION_COLUMN_ID), 0)).toBeUndefined();
    // Positions in the order don't count it: 'name' moves to the first place.
    expect(m.nextMove(column('name'), 0)).toEqual(['name', 'id', 'age', 'city', 'note', 'actions']);
    expect(m.valueAt(0, SELECTION_COLUMN_ID)).toBeUndefined();
    expect(m.cellContext(0, SELECTION_COLUMN_ID)).toBeUndefined();
  });

  it('comes and goes with the option', () => {
    const m = model();
    m.update({ selectionColumn: true });
    expect(m.columns[0]?.id).toBe(SELECTION_COLUMN_ID);
    m.update({ selectionColumn: false });
    expect(m.columns[0]?.id).toBe('id');
  });

  it('reserves its id', () => {
    const m = model({ columns: [{ id: SELECTION_COLUMN_ID }], selectionColumn: true });
    expect(() => m.columns).toThrow(/reserved/);
  });
});

describe('createTableModel: sorting', () => {
  const base: Person = { id: 'x', name: 'x', age: 0, address: { city: 'x' } };

  it('sorts strings case-insensitively, ascending and descending', () => {
    const m = model();
    m.update({ sorting: [{ id: 'name', desc: false }] });
    expect(names(m)).toEqual(['ada', 'Bea', 'Cleo', 'Dan']);
    m.update({ sorting: [{ id: 'name', desc: true }] });
    expect(names(m)).toEqual(['Dan', 'Cleo', 'Bea', 'ada']);
    m.update({ sorting: [] });
    expect(names(m)).toEqual(['Cleo', 'ada', 'Bea', 'Dan']);
  });

  it('sorts numbers numerically and keeps undefined last both ways', () => {
    const m = model({ sorting: [{ id: 'age', desc: false }] });
    expect(names(m)).toEqual(['Bea', 'Cleo', 'Dan', 'ada']);
    m.update({ sorting: [{ id: 'age', desc: true }] });
    expect(names(m)).toEqual(['Dan', 'Cleo', 'Bea', 'ada']);
  });

  it('reports the sorted direction on the column view', () => {
    const m = model({ sorting: [{ id: 'age', desc: true }] });
    expect(m.columns.find((c) => c.id === 'age')?.sorted).toBe('desc');
    expect(m.columns.find((c) => c.id === 'name')?.sorted).toBe(false);
  });

  it('keeps row ids stable through sorting', () => {
    const m = model({ getRowId: (p) => p.id, sorting: [{ id: 'name', desc: false }] });
    expect(ids(m)).toEqual(['p2', 'p3', 'p1', 'p4']);
    expect(m.rowAt(0)).toMatchObject({ id: 'p2', index: 0 });
  });

  it('finds a row id in the sorted order', () => {
    const m = model({ getRowId: (p) => p.id });
    expect(m.indexOf('p3')).toBe(2);
    m.update({ sorting: [{ id: 'name', desc: false }] });
    expect(m.indexOf('p2')).toBe(0);
    expect(m.indexOf('p3')).toBe(1);
    expect(m.indexOf('nope')).toBeUndefined();
  });

  it('lists every row id as selectable, in the sorted order', () => {
    const m = model({ getRowId: (p) => p.id });
    m.update({ sorting: [{ id: 'name', desc: false }] });
    expect(m.selectableIds()).toEqual(['p2', 'p3', 'p1', 'p4']);
  });

  it('proposes asc → desc → unsorted, one column at a time, without applying it', () => {
    const m = model();
    expect(m.nextSorting('name')).toEqual([{ id: 'name', desc: false }]);
    m.update({ sorting: [{ id: 'name', desc: false }] });
    expect(m.nextSorting('name')).toEqual([{ id: 'name', desc: true }]);
    m.update({ sorting: [{ id: 'name', desc: true }] });
    expect(m.nextSorting('name')).toEqual([]);
    // Another column replaces the current sort.
    expect(m.nextSorting('age')).toEqual([{ id: 'age', desc: false }]);
    // Proposals change nothing until the caller applies them.
    expect(names(m)).toEqual(['Dan', 'Cleo', 'Bea', 'ada']);
  });

  it('refuses to sort columns that are not sortable', () => {
    const m = model();
    expect(m.nextSorting('city')).toBeUndefined();
    expect(m.nextSorting('missing')).toBeUndefined();
  });

  it('sorts 100k rows quickly', () => {
    const data = Array.from({ length: 100_000 }, (_, i) => ({
      id: String(i),
      name: `n${String((i * 7919) % 100_000)}`,
      age: (i * 31) % 97,
      address: { city: 'x' },
    }));
    const m = model({ data });
    const started = performance.now();
    m.update({ sorting: [{ id: 'age', desc: false }] });
    expect(m.rowCount).toBe(100_000);
    expect(m.valueAt(0, 'age')).toBe(0);
    expect(m.valueAt(99_999, 'age')).toBe(96);
    // A guard against a pathological (e.g. quadratic) sort, not a benchmark: that
    // would take minutes on 100k rows. A tight limit fails on slow shared CI
    // runners (1008 ms once against 1000); speed is measured in benchmarks/.
    expect(performance.now() - started).toBeLessThan(5000);
  });

  it('sorts mixed text and numbers naturally', () => {
    const data = ['item10', 'Item2', 'item1'].map((name, i) => ({ ...base, id: String(i), name }));
    const m = model({ data, sorting: [{ id: 'name', desc: false }] });
    expect(names(m)).toEqual(['item1', 'Item2', 'item10']);
  });

  it('sorts dates', () => {
    const when = [new Date(2024, 5, 1), new Date(2023, 0, 1), new Date(2025, 0, 1)];
    const m = createTableModel<{ when: Date }, string>({
      columns: [{ id: 'when', accessor: 'when', sortable: true }],
      data: when.map((d) => ({ when: d })),
      getRowId: undefined,
      sorting: [{ id: 'when', desc: true }],
      columnSizing: {},
    });
    expect([0, 1, 2].map((i) => (m.valueAt(i, 'when') as Date).getFullYear())).toEqual([
      2025, 2024, 2023,
    ]);
  });

  it('keeps equal values in data order both ways', () => {
    const data = [5, 3, 5, 3, 5].map((age, i) => ({ ...base, id: `p${String(i)}`, age }));
    const m = model({ data, getRowId: (p) => p.id, sorting: [{ id: 'age', desc: false }] });
    expect(ids(m)).toEqual(['p1', 'p3', 'p0', 'p2', 'p4']);
    m.update({ sorting: [{ id: 'age', desc: true }] });
    expect(ids(m)).toEqual(['p0', 'p2', 'p4', 'p1', 'p3']);
  });

  it('reads each value once per sort and sorts again only when something changes', () => {
    let reads = 0;
    const data = Array.from({ length: 1000 }, (_, i) => ({ ...base, age: (i * 7) % 13 }));
    const m = createTableModel<Person, string>({
      columns: [
        {
          id: 'age',
          accessor: (p) => {
            reads++;
            return p.age;
          },
          sortable: true,
        },
      ],
      data,
      getRowId: undefined,
      sorting: [],
      columnSizing: {},
    });
    const sorting = [{ id: 'age', desc: false }];
    m.update({ sorting });
    expect(m.valueAt(0, 'age')).toBe(0);
    // One read per row to sort (the sort function is picked from those values),
    // and one for `valueAt`.
    expect(reads).toBe(1000 + 1);
    reads = 0;
    m.update({ sorting });
    m.rowAt(500);
    expect(reads).toBe(0);
  });
});

describe('createTableModel: sizing', () => {
  it('applies resized widths and moves offsets', () => {
    const m = model({ columnSizing: { id: 100 } });
    const byId = Object.fromEntries(m.columns.map((c) => [c.id, c]));
    expect(byId.id?.width).toBe(100);
    expect(byId.name?.offset).toBe(100);
  });

  it('stops flexing a column once it is resized', () => {
    const m = model();
    m.update({ columnSizing: { city: 240 } });
    expect(m.columns.find((c) => c.id === 'city')).toMatchObject({ flex: undefined, width: 240 });
  });

  it('proposes clamped sizes without applying them', () => {
    const m = model({ columns: [{ id: 'a', minWidth: 50, maxWidth: 200 }, { id: 'b' }] });
    expect(m.nextSizing('a', 10)).toEqual({ a: 50 });
    expect(m.nextSizing('a', 999)).toEqual({ a: 200 });
    expect(m.nextSizing('a', 120.4)).toEqual({ a: 120 });
    expect(m.columns[0]?.width).toBe(150);
  });

  it('keeps other columns in the proposal', () => {
    const m = model({ columnSizing: { id: 70 } });
    expect(m.nextSizing('age', 90)).toEqual({ id: 70, age: 90 });
  });

  it('refuses to resize non-resizable columns or to bad widths', () => {
    const m = model({ columns: [{ id: 'a', resizable: false }, { id: 'b' }] });
    expect(m.nextSizing('a', 100)).toBeUndefined();
    expect(m.nextSizing('b', Number.NaN)).toBeUndefined();
    expect(m.nextSizing('missing', 100)).toBeUndefined();
  });

  it('reports the total width', () => {
    expect(model().totalWidth).toBe(60 + 120 + 80 + 100 + 90 + 64);
  });
  describe('auto widths', () => {
    const autoColumns: ColumnDef<Person, string>[] = [
      { id: 'name', accessor: 'name', width: 'auto', minWidth: 50, maxWidth: 300 },
      { id: 'city', accessor: 'address.city', width: 'auto', pin: 'start' },
      { id: 'age', accessor: 'age', width: 80 },
    ];
    const byId = (m: ReturnType<typeof model>) =>
      Object.fromEntries(m.columns.map((c) => [c.id, c]));

    it('uses the default width until measured', () => {
      const m = model({ columns: autoColumns });
      expect(byId(m).name).toMatchObject({ auto: true, width: 150 });
      expect(byId(m).age).toMatchObject({ auto: false, width: 80 });
    });

    it('applies measured widths, clamped to the bounds, and moves offsets', () => {
      const m = model({ columns: autoColumns });
      m.update({ autoWidths: { name: 20, city: 111 } });
      expect(byId(m).name?.width).toBe(50);
      expect(byId(m).city?.width).toBe(111);
      // city is pinned to the start, so it comes first and name starts after it.
      expect(byId(m).name?.offset).toBe(0);
      expect(m.totalWidth).toBe(50 + 111 + 80);
      m.update({ autoWidths: { name: 999, city: 111 } });
      expect(byId(m).name?.width).toBe(300);
    });

    it('lets a resized width win and stops reporting the column as auto', () => {
      const m = model({ columns: autoColumns, autoWidths: { name: 120 } });
      m.update({ columnSizing: { name: 200 } });
      expect(byId(m).name).toMatchObject({ auto: false, width: 200 });
      m.update({ columnSizing: {} });
      expect(byId(m).name).toMatchObject({ auto: true, width: 120 });
    });

    it('ignores widths for columns that are not auto, or unknown', () => {
      const m = model({ columns: autoColumns, autoWidths: { age: 300, missing: 10 } });
      expect(byId(m).age?.width).toBe(80);
      expect(m.totalWidth).toBe(150 + 150 + 80);
    });

    it('keeps measured widths out of the sizing proposals', () => {
      const m = model({ columns: autoColumns, autoWidths: { name: 120 } });
      expect(m.nextSizing('age', 90)).toEqual({ age: 90 });
    });
  });
});

describe('createTableModel: column order', () => {
  const order = (m: ReturnType<typeof model>) => m.columns.map((c) => c.id);

  it('keeps the order of columns, pin groups first and last, until an order is set', () => {
    const m = model();
    expect(m.orderOf()).toEqual(['id', 'name', 'age', 'city', 'note', 'actions']);
    expect(m.columns.every((c) => c.reorderable)).toBe(true);
  });

  it('follows columnOrder within each pin group, with indices and offsets', () => {
    const m = model({ columnOrder: ['note', 'city', 'name', 'age', 'id'] });
    expect(order(m)).toEqual(['name', 'id', 'note', 'city', 'age', 'actions']);
    expect(m.columns.map((c) => c.colIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    const byId = Object.fromEntries(m.columns.map((c) => [c.id, c]));
    expect(byId.name).toMatchObject({ offset: 0, pinEdge: false });
    expect(byId.id).toMatchObject({ offset: 120, pinEdge: true });
    expect(byId.note).toMatchObject({ offset: 0 });
    expect(byId.city).toMatchObject({ offset: 90 });
  });

  it('proposes a move within a pin side and refuses one out of it', () => {
    const m = model();
    expect(m.nextMove(column('note'), 0)).toEqual(['id', 'name', 'note', 'age', 'city', 'actions']);
    expect(m.nextMove(column('id'), 1)).toEqual(['name', 'id', 'age', 'city', 'note', 'actions']);
    expect(m.nextMove(column('age'), -1)).toBeUndefined();
    expect(m.nextMove(column('note'), 3)).toBeUndefined();
    expect(m.nextMove(column('age'), 0)).toBeUndefined();
  });

  it('proposes from a given base order, so moves can compose before an update', () => {
    const m = model();
    const first = m.nextMove(column('note'), 0);
    expect(m.nextMove(column('note'), 1, first)).toEqual([
      'id',
      'name',
      'age',
      'note',
      'city',
      'actions',
    ]);
    expect(m.orderOf(['city'])).toEqual(['id', 'name', 'city', 'age', 'note', 'actions']);
  });

  it('refuses to move a column with reorderable: false, but moves others past it', () => {
    const m = model({ columns: [{ id: 'a', reorderable: false }, { id: 'b' }, { id: 'c' }] });
    expect(m.columns[0]?.reorderable).toBe(false);
    expect(m.nextMove(column('a'), 2)).toBeUndefined();
    expect(m.nextMove(column('c'), 0)).toEqual(['c', 'a', 'b']);
  });

  it('keeps the order for a new columns array and appends new columns to their group', () => {
    const m = model({ columnOrder: ['note', 'age', 'city'] });
    m.update({ columns: [...columns, { id: 'extra' }, { id: 'pin2', pin: 'start' }] });
    expect(order(m)).toEqual(['id', 'name', 'pin2', 'note', 'age', 'city', 'extra', 'actions']);
  });

  it('keeps the row model when only the order changes', () => {
    const m = model({ sorting: [{ id: 'name', desc: false }] });
    const before = m.rowOrder;
    m.update({ columnOrder: ['city'] });
    expect(m.rowOrder).toBe(before);
  });

  it('follows a new columnOrder', () => {
    const m = model();
    const before = m.columns;
    m.update({ columnOrder: ['city'] });
    expect(m.columns).not.toBe(before);
    expect(order(m)).toEqual(['id', 'name', 'city', 'age', 'note', 'actions']);
    m.update({ columnOrder: [] });
    expect(order(m)).toEqual(['id', 'name', 'age', 'city', 'note', 'actions']);
  });
});

describe('createTableModel: column pinning', () => {
  const order = (m: ReturnType<typeof model>) => m.columns.map((c) => [c.id, c.pin]);

  it('pins and unpins through columnPinning, over the columns own pin', () => {
    const m = model({ columnPinning: { age: 'start', name: false, note: 'end' } });
    expect(order(m)).toEqual([
      ['id', 'start'],
      ['age', 'start'],
      ['name', undefined],
      ['city', undefined],
      ['note', 'end'],
      ['actions', 'end'],
    ]);
    const byId = Object.fromEntries(m.columns.map((c) => [c.id, c]));
    expect(byId.age).toMatchObject({ offset: 60, pinEdge: true });
    expect(byId.id).toMatchObject({ pinEdge: false });
    expect(byId.note).toMatchObject({ offset: 64, pinEdge: true });
    expect(byId.actions).toMatchObject({ offset: 0, pinEdge: false });
    expect(byId.name).toMatchObject({ offset: 0 });
  });

  it('keeps columnOrder, which orders each group', () => {
    const m = model({ columnOrder: ['note', 'city', 'age', 'name', 'id'] });
    m.update({ columnPinning: { city: 'start' } });
    expect(m.columns.map((c) => c.id)).toEqual(['city', 'name', 'id', 'note', 'age', 'actions']);
    expect(m.nextMove(column('note'), 1)).toEqual(['city', 'name', 'id', 'age', 'note', 'actions']);
    expect(m.nextMove(column('note'), 2)).toBeUndefined();
  });

  it('gives a pinned flex column a fixed width, and its flex back once unpinned', () => {
    const m = model({ columnPinning: { city: 'start' } });
    expect(m.columns.find((c) => c.id === 'city')).toMatchObject({ flex: undefined, width: 150 });
    m.update({ columnPinning: {} });
    expect(m.columns.find((c) => c.id === 'city')).toMatchObject({ flex: 1, width: 100 });
    // A resized width wins over the pinned width.
    m.update({ columnPinning: { city: 'end' }, columnSizing: { city: 220 } });
    expect(m.columns.find((c) => c.id === 'city')).toMatchObject({ width: 220 });
  });

  it('proposes a pin without applying it', () => {
    const m = model();
    expect(m.nextPinning('age', 'end')).toEqual({ age: 'end' });
    expect(m.nextPinning('id', false)).toEqual({ id: false });
    expect(m.columns.find((c) => c.id === 'age')?.pin).toBeUndefined();
    m.update({ columnPinning: { age: 'end' } });
    expect(m.nextPinning('age', 'start')).toEqual({ age: 'start' });
  });

  it('refuses unknown columns, unchanged pins and columns with pinnable: false', () => {
    const m = model({ columns: [...columns, { id: 'fixed', pinnable: false }] });
    expect(m.nextPinning('zz', 'start')).toBeUndefined();
    expect(m.nextPinning('id', 'start')).toBeUndefined();
    expect(m.nextPinning('age', false)).toBeUndefined();
    expect(m.nextPinning('fixed', 'start')).toBeUndefined();
    expect(m.columns.find((c) => c.id === 'fixed')?.pinnable).toBe(false);
  });

  it('keeps the row model when only the pinning changes', () => {
    const m = model({ sorting: [{ id: 'name', desc: false }] });
    const before = m.rowOrder;
    m.update({ columnPinning: { age: 'start' } });
    expect(m.rowOrder).toBe(before);
  });
});

describe('createTableModel: column visibility', () => {
  const shown = (m: ReturnType<typeof model>) => m.columns.map((c) => c.id);

  it('leaves hidden columns out of the views, with indices and offsets closing up', () => {
    const m = model({ columnVisibility: { name: false, age: false } });
    expect(m.columns.map((c) => [c.id, c.colIndex])).toEqual([
      ['id', 1],
      ['city', 2],
      ['note', 3],
      ['actions', 4],
    ]);
    const byId = Object.fromEntries(m.columns.map((c) => [c.id, c]));
    expect(byId.id).toMatchObject({ offset: 0, pinEdge: true });
    expect(byId.city).toMatchObject({ offset: 0 });
    expect(byId.note).toMatchObject({ offset: 100 });
    expect(m.totalWidth).toBe(60 + 100 + 90 + 64);
  });

  it('hides columns defined as hidden until columnVisibility shows them', () => {
    const m = model({ columns: [{ id: 'a' }, { id: 'b', hidden: true }] });
    expect(shown(m)).toEqual(['a']);
    m.update({ columnVisibility: { b: true } });
    expect(shown(m)).toEqual(['a', 'b']);
  });

  it('lists every column in allColumns, hidden ones marked', () => {
    const m = model({ columnVisibility: { age: false } });
    expect(m.allColumns.map((c) => [c.id, c.hidden, c.colIndex])).toEqual([
      ['id', false, 1],
      ['name', false, 2],
      ['age', true, 0],
      ['city', false, 3],
      ['note', false, 4],
      ['actions', false, 5],
    ]);
    expect(m.allColumns.find((c) => c.id === 'name')).toBe(m.columns[1]);
  });

  it('still sorts by a hidden column and reads its values', () => {
    const m = model({ columnVisibility: { name: false }, sorting: [{ id: 'name', desc: false }] });
    expect(names(m)).toEqual(['ada', 'Bea', 'Cleo', 'Dan']);
    expect(m.cellContext(0, 'name')?.value).toBe('ada');
  });

  it('proposes hiding and showing without applying it', () => {
    const m = model();
    expect(m.nextVisibility('age', true)).toEqual({ age: false });
    expect(shown(m)).toContain('age');
    m.update({ columnVisibility: { age: false } });
    expect(m.nextVisibility('age', false)).toEqual({ age: true });
  });

  it('refuses unknown columns, no change, hideable: false and the last shown column', () => {
    const m = model({ columns: [{ id: 'a', hideable: false }, { id: 'b' }, { id: 'c' }] });
    expect(m.nextVisibility('zz', true)).toBeUndefined();
    expect(m.nextVisibility('b', false)).toBeUndefined();
    expect(m.nextVisibility('a', true)).toBeUndefined();
    m.update({ columnVisibility: { a: false, b: false } });
    // Set by state, a column with hideable: false hides; the user can show it again.
    expect(shown(m)).toEqual(['c']);
    expect(m.nextVisibility('c', true)).toBeUndefined();
    expect(m.nextVisibility('a', false)).toEqual({ a: true, b: false });
  });

  it('moves among the shown columns, keeping hidden ones in place', () => {
    const m = model({ columnVisibility: { city: false } });
    // Shown: id, name, age, note, actions. Moving age to 3 passes note (and city).
    expect(m.nextMove(column('age'), 1)).toEqual(['id', 'name', 'city', 'note', 'age', 'actions']);
    expect(m.nextMove(column('city'), 0)).toBeUndefined();
  });

  it('works with the selection column', () => {
    const m = model({ selectionColumn: true, columnVisibility: { id: false, name: false } });
    expect(m.columns.map((c) => [c.id, c.colIndex, c.pinEdge])).toEqual([
      [SELECTION_COLUMN_ID, 1, true],
      ['age', 2, false],
      ['city', 3, false],
      ['note', 4, false],
      ['actions', 5, true],
    ]);
  });
});

describe('createTableModel: filtering', () => {
  // Bonn (Cleo 30), Aachen (ada –), Celle (Bea 9), Dresden (Dan 41).
  const filterable = columns.map((c) =>
    c.id === 'city'
      ? { ...c, filter: 'set' as const }
      : c.id === 'age'
        ? { ...c, filter: 'number' as const }
        : c.id === 'name'
          ? { ...c, filter: 'text' as const }
          : c,
  );
  const fmodel = (overrides: Partial<TableModelOptions<Person, string>> = {}) =>
    model({ columns: filterable, ...overrides });

  it('keeps the rows every filter passes, with indexes and ids in the filtered order', () => {
    const m = fmodel({ columnFilters: { age: { kind: 'number', op: 'gt', value: 10 } } });
    expect(names(m)).toEqual(['Cleo', 'Dan']);
    expect(m.rowAt(1)).toEqual({ id: '3', index: 1, original: people[3] });
    expect(m.indexOf('3')).toBe(1);
    expect(m.indexOf('2')).toBeUndefined();
    expect(m.selectableIds()).toEqual(['0', '3']);
    expect(m.cellContext(1, 'name')?.index).toBe(1);
  });

  it('sorts the filtered rows', () => {
    const m = fmodel({
      sorting: [{ id: 'name', desc: true }],
      columnFilters: { city: { kind: 'set', values: ['Bonn', 'Aachen', 'Celle'] } },
    });
    expect(names(m)).toEqual(['Cleo', 'Bea', 'ada']);
  });

  it('filters again when the filters, the quick filter or the columns change', () => {
    const m = fmodel();
    expect(m.rowCount).toBe(4);
    m.update({ quickFilter: 'en' });
    // Aachen and Dresden.
    expect(names(m)).toEqual(['ada', 'Dan']);
    m.update({ quickFilter: 'a' });
    expect(names(m)).toEqual(['ada', 'Bea', 'Dan']);
    m.update({ columnFilters: { name: { kind: 'text', op: 'startsWith', value: 'b' } } });
    expect(names(m)).toEqual(['Bea']);
    m.update({ quickFilter: '', columnFilters: {} });
    expect(m.rowCount).toBe(4);
  });

  it('searches only the shown columns with the quick filter', () => {
    const m = fmodel({ quickFilter: 'bonn' });
    expect(names(m)).toEqual(['Cleo']);
    m.update({ columnVisibility: { city: false } });
    expect(m.rowCount).toBe(0);
  });

  it('keeps filtering by a hidden column', () => {
    const m = fmodel({
      columnVisibility: { age: false },
      columnFilters: { age: { kind: 'number', op: 'empty' } },
    });
    expect(names(m)).toEqual(['ada']);
  });

  it('filters by new values when an accessor changes', () => {
    const m = fmodel({ columnFilters: { age: { kind: 'number', op: 'gt', value: 35 } } });
    expect(names(m)).toEqual(['Dan']);
    m.update({
      columns: filterable.map((c) =>
        c.id === 'age' ? { ...c, accessor: (p: Person) => (p.age ?? 0) * 2 } : c,
      ),
    });
    expect(names(m)).toEqual(['Cleo', 'Dan']);
  });

  it('keeps the row model while nothing filtering reads changes', () => {
    let calls = 0;
    const m = fmodel({
      columns: filterable.map((c) =>
        c.id === 'age' ? { ...c, accessor: (p: Person) => (calls++, p.age) } : c,
      ),
      columnFilters: { age: { kind: 'number', op: 'notEmpty' } },
    });
    expect(m.rowCount).toBe(3);
    const after = calls;
    const first = m.rowOrder;
    m.update({ columnSizing: { age: 99 } });
    expect(m.rowOrder).toBe(first);
    expect(calls).toBe(after);
  });

  it('reports which columns filter and are filtered', () => {
    const m = fmodel({ columnFilters: { age: { kind: 'number', op: 'notEmpty' } } });
    const age = m.columns.find((c) => c.id === 'age');
    expect(age?.filter).toBe('number');
    expect(age?.filtered).toBe(true);
    expect(m.columns.find((c) => c.id === 'note')).toMatchObject({
      filter: undefined,
      filtered: false,
    });
  });

  it('proposes filter states', () => {
    const m = fmodel({ columnFilters: { age: { kind: 'number', op: 'notEmpty' } } });
    expect(m.nextFilters('name', { kind: 'text', op: 'contains', value: 'a' })).toEqual({
      age: { kind: 'number', op: 'notEmpty' },
      name: { kind: 'text', op: 'contains', value: 'a' },
    });
    expect(m.nextFilters('age', undefined)).toEqual({});
    // The same filter, a column that can't filter, an unknown one, nothing to clear.
    expect(m.nextFilters('age', { kind: 'number', op: 'notEmpty' })).toBeUndefined();
    expect(m.nextFilters('note', { kind: 'text', op: 'empty' })).toBeUndefined();
    expect(m.nextFilters('zz', undefined)).toBeUndefined();
    expect(m.nextFilters('name', undefined)).toBeUndefined();
    // From another base.
    expect(m.nextFilters('name', { kind: 'text', op: 'empty' }, {})).toEqual({
      name: { kind: 'text', op: 'empty' },
    });
  });

  it('lists the values a set filter offers, under the other filters', () => {
    const m = fmodel({
      columnFilters: {
        city: { kind: 'set', values: ['Bonn'] },
        age: { kind: 'number', op: 'notEmpty' },
      },
    });
    expect(m.filterValues('city')).toEqual({
      values: ['Bonn', 'Celle', 'Dresden'],
      truncated: false,
    });
    expect(m.filterValues('city', 1)).toEqual({ values: ['Bonn'], truncated: true });
    expect(m.filterValues('zz')).toBeUndefined();
  });

  it('lists the indexes of the rows passing the filters, leaving out the except columns', () => {
    const m = fmodel({
      sorting: [{ id: 'name', desc: true }],
      columnFilters: {
        age: { kind: 'number', op: 'gt', value: 10 },
        city: { kind: 'set', values: ['Bonn'] },
      },
    });
    expect(m.indexesPassing()).toEqual([0]);
    expect(m.indexesPassing(['city'])).toEqual([0, 3]);
    expect(m.indexesPassing(['city', 'age'])).toEqual([0, 1, 2, 3]);
  });

  it('leaves the except columns out of the quick filter', () => {
    const m = fmodel({ quickFilter: 'dresden' });
    expect(m.indexesPassing()).toEqual([3]);
    expect(m.indexesPassing(['city'])).toEqual([]);
    // The values a set filter offers still search the column's own text.
    expect(m.filterValues('city')?.values).toEqual(['Dresden']);
  });

  it('offers filterOptions as they are', () => {
    const m = fmodel({
      columns: filterable.map((c) => (c.id === 'city' ? { ...c, filterOptions: ['X', 'Y'] } : c)),
    });
    expect(m.filterValues('city')).toEqual({ values: ['X', 'Y'], truncated: false });
  });

  it('leaves remote rows to their source', () => {
    const m = fmodel({
      remote: {
        rowCount: 5,
        entryAt: () => undefined,
        indexOf: () => undefined,
        loadedIds: () => [],
      },
      columnFilters: { age: { kind: 'number', op: 'gt', value: 100 } },
    });
    expect(m.rowCount).toBe(5);
    expect(m.filterValues('city')).toBeUndefined();
    expect(m.indexesPassing()).toBeUndefined();
  });
});

describe('createTableModel: caching', () => {
  it('keeps the row model when only unrelated options change', () => {
    const m = model();
    const before = m.rowOrder;
    m.update({ columnSizing: { age: 99 } });
    expect(m.rowOrder).toBe(before);
  });

  it('ignores updates that pass the same references', () => {
    const sorting = [{ id: 'name', desc: false }];
    const m = model({ sorting });
    const before = m.columns;
    m.update({ columns, data: people, sorting });
    expect(m.columns).toBe(before);
  });
});

describe('createTableModel: a changed accessor', () => {
  // Same id, new accessor: the values and the sorted order must follow, without
  // new data.
  const withAge = (accessor: ColumnDef<Person, string>['accessor']) =>
    columns.map((c) => (c.id === 'age' ? { ...c, accessor } : c));
  const ages = (m: ReturnType<typeof model>) =>
    Array.from({ length: m.rowCount }, (_, i) => m.valueAt(i, 'age'));

  it('reads the new values', () => {
    const m = model();
    expect(ages(m)).toEqual([30, undefined, 9, 41]);
    m.update({ columns: withAge((p) => (p.age ?? 0) * 2) });
    expect(ages(m)).toEqual([60, 0, 18, 82]);
    expect(m.cellContext(0, 'age')?.value).toBe(60);
  });

  it('sorts by the new values', () => {
    const m = model({ sorting: [{ id: 'age', desc: false }] });
    expect(names(m)).toEqual(['Bea', 'Cleo', 'Dan', 'ada']);
    m.update({ columns: withAge((p) => -(p.age ?? 0)) });
    expect(names(m)).toEqual(['Dan', 'Cleo', 'Bea', 'ada']);
  });

  it('picks the sort function from the new values', () => {
    // Numbers sort numerically (basic); text with digits naturally (alphanumeric).
    const m = model({ sorting: [{ id: 'age', desc: false }] });
    expect(ages(m)).toEqual([9, 30, 41, undefined]);
    const codes: Record<string, string> = { Cleo: 'n5', ada: 'n100', Bea: 'n20', Dan: 'n3' };
    m.update({ columns: withAge((p) => codes[p.name]) });
    // Not 'n100', 'n20', 'n3', 'n5', as comparing the strings would give.
    expect(ages(m)).toEqual(['n3', 'n5', 'n20', 'n100']);
  });

  it('sorts nothing again when the accessor is the same', () => {
    let calls = 0;
    const read = (p: Person) => (calls++, p.age);
    const m = model({ columns: withAge(read), sorting: [{ id: 'age', desc: false }] });
    expect(ages(m)).toEqual([9, 30, 41, undefined]);
    const order = m.rowOrder;
    const after = calls;
    m.update({ columns: withAge(read) });
    expect(m.rowOrder).toBe(order);
    expect(calls).toBe(after);
    expect(ages(m)).toEqual([9, 30, 41, undefined]);
  });
});

describe('createTableModel: remote rows', () => {
  const [cleo, , bea] = people as [Person, Person, Person, Person];
  const remote = (loaded: Record<number, Person>, rowCount = 10) => ({
    rowCount,
    entryAt: (index: number) => {
      const row = loaded[index];
      return row && { id: row.id, row };
    },
    indexOf: (id: string) => {
      const found = Object.entries(loaded).find(([, p]) => p.id === id);
      return found ? Number(found[0]) : undefined;
    },
    loadedIds: () => Object.values(loaded).map((p) => p.id),
  });

  it('lists only the loaded remote rows as selectable', () => {
    const m = model({ remote: remote({ 4: bea, 5: cleo }) });
    expect(m.selectableIds()).toEqual(['p3', 'p1']);
  });

  it('reads rows, ids and values from the remote source, unsorted by the model', () => {
    const m = model({
      remote: remote({ 4: bea, 5: cleo }),
      sorting: [{ id: 'name', desc: false }],
    });
    expect(m.rowCount).toBe(10);
    expect(m.rowAt(4)).toEqual({ id: 'p3', index: 4, original: bea });
    expect(m.rowAt(0)).toBeUndefined();
    expect(m.indexOf('p1')).toBe(5);
    expect(m.valueAt(5, 'city')).toBe('Bonn');
    expect(m.valueAt(0, 'city')).toBeUndefined();
    expect(m.cellContext(4, 'name')).toEqual({
      row: bea,
      rowId: 'p3',
      index: 4,
      columnId: 'name',
      value: 'Bea',
    });
    expect(m.cellContext(1, 'name')).toBeUndefined();
    // Columns still carry the sort state.
    expect(m.columns.find((c) => c.id === 'name')?.sorted).toBe('asc');
  });

  it('goes back to data when remote is unset', () => {
    const m = model({ remote: remote({}) });
    m.update({ remote: undefined });
    expect(ids(m)).toEqual(['0', '1', '2', '3']);
  });
});

describe('createTableModel: pinned rows', () => {
  const totals: Person = { id: 'sum', name: 'Total', age: 80, address: { city: '' } };
  const avg: Person = { id: 'avg', name: 'Average', age: 20, address: { city: '' } };

  it('has none by default', () => {
    const m = model();
    expect(m.pinnedCount('top')).toBe(0);
    expect(m.pinnedCount('bottom')).toBe(0);
    expect(m.pinnedRowAt('top', 0)).toBeUndefined();
  });

  it('keeps pinned rows apart from the data rows, unsorted', () => {
    const m = model({
      pinnedRows: { top: [avg], bottom: [totals, avg] },
      sorting: [{ id: 'name', desc: false }],
    });
    expect(m.rowCount).toBe(4);
    expect(m.pinnedCount('top')).toBe(1);
    expect(m.pinnedCount('bottom')).toBe(2);
    expect(m.pinnedRowAt('bottom', 0)).toEqual({ id: 'bottom-0', index: 0, original: totals });
    expect(m.pinnedRowAt('bottom', 1)?.original).toBe(avg);
    expect(m.pinnedRowAt('bottom', 2)).toBeUndefined();
    expect(m.pinnedRowAt('top', 0)?.id).toBe('top-0');
  });

  it('uses getRowId for pinned rows when given', () => {
    const m = model({ pinnedRows: { bottom: [totals] }, getRowId: (p) => p.id });
    expect(m.pinnedRowAt('bottom', 0)?.id).toBe('sum');
  });

  it('reads values and cell context through the accessors', () => {
    const m = model({ pinnedRows: { bottom: [totals] } });
    expect(m.pinnedValueAt('bottom', 0, 'age')).toBe(80);
    expect(m.pinnedValueAt('bottom', 0, 'note')).toBeUndefined();
    expect(m.pinnedValueAt('bottom', 3, 'age')).toBeUndefined();
    expect(m.pinnedCellContext('bottom', 0, 'name')).toEqual({
      row: totals,
      rowId: 'bottom-0',
      index: 0,
      columnId: 'name',
      value: 'Total',
      pinned: 'bottom',
    });
    expect(m.pinnedCellContext('bottom', 0, 'nope')).toBeUndefined();
    expect(m.pinnedCellContext('top', 0, 'name')).toBeUndefined();
  });

  it('works with remote rows too', () => {
    const m = model({
      remote: {
        rowCount: 50,
        entryAt: () => undefined,
        indexOf: () => undefined,
        loadedIds: () => [],
      },
      pinnedRows: { top: [totals] },
    });
    expect(m.rowCount).toBe(50);
    expect(m.pinnedValueAt('top', 0, 'name')).toBe('Total');
  });

  it('follows updates', () => {
    const m = model({ pinnedRows: { bottom: [totals] } });
    m.update({ pinnedRows: undefined });
    expect(m.pinnedCount('bottom')).toBe(0);
  });
});

describe('createTableModel: column groups', () => {
  const groups = [
    { id: 'who', header: 'Who', columns: ['name', { id: 'where', columns: ['city'] }] },
    { id: 'end', columns: ['note', 'actions'] },
  ];
  const rows = (m: ReturnType<typeof model>) =>
    m.headerGroups.map((row) => row.map((c) => [c.groupId ?? '-', c.colIndex, c.span]));

  it('has one header row and no group rows without groups', () => {
    const m = model();
    expect(m.headerGroups).toEqual([]);
    expect(m.headerRows).toBe(1);
  });

  it('builds a header row per level, split by pin side, with fillers', () => {
    const m = model({ columnGroups: groups });
    // id name | age city note | actions; 'who' shows on the start side and in the scrolling one.
    expect(m.orderOf()).toEqual(['id', 'name', 'age', 'city', 'note', 'actions']);
    expect(m.headerRows).toBe(3);
    expect(rows(m)).toEqual([
      [
        ['-', 1, 1],
        ['who', 2, 1],
        ['-', 3, 1],
        ['who', 4, 1],
        ['end', 5, 1],
        ['end', 6, 1],
      ],
      [
        ['-', 1, 2],
        ['-', 3, 1],
        ['where', 4, 1],
        ['-', 5, 1],
        ['-', 6, 1],
      ],
    ]);
    expect(m.headerCell(1, 'city')?.groupId).toBe('where');
    expect(m.headerCell(0, 'id')?.kind).toBe('filler');
  });

  it('keeps headerGroups while the views stay, and rebuilds them for new groups', () => {
    const m = model({ columnGroups: groups });
    const first = m.headerGroups;
    m.update({ sorting: [{ id: 'name', desc: false }] });
    expect(m.headerGroups).toBe(first);
    m.update({ columnGroups: [{ id: 'n', columns: ['note', 'age'] }] });
    expect(m.orderOf()).toEqual(['id', 'name', 'age', 'note', 'city', 'actions']);
    expect(m.headerRows).toBe(2);
  });

  it('keeps a group together in a given order, and moves it as a block', () => {
    const m = model({ columnGroups: [{ id: 'g', columns: ['age', 'note'] }] });
    m.update({ columnOrder: ['age', 'city', 'note'] });
    expect(m.orderOf()).toEqual(['id', 'name', 'age', 'note', 'city', 'actions']);
    expect(m.siblingUnits(column('city')).map((u) => u.unit.id)).toEqual(['g', 'city']);
    expect(m.nextMove({ kind: 'group', id: 'g', pin: undefined }, 1)).toEqual([
      'id',
      'name',
      'city',
      'age',
      'note',
      'actions',
    ]);
    expect(m.nextMove(column('city'), 0)).toEqual(['id', 'name', 'city', 'age', 'note', 'actions']);
  });

  it('puts the selection column under a filler', () => {
    const m = model({
      selectionColumn: true,
      columnGroups: [{ id: 'g', columns: ['id', 'name'] }],
    });
    expect(rows(m)).toEqual([
      [
        ['-', 1, 1],
        ['g', 2, 2],
        ['-', 4, 3],
        ['-', 7, 1],
      ],
    ]);
  });
});

describe('createTableModel: expanded rows', () => {
  const byId = (p: Person) => p.id;

  it('adds the toggle column after the selection column', () => {
    const m = model({ detail: true, selectionColumn: true });
    const [selection, expand, first] = m.columns;
    expect(selection?.kind).toBe('selection');
    expect(expand).toMatchObject({
      id: EXPAND_COLUMN_ID,
      kind: 'expand',
      pin: 'start',
      width: EXPAND_COLUMN_WIDTH,
      colIndex: 2,
      offset: SELECTION_COLUMN_WIDTH,
      pinEdge: false,
    });
    expect(first).toMatchObject({ id: 'id', colIndex: 3, offset: 80 });
    expect(m.allColumns.some((c) => c.kind === 'expand')).toBe(false);
    expect(m.orderOf()).not.toContain(EXPAND_COLUMN_ID);
  });

  it('makes the toggle column the pinned edge when no data column is pinned to the start', () => {
    const m = model({
      detail: true,
      columnPinning: { id: false, name: false },
    });
    expect(m.columns[0]).toMatchObject({ kind: 'expand', offset: 0, pinEdge: true });
  });

  it('reserves the toggle column id', () => {
    expect(
      () => model({ detail: true, columns: [...columns, { id: EXPAND_COLUMN_ID }] }).columns,
    ).toThrow(/reserved/);
  });

  it('shows panels for expanded rows in the current order', () => {
    const m = model({
      detail: true,
      getRowId: byId,
      expanded: ['p3'],
      sorting: [{ id: 'name', desc: false }],
    });
    const at = m.indexOf('p3') ?? -1;
    expect(m.display.count).toBe(5);
    expect(m.display.detailPositionOf(at)).toBe(at + 1);
  });

  it('shows no panel for ids it cannot place', () => {
    const m = model({
      detail: true,
      getRowId: byId,
      expanded: ['p3', 'p3', 'nope', 'p2'],
      rowExpandable: (p) => p.id !== 'p2',
      quickFilter: 'Dan',
    });
    expect(m.display.count).toBe(m.rowCount);
    expect(m.expandable(0)).toBe(true);
    m.update({ quickFilter: '' });
    expect(m.display.count).toBe(m.rowCount + 1);
    expect(m.display.hasDetail(m.indexOf('p3') ?? -1)).toBe(true);
    expect(m.expandable(m.indexOf('p2') ?? -1)).toBe(false);
  });

  it('is the identity without detail', () => {
    const m = model({ getRowId: byId, expanded: ['p1'] });
    expect(m.display.count).toBe(m.rowCount);
    expect(m.columns.some((c) => c.kind === 'expand')).toBe(false);
    expect(m.expandable(0)).toBe(false);
  });

  it('proposes the next expanded state', () => {
    const m = model({ detail: true, getRowId: byId, rowExpandable: (p) => p.id !== 'p2' });
    expect(m.nextExpanded('p1', true)).toEqual(['p1']);
    expect(m.nextExpanded('p2', true)).toBeUndefined();
    expect(m.nextExpanded('nope', true)).toBeUndefined();
    m.update({ expanded: ['p1'] });
    expect(m.nextExpanded('p1', true)).toBeUndefined();
    expect(m.nextExpanded('p1', false)).toEqual([]);
    expect(m.nextExpanded('p4', true, ['p3'])).toEqual(['p3', 'p4']);
  });

  it('places panels only for loaded remote rows', () => {
    const [first] = people as [Person];
    const remote = {
      rowCount: 50,
      entryAt: (index: number) =>
        index < 10 ? { id: `r${String(index)}`, row: first } : undefined,
      indexOf: (id: string) => {
        const index = Number(id.slice(1));
        return index < 10 ? index : undefined;
      },
      loadedIds: () => Array.from({ length: 10 }, (_, i) => `r${String(i)}`),
    };
    const m = model({ detail: true, remote, expanded: ['r3', 'r40'] });
    expect(m.display.open).toEqual([3]);
    expect(m.expandable(40)).toBe(false);
  });

  it("keeps a remote source's display until its version changes", () => {
    const [first] = people as [Person];
    let version = 1;
    let loaded = 10;
    let reads = 0;
    const remote = {
      rowCount: 50,
      get version() {
        return version;
      },
      entryAt: (index: number) =>
        index < loaded ? { id: `r${String(index)}`, row: first } : undefined,
      indexOf: (id: string) => {
        reads++;
        const index = Number(id.slice(1));
        return index < loaded ? index : undefined;
      },
      loadedIds: () => Array.from({ length: loaded }, (_, i) => `r${String(i)}`),
    };
    const m = model({ detail: true, remote, expanded: ['r3', 'r40'] });
    const display = m.display;
    const before = reads;
    expect(m.display).toBe(display);
    expect(reads).toBe(before);
    // Row 40's page loads.
    loaded = 50;
    version++;
    expect(m.display.open).toEqual([3, 40]);
  });

  it('keeps display while nothing it reads changes', () => {
    const m = model({ detail: true, getRowId: byId, expanded: ['p1'] });
    const display = m.display;
    m.update({ columnSizing: { age: 99 } });
    expect(m.display).toBe(display);
    m.update({ expanded: ['p1', 'p2'] });
    expect(m.display).not.toBe(display);
  });
});

describe('createTableModel: identities', () => {
  it('keeps columns and allColumns between reads', () => {
    const m = model();
    expect(m.columns).toBe(m.columns);
    expect(m.allColumns).toBe(m.allColumns);
  });

  it('builds new views on an update, and keeps them on an update that changes nothing', () => {
    const sorting: TableModelOptions<Person, string>['sorting'] = [];
    const m = model({ sorting });
    const views = m.columns;
    const all = m.allColumns;
    m.update({ sorting, data: people });
    expect(m.columns).toBe(views);
    m.update({ columnSizing: { age: 99 } });
    expect(m.columns).not.toBe(views);
    expect(m.allColumns).not.toBe(all);
  });

  it('keeps rowOrder when pinning or visibility change without a filter', () => {
    const m = model();
    const order = m.rowOrder;
    m.update({ columnPinning: { age: 'start' } });
    expect(m.rowOrder).toBe(order);
    m.update({ columnVisibility: { city: false } });
    expect(m.rowOrder).toBe(order);
  });

  it('filters again when visibility changes under a quick filter', () => {
    const m = model({ quickFilter: 'a' });
    const order = m.rowOrder;
    m.update({ columnVisibility: { city: false } });
    expect(m.rowOrder).not.toBe(order);
  });
});

describe('stretched columns', () => {
  const three = (
    widths: [number, number, number] = [150, 150, 150],
    extra: Partial<ColumnDef<Person, string>> = {},
  ): ColumnDef<Person, string>[] =>
    (['a', 'b', 'c'] as const).map((id, i) => ({ id, width: widths[i], ...extra }));
  const at = (overrides: Partial<TableModelOptions<Person, string>>) =>
    model({ columns: three(), ...overrides });
  const widths = (m: ReturnType<typeof model>) => m.columns.map((c) => c.width);

  it('leaves widths alone without stretch', () => {
    const m = at({});
    expect(widths(m)).toEqual([150, 150, 150]);
    expect(m.columns.map((c) => c.ownWidth)).toEqual([150, 150, 150]);
  });

  it('stretches scrolling columns in proportion to fill the width', () => {
    const m = at({ columns: three([100, 200, 300]), stretch: { width: 1200 } });
    expect(widths(m)).toEqual([200, 400, 600]);
    expect(m.columns.map((c) => c.ownWidth)).toEqual([100, 200, 300]);
    expect(m.totalWidth).toBe(1200);
  });

  it('rounds to whole px that add up to the width', () => {
    expect(widths(at({ stretch: { width: 1000 } }))).toEqual([333, 334, 333]);
  });

  it('keeps pinned and system columns, and fills with the scrolling ones', () => {
    const cols = three();
    cols[0] = { id: 'a', width: 150, pin: 'start' };
    const m = at({ columns: cols, selectionColumn: true, stretch: { width: 1000 } });
    const byId = new Map(m.columns.map((c) => [c.id, c.width]));
    expect(byId.get(SELECTION_COLUMN_ID)).toBe(SELECTION_COLUMN_WIDTH);
    expect(byId.get('a')).toBe(150);
    expect((byId.get('b') ?? 0) + (byId.get('c') ?? 0)).toBe(1000 - 150 - SELECTION_COLUMN_WIDTH);
  });

  it('does not stretch while an unresized flex column is shown', () => {
    const cols = three();
    cols[1] = { id: 'b', width: { flex: 1 } };
    const plain = at({ columns: cols });
    const stretched = at({ columns: cols, stretch: { width: 1000 } });
    expect(widths(stretched)).toEqual(widths(plain));
  });

  it('stretches only unresized columns', () => {
    const m = at({ columnSizing: { a: 120 }, stretch: { width: 1000 } });
    expect(widths(m)).toEqual([120, 440, 440]);
  });

  it('gives the space to the last column when all are resized, else the one before it if it is keep', () => {
    const sizing = { a: 150, b: 150, c: 150 };
    expect(widths(at({ columnSizing: sizing, stretch: { width: 600 } }))).toEqual([150, 150, 300]);
    expect(widths(at({ columnSizing: sizing, stretch: { width: 600, keep: ['c'] } }))).toEqual([
      150, 300, 150,
    ]);
  });

  it('keep only steers what the unresized columns leave over', () => {
    // Unresized columns stretch whatever keep says (a rejected, controlled resize).
    expect(widths(at({ stretch: { width: 600, keep: ['a'] } }))).toEqual([200, 200, 200]);
  });

  it('gives what capped columns leave to the last columns, skipping keep', () => {
    const cols = three();
    cols[0] = { id: 'a', width: 150, maxWidth: 160 };
    const sizing = { b: 150, c: 150 };
    expect(widths(at({ columns: cols, columnSizing: sizing, stretch: { width: 900 } }))).toEqual([
      160, 150, 590,
    ]);
    expect(
      widths(at({ columns: cols, columnSizing: sizing, stretch: { width: 900, keep: ['c'] } })),
    ).toEqual([160, 590, 150]);
  });

  it('never overflows a fractional width', () => {
    const m = at({ columns: three([100.4, 150, 150]), stretch: { width: 600.7 } });
    expect(m.totalWidth).toBeLessThanOrEqual(600.7);
  });

  it('caps stretching at maxWidth', () => {
    const cols = three();
    cols[0] = { id: 'a', width: 150, maxWidth: 160 };
    expect(widths(at({ columns: cols, stretch: { width: 900 } }))).toEqual([160, 370, 370]);
    // Every column capped: the space stays empty.
    expect(
      widths(at({ columns: three(undefined, { maxWidth: 160 }), stretch: { width: 900 } })),
    ).toEqual([160, 160, 160]);
  });

  it('does nothing when the columns are wider than the width', () => {
    expect(widths(at({ stretch: { width: 300 } }))).toEqual([150, 150, 150]);
  });

  it('offsets follow rendered widths', () => {
    const m = at({ columns: three([100, 200, 300]), stretch: { width: 1200 } });
    expect(m.columns.map((c) => c.offset)).toEqual([0, 200, 600]);
  });
});

describe('tree rows', () => {
  interface Item {
    id?: string;
    parent?: string | null;
    name: string;
    n?: number;
    kids?: Item[];
  }
  // Source indexes: A=0, B=1, A1=2, A2=3, B1=4.
  const nested: Item[] = [
    {
      name: 'A',
      kids: [
        { name: 'A1', n: 2 },
        { name: 'A2', n: 1 },
      ],
    },
    { name: 'B', kids: [{ name: 'B1', n: 0 }] },
  ];
  const treeColumns: ColumnDef<Item, string>[] = [
    { id: 'name', accessor: 'name', sortable: true, filter: 'text' },
    { id: 'n', accessor: 'n', sortable: true },
  ];
  const tmodel = (overrides: Partial<TableModelOptions<Item, string>> = {}) =>
    createTableModel<Item, string>({
      columns: treeColumns,
      data: nested,
      getRowId: undefined,
      sorting: [],
      columnSizing: {},
      getSubRows: (row) => row.kids,
      ...overrides,
    });
  const tids = (m: ReturnType<typeof tmodel>) =>
    Array.from({ length: m.rowCount }, (_, i) => m.rowAt(i)?.id);
  const tnames = (m: ReturnType<typeof tmodel>) =>
    Array.from({ length: m.rowCount }, (_, i) => m.valueAt(i, 'name'));
  const matchB1 = { name: { kind: 'text' as const, op: 'equals' as const, value: 'B1' } };

  it('shows top-level rows until rows are expanded', () => {
    const m = tmodel();
    expect(m.tree).toBe(true);
    expect(m.rowCount).toBe(2);
    expect(tids(m)).toEqual(['0', '1']);
    m.update({ treeExpanded: ['0'] });
    expect(tids(m)).toEqual(['0', '0.0', '0.1', '1']);
  });

  it('sorts siblings among themselves', () => {
    const m = tmodel({ treeExpanded: ['0', '1'], sorting: [{ id: 'n', desc: false }] });
    expect(tnames(m)).toEqual(['A', 'A2', 'A1', 'B', 'B1']);
    m.update({ sorting: [{ id: 'name', desc: true }] });
    expect(tnames(m)).toEqual(['B', 'B1', 'A', 'A2', 'A1']);
  });

  it('filtering keeps ancestors and shows them open', () => {
    const treeExpanded: string[] = [];
    const m = tmodel({ treeExpanded, columnFilters: matchB1 });
    expect(tids(m)).toEqual(['1', '1.0']);
    expect(m.treeRow(0)).toEqual({
      depth: 0,
      hasChildren: true,
      open: true,
      forced: true,
      parent: undefined,
      setSize: 1,
      posInSet: 1,
    });
    expect(m.treeRow(1)).toEqual({
      depth: 1,
      hasChildren: false,
      open: false,
      forced: false,
      parent: 0,
      setSize: 1,
      posInSet: 1,
    });
    expect(treeExpanded).toEqual([]);
    m.update({ columnFilters: {} });
    expect(tids(m)).toEqual(['0', '1']);
    expect(m.treeRow(1)?.open).toBe(false);
  });

  it('treeRow describes depth, parent and siblings', () => {
    const m = tmodel({ treeExpanded: ['0'] });
    expect(m.treeRow(0)).toEqual({
      depth: 0,
      hasChildren: true,
      open: true,
      forced: false,
      parent: undefined,
      setSize: 2,
      posInSet: 1,
    });
    expect(m.treeRow(2)).toEqual({
      depth: 1,
      hasChildren: false,
      open: false,
      forced: false,
      parent: 0,
      setSize: 2,
      posInSet: 2,
    });
    expect(m.treeRow(3)).toEqual({
      depth: 0,
      hasChildren: true,
      open: false,
      forced: false,
      parent: undefined,
      setSize: 2,
      posInSet: 2,
    });
    expect(m.treeRow(4)).toBeUndefined();
  });

  it('rowAt, cellContext and valueAt read child rows', () => {
    const m = tmodel({ treeExpanded: ['0'] });
    expect(m.rowAt(1)?.original.name).toBe('A1');
    expect(m.valueAt(2, 'n')).toBe(1);
    expect(m.cellContext(1, 'n')).toEqual({
      row: nested[0]?.kids?.[0],
      rowId: '0.0',
      index: 1,
      columnId: 'n',
      value: 2,
      depth: 1,
    });
    expect(m.cellContext(0, 'n')?.depth).toBe(0);
    expect(model().cellContext(0, 'name')).not.toHaveProperty('depth');
  });

  it('nextTreeExpanded proposes ids', () => {
    const m = tmodel();
    expect(m.nextTreeExpanded('0', true)).toEqual(['0']);
    expect(m.nextTreeExpanded('0', false)).toBeUndefined();
    expect(m.nextTreeExpanded('0.0', true)).toBeUndefined();
    expect(m.nextTreeExpanded('nope', true)).toBeUndefined();
    m.update({ treeExpanded: ['0', '1'] });
    expect(m.nextTreeExpanded('0', true)).toBeUndefined();
    expect(m.nextTreeExpanded('0', false)).toEqual(['1']);
    expect(m.nextTreeExpanded('1', true, [])).toEqual(['1']);
    // Rows whose children are all filtered out still take an id: a controlled
    // host's ids are never refused for a filter.
    m.update({ treeExpanded: [], columnFilters: matchB1 });
    expect(m.nextTreeExpanded('0', true)).toEqual(['0']);
    expect(model().nextTreeExpanded('0', true)).toBeUndefined();
  });

  it('shownAncestor finds the nearest shown ancestor', () => {
    const m = tmodel();
    expect(m.shownAncestor('0.1')).toBe(0);
    expect(m.shownAncestor('1.0')).toBe(1);
    expect(m.shownAncestor('1')).toBe(1);
    expect(m.shownAncestor('nope')).toBeUndefined();
    m.update({ treeExpanded: ['0'] });
    expect(m.shownAncestor('1.0')).toBe(3);
    expect(model().shownAncestor('0')).toBeUndefined();
  });

  it('indexesPassing keeps ancestors of matches, as source indexes', () => {
    const m = tmodel({ columnFilters: matchB1 });
    expect(m.indexesPassing()).toEqual([1, 4]);
    expect(m.indexesPassing(['name'])).toEqual([0, 1, 2, 3, 4]);
  });

  it('sourceRow reads rows by source index', () => {
    const m = tmodel();
    expect(m.sourceRow(1)?.name).toBe('B');
    expect(m.sourceRow(3)?.name).toBe('A2');
    expect(m.sourceRow(5)).toBeUndefined();
    expect(model().sourceRow(2)).toBe(people[2]);
  });

  it('selectableIds lists shown rows; branchSelectAll every kept row', () => {
    const m = tmodel();
    expect(m.selectableIds()).toEqual(['0', '1']);
    expect(m.branchSelectAll([])).toEqual(['0', '0.0', '0.1', '1', '1.0']);
    m.update({ columnFilters: matchB1 });
    expect(m.branchSelectAll(['x'])).toEqual(['x', '1', '1.0']);
    expect(model().branchSelectAll(['x'])).toEqual(['x']);
  });

  it('offers child rows values in set filters', () => {
    const m = tmodel();
    expect(m.filterValues('name')?.values).toEqual(['A', 'A1', 'A2', 'B', 'B1']);
  });

  it('flat data with getParentId', () => {
    const flat: Item[] = [
      { id: 'A', parent: null, name: 'A' },
      { id: 'B', name: 'B' },
      { id: 'A1', parent: 'A', name: 'A1', n: 2 },
      { id: 'A2', parent: 'A', name: 'A2', n: 1 },
      { id: 'B1', parent: 'B', name: 'B1', n: 0 },
    ];
    const m = tmodel({
      data: flat,
      getSubRows: undefined,
      getParentId: (row) => row.parent,
      getRowId: (row) => row.id ?? '',
    });
    expect(tids(m)).toEqual(['A', 'B']);
    m.update({ treeExpanded: ['A'] });
    expect(tids(m)).toEqual(['A', 'A1', 'A2', 'B']);
    m.update({ treeExpanded: ['A', 'B'], sorting: [{ id: 'n', desc: false }] });
    expect(tids(m)).toEqual(['A', 'A2', 'A1', 'B', 'B1']);
    m.update({ sorting: [], treeExpanded: [], columnFilters: matchB1 });
    expect(tids(m)).toEqual(['B', 'B1']);
    expect(m.indexesPassing()).toEqual([1, 4]);
    expect(m.treeRow(1)?.parent).toBe(0);
  });

  it('a new data array with the same ids keeps rows expanded', () => {
    const m = tmodel({ treeExpanded: ['0'] });
    const edited: Item[] = [
      { name: 'A', kids: [{ name: 'A1', n: 5 }, nested[0]?.kids?.[1] ?? { name: '' }] },
      nested[1] ?? { name: '' },
    ];
    const before = m.rowOrder;
    m.update({ data: edited });
    expect(m.rowOrder).not.toBe(before);
    expect(tids(m)).toEqual(['0', '0.0', '0.1', '1']);
    expect(m.valueAt(1, 'n')).toBe(5);
  });

  it('without a tree nothing changes', () => {
    const m = model();
    expect(m.tree).toBe(false);
    expect(m.treeRow(0)).toBeUndefined();
    expect(m.nextTreeExpanded('0', true)).toBeUndefined();
    const order = m.rowOrder;
    m.update({ treeExpanded: ['0'] });
    expect(m.rowOrder).toBe(order);
    expect(ids(m)).toEqual(['0', '1', '2', '3']);
  });

  it('collapsing re-runs only the last step', () => {
    let reads = 0;
    const m = tmodel({
      columns: [
        { id: 'name', accessor: 'name' },
        {
          id: 'n',
          accessor: (row) => {
            reads++;
            return row.n;
          },
          sortable: true,
        },
      ],
      sorting: [{ id: 'n', desc: false }],
    });
    expect(m.rowCount).toBe(2);
    expect(reads).toBe(5);
    reads = 0;
    m.update({ treeExpanded: ['0'] });
    expect(m.rowCount).toBe(4);
    m.update({ treeExpanded: [] });
    expect(m.rowCount).toBe(2);
    expect(reads).toBe(0);
  });

  it('keeps the row order while nothing it reads changes', () => {
    const treeExpanded = ['0', '1'];
    const m = tmodel({ treeExpanded });
    const order = m.rowOrder;
    m.update({ treeExpanded });
    m.update({ columnSizing: {} });
    expect(m.rowOrder).toBe(order);
    // The same ids in a new array, or a new empty sort: nothing to lay out again.
    m.update({ treeExpanded: ['1', '0', '1'] });
    expect(m.rowOrder).toBe(order);
    m.update({ sorting: [] });
    expect(m.rowOrder).toBe(order);
    m.update({ treeExpanded: ['0'] });
    expect(m.rowOrder).not.toBe(order);
    expect(tids(m)).toEqual(['0', '0.0', '0.1', '1']);
  });

  it('toggles membership of a row a filter forces open', () => {
    const m = tmodel({
      treeExpanded: [],
      columnFilters: { name: { kind: 'text', op: 'equals', value: 'A1' } },
    });
    expect(tids(m)).toEqual(['0', '0.0']);
    expect(m.treeRow(0)).toMatchObject({ open: true });
    const next = m.nextTreeExpanded('0', true);
    expect(next).toEqual(['0']);
    m.update({ treeExpanded: next });
    expect(m.treeRow(0)).toMatchObject({ open: true });
    m.update({ columnFilters: {} });
    expect(tids(m)).toEqual(['0', '0.0', '0.1', '1']);
    expect(m.treeRow(0)).toMatchObject({ open: true });
  });

  it('shows the ancestors of a deep match open, and collapses them once the filter clears', () => {
    const deep: Item[] = [
      { name: 'A', kids: [{ name: 'A1', kids: [{ name: 'A1x' }, { name: 'A1y' }] }] },
      { name: 'B' },
    ];
    const treeExpanded: string[] = [];
    const m = tmodel({
      data: deep,
      treeExpanded,
      columnFilters: { name: { kind: 'text', op: 'equals', value: 'A1y' } },
    });
    expect(tids(m)).toEqual(['0', '0.0', '0.0.1']);
    expect(m.treeRow(0)).toMatchObject({ open: true, setSize: 1 });
    expect(m.treeRow(1)).toMatchObject({ depth: 1, open: true, parent: 0 });
    expect(m.treeRow(2)).toMatchObject({ depth: 2, hasChildren: false, parent: 1, setSize: 1 });
    expect(treeExpanded).toEqual([]);
    m.update({ columnFilters: {} });
    expect(tids(m)).toEqual(['0', '1']);
    expect(m.treeRow(0)).toMatchObject({ open: false });
  });

  it('marks the rows a filter keeps open as forced', () => {
    const deep: Item[] = [
      { name: 'A', kids: [{ name: 'A1', kids: [{ name: 'A1x' }, { name: 'A1y' }] }] },
      { name: 'B', kids: [{ name: 'B1' }] },
    ];
    const forced = (m: ReturnType<typeof tmodel>) => tids(m).map((_, i) => m.treeRow(i)?.forced);
    // A grandchild matches: its ancestors are forced open, whatever `treeExpanded` says.
    const m = tmodel({
      data: deep,
      treeExpanded: ['0'],
      columnFilters: { name: { kind: 'text', op: 'equals', value: 'A1y' } },
    });
    expect(tids(m)).toEqual(['0', '0.0', '0.0.1']);
    expect(forced(m)).toEqual([true, true, false]);
    // A match without matching descendants isn't forced; its ancestor is.
    m.update({ columnFilters: { name: { kind: 'text', op: 'equals', value: 'A1' } } });
    expect(tids(m)).toEqual(['0', '0.0']);
    expect(forced(m)).toEqual([true, false]);
    // A match holding another match is forced.
    m.update({ columnFilters: { name: { kind: 'text', op: 'startsWith', value: 'A1' } } });
    expect(tids(m)).toEqual(['0', '0.0', '0.0.0', '0.0.1']);
    expect(forced(m)).toEqual([true, true, false, false]);
    // Without a filter nothing is.
    m.update({ columnFilters: {}, treeExpanded: ['0', '0.0', '1'] });
    expect(tids(m)).toEqual(['0', '0.0', '0.0.0', '0.0.1', '1', '1.0']);
    expect(forced(m)).toEqual([false, false, false, false, false, false]);
  });

  it('sorts a tree again when a column reads its values differently', () => {
    const sorting = [{ id: 'n', desc: false }];
    const m = tmodel({ treeExpanded: ['0', '1'], sorting });
    expect(tnames(m)).toEqual(['A', 'A2', 'A1', 'B', 'B1']);
    m.update({
      columns: [
        treeColumns[0] ?? { id: 'name' },
        { id: 'n', accessor: (row) => (row.n === undefined ? undefined : -row.n), sortable: true },
      ],
    });
    expect(tnames(m)).toEqual(['A', 'A1', 'A2', 'B', 'B1']);
  });

  it('builds no tree with remote rows, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const remote = {
      rowCount: 3,
      entryAt: () => undefined,
      indexOf: () => undefined,
      loadedIds: () => [],
    };
    const m = tmodel({ remote });
    expect(m.tree).toBe(false);
    expect(m.treeRow(0)).toBeUndefined();
    m.update({ treeExpanded: ['0'] });
    m.update({ remote: { ...remote } });
    expect(m.tree).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('warns once when both getSubRows and getParentId are set', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const m = tmodel({ getParentId: (row) => row.parent });
    expect(tids(m)).toEqual(['0', '1']);
    m.update({ data: [...nested] });
    expect(m.rowCount).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('tree branch selection', () => {
  interface Item {
    name: string;
    n?: number;
    kids?: Item[];
  }
  const data: Item[] = [
    {
      name: 'A',
      kids: [
        { name: 'A1', n: 2 },
        { name: 'A2', n: 1 },
      ],
    },
    { name: 'B', kids: [{ name: 'B1', n: 0 }] },
  ];
  const columns: ColumnDef<Item, string>[] = [
    { id: 'name', accessor: 'name', sortable: true, filter: 'text' },
    { id: 'n', accessor: 'n', sortable: true },
  ];
  const bmodel = (overrides: Partial<TableModelOptions<Item, string>> = {}) =>
    createTableModel<Item, string>({
      columns,
      data,
      getRowId: (row) => row.name,
      sorting: [],
      columnSizing: {},
      getSubRows: (row) => row.kids,
      ...overrides,
    });
  const checks = (m: ReturnType<typeof bmodel>, selected: readonly string[]) => {
    const check = m.branchCheck(new Set(selected));
    const states: Record<string, string> = {};
    for (let i = 0; i < m.rowCount; i++) states[m.rowAt(i)?.id ?? ''] = check(i);
    return states;
  };

  it('branchTree lists kept children in layout order, and parents', () => {
    const m = bmodel({ sorting: [{ id: 'n', desc: false }] });
    const tree = m.branchTree();
    expect(tree?.children('A')).toEqual(['A2', 'A1']);
    expect(tree?.children('A1')).toEqual([]);
    expect(tree?.parent('A1')).toBe('A');
    expect(tree?.parent('A')).toBeUndefined();
    expect(tree?.children('nope')).toEqual([]);
    expect(tree?.parent('nope')).toBeUndefined();
    // Kept per layout: collapsing or expanding keeps it.
    m.update({ treeExpanded: ['A'] });
    expect(m.branchTree()).toBe(tree);
  });

  it('branchTree leaves out the rows the filters drop', () => {
    const m = bmodel({ columnFilters: { name: { kind: 'text', op: 'equals', value: 'A1' } } });
    const tree = m.branchTree();
    expect(tree?.children('A')).toEqual(['A1']);
    expect(tree?.children('B')).toEqual([]);
    expect(tree?.parent('A2')).toBeUndefined();
    expect(tree?.parent('B1')).toBeUndefined();
  });

  it('branchTree gives every row its children in the whole tree too', () => {
    const m = bmodel({ columnFilters: { name: { kind: 'text', op: 'equals', value: 'A1' } } });
    const tree = m.branchTree();
    expect(tree?.allChildren('A')).toEqual(['A1', 'A2']);
    expect(tree?.allChildren('B')).toEqual(['B1']);
    expect(tree?.allChildren('A1')).toEqual([]);
    expect(tree?.allChildren('nope')).toEqual([]);
    // Without a filter they're the kept children.
    expect(bmodel().branchTree()?.allChildren('A')).toEqual(['A1', 'A2']);
  });

  it('branchTree is undefined without a tree', () => {
    expect(bmodel({ getSubRows: undefined }).branchTree()).toBeUndefined();
  });

  it('branchCheck counts each row with its kept descendants', () => {
    const m = bmodel({ treeExpanded: ['A', 'B'] });
    expect(checks(m, ['A', 'A1', 'A2'])).toEqual({
      A: 'all',
      A1: 'all',
      A2: 'all',
      B: 'none',
      B1: 'none',
    });
    expect(checks(m, ['A1'])).toMatchObject({ A: 'some', A1: 'all', A2: 'none' });
  });

  it('a contradicting controlled value is reported as it is', () => {
    const m = bmodel({ treeExpanded: ['A'] });
    expect(checks(m, ['A'])).toEqual({ A: 'some', A1: 'none', A2: 'none', B: 'none' });
    // A parent's whole branch selected without its own id is part-ticked too.
    expect(checks(m, ['A1', 'A2'])).toMatchObject({ A: 'some' });
  });

  it('branchCheck counts only the descendants the filters keep', () => {
    const m = bmodel({ columnFilters: { name: { kind: 'text', op: 'equals', value: 'A1' } } });
    expect(checks(m, ['A1'])).toEqual({ A: 'some', A1: 'all' });
    // A's id without A2 breaks the rules: shown as it is.
    expect(checks(m, ['A', 'A1'])).toEqual({ A: 'all', A1: 'all' });
  });

  it('branchCheck counts rows under collapsed parents', () => {
    const m = bmodel();
    expect(checks(m, ['A1'])).toEqual({ A: 'some', B: 'none' });
    expect(checks(m, ['B', 'B1'])).toEqual({ A: 'none', B: 'all' });
  });

  it('branchCheck is kept per selection and layout', () => {
    const m = bmodel();
    const selected = new Set(['A1']);
    const check = m.branchCheck(selected);
    expect(m.branchCheck(selected)).toBe(check);
    expect(check(1)).toBe('none');
    // A new shown order over the same layout reads the rows where they are now.
    m.update({ treeExpanded: ['A'] });
    expect(m.branchCheck(selected)).toBe(check);
    expect([check(0), check(1), check(3)]).toEqual(['some', 'all', 'none']);
    m.update({ sorting: [{ id: 'n', desc: false }] });
    const sorted = m.branchCheck(selected);
    expect(sorted).not.toBe(check);
    // One selection is kept: the element asks with its current `Set`.
    expect(m.branchCheck(new Set(['A1']))).not.toBe(sorted);
  });

  it('branchCheck needs a tree: without one every row is none', () => {
    const m = bmodel({ getSubRows: undefined });
    const check = m.branchCheck(new Set(['B']));
    expect([check(0), check(1), check(2)]).toEqual(['none', 'none', 'none']);
  });

  it('branchCheck at a million rows is one linear pass', () => {
    const big: Item[] = Array.from({ length: 100_000 }, (_, p) => ({
      name: `P${String(p)}`,
      kids: Array.from({ length: 9 }, (_, c) => ({ name: `P${String(p)}-${String(c)}` })),
    }));
    const m = bmodel({ data: big });
    expect(m.rowCount).toBe(100_000);
    const start = performance.now();
    const check = m.branchCheck(new Set(['P5-3']));
    const took = performance.now() - start;
    expect([check(4), check(5), check(6)]).toEqual(['none', 'some', 'none']);
    expect(took).toBeLessThan(300);
  });
});

describe('branch selection under a filter: whole branches only', () => {
  interface Node {
    name: string;
    kids?: Node[];
  }
  // P0{C0.0, C0.1, C0.2}, P1{…}, P2{…}; ids '0', '0.0', …
  const data: Node[] = [0, 1, 2].map((p) => ({
    name: `P${String(p)}`,
    kids: [0, 1, 2].map((c) => ({ name: `C${String(p)}.${String(c)}` })),
  }));
  const tmodel = (quickFilter?: string, names?: string[]) =>
    createTableModel<Node, string>({
      columns: [{ id: 'name', accessor: 'name' }],
      data,
      getRowId: undefined,
      sorting: [],
      columnSizing: {},
      getSubRows: (row) => row.kids,
      treeExpanded: ['0', '1', '2'],
      quickFilter,
      columnFilters: names ? { name: { kind: 'set', values: names } } : undefined,
    });
  const states = (m: ReturnType<typeof tmodel>, selected: readonly string[]) => {
    const check = m.branchCheck(new Set(selected));
    const out: Record<string, string> = {};
    for (let i = 0; i < m.rowCount; i++) out[m.rowAt(i)?.id ?? ''] = check(i);
    return out;
  };
  const tick = (m: ReturnType<typeof tmodel>, current: readonly string[], id: string) => {
    const tree = m.branchTree();
    if (!tree) throw new Error('no tree');
    return toggleBranch(current, id, tree);
  };
  /** Select-all, checked against `withBranches` over every kept row. */
  const selectAll = (m: ReturnType<typeof tmodel>, current: readonly string[]) => {
    const tree = m.branchTree();
    if (!tree) throw new Error('no tree');
    const kept: string[] = [];
    for (let i = 0; i < m.rowCount; i++) kept.push(m.rowAt(i)?.id ?? '');
    const all = m.branchSelectAll(current);
    expect([...all].sort()).toEqual([...withBranches(current, kept, tree)].sort());
    return all;
  };

  it('ticking a parent selects its shown rows, not its id; clearing the filter shows it part-ticked', () => {
    const m = tmodel('C0.1');
    const selection = tick(m, [], '0');
    expect(selection).toEqual(['0.1']);
    expect(states(m, selection)).toEqual({ '0': 'some', '0.1': 'all' });
    m.update({ quickFilter: undefined });
    expect(states(m, selection)).toMatchObject({ '0': 'some', '0.0': 'none', '0.1': 'all' });
    expect(selection).not.toContain('0');
  });

  it('a part-ticked parent whose shown rows are all selected unticks, then ticks again', () => {
    const m = tmodel('C0.1');
    const ticked = tick(m, [], '0');
    expect(m.branchCheckAll(new Set(ticked))).toBe('all');
    const unticked = tick(m, ticked, '0');
    expect(unticked).toEqual([]);
    expect(m.branchCheckAll(new Set(unticked))).toBe('none');
    expect(tick(m, unticked, '0')).toEqual(['0.1']);
  });

  it("adds the parent's id once the rows the filter hides are selected", () => {
    const m = tmodel('C0.1');
    const selection = tick(m, ['0.0', '0.2'], '0');
    expect([...selection].sort()).toEqual(['0', '0.0', '0.1', '0.2']);
    expect(states(m, selection)).toEqual({ '0': 'all', '0.1': 'all' });
    // Unticking leaves the hidden rows selected.
    expect(tick(m, selection, '0')).toEqual(['0.0', '0.2']);
  });

  it('select-all selects the shown rows, with parent ids only for whole branches', () => {
    const m = tmodel('C0.1');
    expect(selectAll(m, [])).toEqual(['0.1']);
    expect(m.branchCheckAll(new Set(['0.1']))).toBe('all');
    expect(selectAll(m, ['0.0', '0.2'])).toEqual(['0.0', '0.2', '0', '0.1']);
    // A filter matching parents and children: P1 and its children are kept.
    const both = tmodel('1');
    expect([...selectAll(both, [])].sort()).toEqual(['0.1', '1', '1.0', '1.1', '1.2', '2.1']);
    expect(both.branchCheckAll(new Set(['0.1', '2.1']))).toBe('some');
  });

  it('a parent the filter keeps without its children is blocked', () => {
    // 'P1' matches P1 alone.
    const m = tmodel('P1');
    expect(states(m, [])).toEqual({ '1': 'blocked' });
    expect(tick(m, [], '1')).toEqual([]);
    expect(selectAll(m, [])).toEqual([]);
    // Nothing to tick: select-all is blocked too.
    expect(m.branchCheckAll(new Set())).toBe('blocked');
    expect(m.branchCheckAll(new Set(['1.0', '1.1', '1.2']))).toBe('none');
    // With its hidden children selected, ticking it adds its id: not blocked.
    expect(states(m, ['1.0', '1.1', '1.2'])).toEqual({ '1': 'none' });
    expect(tick(m, ['1.0', '1.1', '1.2'], '1')).toEqual(['1.0', '1.1', '1.2', '1']);
    // Cleared, the filter leaves nothing blocked.
    m.update({ quickFilter: undefined });
    expect(Object.values(states(m, [])).every((state) => state === 'none')).toBe(true);
  });

  it('blocked rows are left out of the select-all state', () => {
    // P1 matches without its children; C0.1 matches under P0.
    const m = tmodel(undefined, ['P1', 'C0.1']);
    expect(states(m, [])).toEqual({ '0': 'none', '0.1': 'none', '1': 'blocked' });
    const all = selectAll(m, []);
    expect(all).toEqual(['0.1']);
    expect(m.branchCheckAll(new Set(all))).toBe('all');
    expect(states(m, all)).toEqual({ '0': 'some', '0.1': 'all', '1': 'blocked' });
  });

  it('a row with only blocked rows under it is blocked, and they keep its parent out', () => {
    // G{P{P1, P2}, Q}: a filter keeping P without its children.
    interface Named {
      name: string;
      kids?: Named[];
    }
    const nested: Named[] = [
      {
        name: 'G',
        kids: [{ name: 'P', kids: [{ name: 'P1' }, { name: 'P2' }] }, { name: 'Q' }],
      },
      { name: 'H', kids: [{ name: 'P', kids: [{ name: 'X' }] }] },
    ];
    const m = createTableModel<Named, string>({
      columns: [{ id: 'name', accessor: 'name' }],
      data: nested,
      getRowId: undefined,
      sorting: [],
      columnSizing: {},
      getSubRows: (row) => row.kids,
      treeExpanded: ['0', '0.0', '1'],
      columnFilters: { name: { kind: 'set', values: ['P', 'Q'] } },
    });
    const tree = m.branchTree();
    if (!tree) throw new Error('no tree');
    const check = m.branchCheck(new Set());
    const at: Record<string, string> = {};
    for (let i = 0; i < m.rowCount; i++) at[m.rowAt(i)?.id ?? ''] = check(i);
    expect(at).toEqual({
      '0': 'none',
      '0.0': 'blocked',
      '0.1': 'none',
      '1': 'blocked',
      '1.0': 'blocked',
    });
    // Ticking G selects Q; G then counts as checked (P keeps its id out) and unticks.
    expect(toggleBranch([], '0', tree)).toEqual(['0.1']);
    expect(toggleBranch(['0.1'], '0', tree)).toEqual([]);
    expect(toggleBranch([], '1', tree)).toEqual([]);
    expect(m.branchCheckAll(new Set(['0.1']))).toBe('all');
  });

  it('without a filter nothing changes', () => {
    const m = tmodel();
    const ticked = tick(m, [], '0');
    expect([...ticked].sort()).toEqual(['0', '0.0', '0.1', '0.2']);
    expect(states(m, ticked)).toMatchObject({ '0': 'all', '0.1': 'all', '1': 'none' });
    expect(m.branchCheckAll(new Set(ticked))).toBe('some');
    expect(tick(m, ticked, '0')).toEqual([]);
    expect(tick(m, ['0.0', '0.1', '0.2'], '0')).toEqual(['0.0', '0.1', '0.2', '0']);
    const all = selectAll(m, []);
    expect(all).toHaveLength(12);
    expect(m.branchCheckAll(new Set(all))).toBe('all');
    // A whole branch without its parent's id isn't all of it.
    expect(m.branchCheckAll(new Set(all.filter((id) => id !== '2')))).toBe('some');
  });

  it('select-all at a million rows under a filter stays linear', () => {
    const big: Node[] = Array.from({ length: 100_000 }, (_, p) => ({
      name: `P${String(p)}`,
      kids: Array.from({ length: 9 }, (_, c) => ({ name: `${c === 0 ? 'x' : 'y'}${String(c)}` })),
    }));
    const m = createTableModel<Node, string>({
      columns: [{ id: 'name', accessor: 'name' }],
      data: big,
      getRowId: undefined,
      sorting: [],
      columnSizing: {},
      getSubRows: (row) => row.kids,
      quickFilter: 'y',
    });
    const start = performance.now();
    const all = m.branchSelectAll([]);
    const state = m.branchCheckAll(new Set(all));
    const took = performance.now() - start;
    // Eight of each parent's nine children, and no parent.
    expect(all).toHaveLength(800_000);
    expect(state).toBe('all');
    expect(took).toBeLessThan(1000);
  });

  it('a grandparent whose shown rows are all selected unticks (no dead click three levels deep)', () => {
    // Root{Folder{report, other}}, a filter keeping `report`.
    interface Named {
      name: string;
      kids?: Named[];
    }
    const m = createTableModel<Named, string>({
      columns: [{ id: 'name', accessor: 'name' }],
      getRowId: undefined,
      sorting: [],
      columnSizing: {},
      data: [
        { name: 'Root', kids: [{ name: 'Folder', kids: [{ name: 'report' }, { name: 'other' }] }] },
      ],
      getSubRows: (row) => row.kids,
      treeExpanded: ['0', '0.0'],
      columnFilters: { name: { kind: 'set', values: ['report'] } },
    });
    const tree = m.branchTree();
    if (!tree) throw new Error('no tree');
    const ticked = toggleBranch([], '0', tree);
    expect(ticked).toEqual(['0.0.0']);
    const check = m.branchCheck(new Set(ticked));
    expect([check(0), check(1), check(2)]).toEqual(['some', 'some', 'all']);
    expect(m.branchCheckAll(new Set(ticked))).toBe('all');
    expect(toggleBranch(ticked, '0', tree)).toEqual([]);
    expect(toggleBranch(ticked, '0.0', tree)).toEqual([]);
    expect(toggleBranch([], '0', tree)).toEqual(['0.0.0']);
  });

  it('the header and a click agree on a controlled value with a gap two levels down', () => {
    // G{P{C{L, H}}}, a filter keeping L; P selected against the rules (C isn't).
    interface Named {
      name: string;
      kids?: Named[];
    }
    const m = createTableModel<Named, string>({
      columns: [{ id: 'name', accessor: 'name' }],
      getRowId: undefined,
      sorting: [],
      columnSizing: {},
      data: [
        {
          name: 'G',
          kids: [{ name: 'P', kids: [{ name: 'C', kids: [{ name: 'L' }, { name: 'H' }] }] }],
        },
      ],
      getSubRows: (row) => row.kids,
      treeExpanded: ['0', '0.0', '0.0.0'],
      columnFilters: { name: { kind: 'set', values: ['L'] } },
    });
    const tree = m.branchTree();
    if (!tree) throw new Error('no tree');
    const selection = ['0.0', '0.0.0.0'];
    // C's id is kept out by H, so G's is too: G counts as checked.
    expect(m.branchCheckAll(new Set(selection))).toBe('all');
    expect(toggleBranch(selection, '0', tree)).toEqual([]);
  });

  it('no click is dead, and a parent is selected only with its whole branch, over random trees and filters', () => {
    interface Flat {
      id: string;
      parent: string | null;
    }
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let deepest = 0;
    for (let round = 0; round < 150; round++) {
      // Up to 30 rows, most under one of the last few: deep chains.
      const count = 1 + Math.floor(next() * 30);
      const rows: Flat[] = Array.from({ length: count }, (_, i) => ({
        id: `r${String(i)}`,
        parent:
          i > 0 && next() < 0.85 ? `r${String(Math.max(0, i - 1 - Math.floor(next() * 3)))}` : null,
      }));
      const kids = new Map<string, string[]>();
      for (const row of rows) {
        if (row.parent !== null) kids.set(row.parent, [...(kids.get(row.parent) ?? []), row.id]);
      }
      const descendants = (id: string): string[] =>
        (kids.get(id) ?? []).flatMap((kid) => [kid, ...descendants(kid)]);
      const depthOf = (id: string): number => {
        const up = rows.find((row) => row.id === id)?.parent;
        return up ? 1 + depthOf(up) : 0;
      };
      deepest = Math.max(deepest, ...rows.map((row) => depthOf(row.id)));
      const filter = () =>
        next() < 0.75
          ? {
              id: {
                kind: 'set' as const,
                values: rows.filter(() => next() < 0.35).map((r) => r.id),
              },
            }
          : undefined;
      const m = createTableModel<Flat, string>({
        columns: [{ id: 'id', accessor: 'id' }],
        data: rows,
        getRowId: (row) => row.id,
        getParentId: (row) => row.parent,
        sorting: [],
        columnSizing: {},
        treeExpanded: rows.map((row) => row.id),
        columnFilters: filter(),
      });
      let selection: readonly string[] = [];
      for (let step = 0; step < 25; step++) {
        if (next() < 0.2) m.update({ columnFilters: filter() });
        const tree = m.branchTree();
        if (!tree) throw new Error('no tree');
        const kept: string[] = [];
        for (let i = 0; i < m.rowCount; i++) kept.push(m.rowAt(i)?.id ?? '');
        const selected = new Set(selection);
        const where = `round ${String(round)} step ${String(step)}`;
        // Select-all is withBranches over every kept row.
        expect([...m.branchSelectAll(selection)].sort(), where).toEqual(
          [...withBranches(selection, kept, tree)].sort(),
        );
        const check = m.branchCheck(selected);
        const tickable = kept.filter((_, i) => check(i) !== 'blocked');
        // Every row that isn't blocked changes the selection when clicked; a
        // blocked one could select nothing.
        for (const id of kept) {
          const after = toggleBranch(selection, id, tree);
          if (tickable.includes(id))
            expect(sameSelection(after, selection), `${where} ${id}`).toBe(false);
          else for (const row of after) expect(selection, `${where} ${id}`).toContain(row);
        }
        // The header changes the selection unless nothing can be ticked.
        const all = m.branchCheckAll(selected);
        expect(all === 'blocked', where).toBe(tickable.length === 0);
        if (all !== 'blocked') {
          const after = all === 'all' ? [] : m.branchSelectAll(selection);
          expect(sameSelection(after, selection), `${where} header`).toBe(false);
        }
        // A step: a click on a kept row, or the header.
        const id = kept[Math.floor(next() * kept.length)];
        if (next() < 0.8 && id !== undefined) selection = toggleBranch(selection, id, tree);
        else if (all !== 'blocked') selection = all === 'all' ? [] : m.branchSelectAll(selection);
        const has = new Set(selection);
        for (const row of selection) {
          for (const d of descendants(row)) expect(has.has(d), `${where} R1 ${row}`).toBe(true);
        }
      }
    }
    expect(deepest).toBeGreaterThanOrEqual(3);
  });
});
