import { describe, expect, it } from 'vitest';
import type { ColumnDef } from '../types.js';
import {
  createTableModel,
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
    expect(m.rowAt(2)).toBe(m.rowAt(2));
    expect(m.cellContext(0, 'city')).toEqual({
      row: people[0],
      rowId: 'p1',
      index: 0,
      columnId: 'city',
      value: 'Bonn',
    });
    expect(m.cellContext(0, 'missing')).toBeUndefined();
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
    expect(m.nextOrder(SELECTION_COLUMN_ID, 0)).toBeUndefined();
    // Positions in the order don't count it: 'name' moves to the first place.
    expect(m.nextOrder('name', 0)).toEqual(['name', 'id', 'age', 'city', 'note', 'actions']);
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
    // One read per row, plus the few rows TanStack samples to pick a sort function.
    expect(reads).toBeLessThanOrEqual(1000 + 10 + 1);
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

  it('proposes a move within a group and refuses one across groups', () => {
    const m = model();
    expect(m.nextOrder('note', 2)).toEqual(['id', 'name', 'note', 'age', 'city', 'actions']);
    expect(m.nextOrder('id', 1)).toEqual(['name', 'id', 'age', 'city', 'note', 'actions']);
    expect(m.nextOrder('age', 1)).toBeUndefined();
    expect(m.nextOrder('note', 5)).toBeUndefined();
    expect(m.nextOrder('age', 2)).toBeUndefined();
  });

  it('proposes from a given base order, so moves can compose before an update', () => {
    const m = model();
    const first = m.nextOrder('note', 2);
    expect(m.nextOrder('note', 3, first)).toEqual(['id', 'name', 'age', 'note', 'city', 'actions']);
    expect(m.orderOf(['city'])).toEqual(['id', 'name', 'city', 'age', 'note', 'actions']);
  });

  it('refuses to move a column with reorderable: false, but moves others past it', () => {
    const m = model({ columns: [{ id: 'a', reorderable: false }, { id: 'b' }, { id: 'c' }] });
    expect(m.columns[0]?.reorderable).toBe(false);
    expect(m.nextOrder('a', 2)).toBeUndefined();
    expect(m.nextOrder('c', 0)).toEqual(['c', 'a', 'b']);
  });

  it('keeps the order for a new columns array and appends new columns to their group', () => {
    const m = model({ columnOrder: ['note', 'age', 'city'] });
    m.update({ columns: [...columns, { id: 'extra' }, { id: 'pin2', pin: 'start' }] });
    expect(order(m)).toEqual(['id', 'name', 'pin2', 'note', 'age', 'city', 'extra', 'actions']);
  });

  it('keeps the row model when only the order changes', () => {
    const m = model({ sorting: [{ id: 'name', desc: false }] });
    const before = m.rowAt(0);
    m.update({ columnOrder: ['city'] });
    expect(m.rowAt(0)).toBe(before);
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
    expect(m.nextOrder('note', 4)).toEqual(['city', 'name', 'id', 'age', 'note', 'actions']);
    expect(m.nextOrder('note', 2)).toBeUndefined();
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
    const before = m.rowAt(0);
    m.update({ columnPinning: { age: 'start' } });
    expect(m.rowAt(0)).toBe(before);
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
    expect(m.nextOrder('age', 3)).toEqual(['id', 'name', 'city', 'note', 'age', 'actions']);
    expect(m.nextOrder('city', 2)).toBeUndefined();
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
    const first = m.rowAt(0);
    m.update({ columnSizing: { age: 99 } });
    expect(m.rowAt(0)).toBe(first);
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
  });
});

describe('createTableModel: caching', () => {
  it('keeps the row model when only unrelated options change', () => {
    const m = model();
    const before = m.rowAt(0);
    m.update({ columnSizing: { age: 99 } });
    expect(m.rowAt(0)).toBe(before);
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
  // Same id, new accessor: the values TanStack caches per row and the sorted
  // order must follow, without new data.
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

  it('reads nothing again when the accessor is the same', () => {
    let calls = 0;
    const read = (p: Person) => (calls++, p.age);
    const m = model({ columns: withAge(read), sorting: [{ id: 'age', desc: false }] });
    expect(ages(m)).toEqual([9, 30, 41, undefined]);
    const after = calls;
    m.update({ columns: withAge(read) });
    expect(ages(m)).toEqual([9, 30, 41, undefined]);
    expect(calls).toBe(after);
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
    // Columns still come from TanStack, with the sort state on them.
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
