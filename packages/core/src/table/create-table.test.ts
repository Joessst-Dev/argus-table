import { describe, expect, it } from 'vitest';
import type { ColumnDef } from '../types.js';
import { createTableModel, type TableModelOptions } from './create-table.js';

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
  });

  it('follows new columns', () => {
    const m = model();
    m.update({ columns: [{ id: 'name', accessor: 'name' }] });
    expect(m.columns.map((c) => c.id)).toEqual(['name']);
    expect(m.totalWidth).toBe(150);
  });
});

describe('createTableModel: sorting', () => {
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
      remote: { rowCount: 50, entryAt: () => undefined, indexOf: () => undefined },
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
