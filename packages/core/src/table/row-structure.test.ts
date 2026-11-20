import { describe, expect, it } from 'vitest';
import { PageCache } from '../data/page-cache.js';
import { RemoteTree } from '../data/remote-tree.js';
import type { ColumnDef } from '../types.js';
import { createTableModel } from './create-table.js';
import type { TableModelOptions } from './model-types.js';
import { plainStandIn, plainStandInId, type RowStructure } from './row-structure.js';

// The row structures, through the model members that delegate to them: one
// contract for `data`'s rows (flat and a tree), a flat data source and a data
// source's tree.

interface Item {
  name: string;
  kids?: Item[];
  count?: number;
}

/** A row's id, loaded or not, as the table reads it. */
const idAt = (m: { rows: RowStructure }, index: number) =>
  m.rows.idAt(index) ?? m.rows.standInId(index);

const columns: ColumnDef<Item, string>[] = [{ id: 'name', accessor: 'name' }];

const model = (overrides: Partial<TableModelOptions<Item, string>>) =>
  createTableModel<Item, string>({
    columns,
    data: [],
    getRowId: undefined,
    sorting: [],
    columnSizing: {},
    ...overrides,
  });

const flatData: Item[] = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
const treeData: Item[] = [
  { name: 'A', kids: [{ name: 'A1' }, { name: 'A2' }] },
  { name: 'B', kids: [{ name: 'B1' }] },
];

/** Six top-level rows on pages of four; the first page loaded. B (`'1'`) and D (`'3'`) have children. */
const remoteTree = () => {
  const cache = new PageCache<Item>({ pageSize: 4 });
  cache.begin(0);
  cache.resolve(
    0,
    [{ name: 'A' }, { name: 'B', count: 2 }, { name: 'C' }, { name: 'D', count: 1 }],
    6,
  );
  const tree = new RemoteTree(cache, { hasChildren: (row) => (row.count ?? 0) > 0 });
  return { cache, tree, m: model({ remote: tree }) };
};

const pagedCache = () => {
  const cache = new PageCache<Item>({ pageSize: 4 });
  cache.begin(0);
  cache.resolve(0, flatData, 10);
  return cache;
};

describe('row structures: shared contract', () => {
  const fixtures = [
    { name: 'data, flat', make: () => model({ data: flatData }), unloaded: 7, moves: false },
    {
      name: 'data, a tree',
      make: () => model({ data: treeData, getSubRows: (row) => row.kids, treeExpanded: ['0'] }),
      unloaded: 9,
      moves: false,
    },
    {
      name: 'a flat data source',
      make: () => model({ remote: pagedCache() }),
      unloaded: 6,
      moves: false,
    },
    { name: "a data source's tree", make: () => remoteTree().m, unloaded: 5, moves: true },
  ];

  describe.each(fixtures)('$name', ({ make, unloaded, moves }) => {
    it('gives loaded rows their ids without a row view', () => {
      const m = make();
      for (let i = 0; i < m.rowCount; i++) {
        const id = m.rowAt(i)?.id;
        if (id !== undefined) expect(idAt(m, i)).toBe(id);
      }
    });

    it('round-trips a stand-in id of a row not loaded', () => {
      const m = make();
      expect(m.rows.standIn(idAt(m, unloaded))).toEqual({ index: unloaded, same: true, moves });
      expect(m.rows.standIn('nope')).toBeUndefined();
    });
  });
});

describe('row structures: data', () => {
  it('flat rows are loaded and not a tree', () => {
    const m = model({ data: flatData });
    expect(m.tree).toBe(false);
    expect(m.rows.stateAt(0)).toBe('loaded');
    expect(m.rows.depthAt(0)).toBeUndefined();
    expect(m.rows.parentAt(0)).toBeUndefined();
    expect(m.rows.toggleId(0)).toBeUndefined();
    expect(idAt(m, 5)).toBe('5');
  });

  it('reserves stand-in ids when ids come from getRowId', () => {
    const m = model({ data: flatData, getRowId: (row) => row.name });
    expect(idAt(m, 0)).toBe('A');
    expect(idAt(m, 5)).toBe('\u00005');
  });

  it('a tree gives parents, depths and toggle ids', () => {
    const m = model({ data: treeData, getSubRows: (row) => row.kids, treeExpanded: ['0'] });
    expect(m.rows.parentAt(1)).toBe(0);
    expect(m.rows.parentAt(0)).toBeUndefined();
    expect(m.rows.depthAt(1)).toBe(1);
    expect(m.rows.depthAt(3)).toBe(0);
    expect(m.rows.toggleId(0)).toBe('0');
    // B's child B1 is under a collapsed row: B stands for it.
    expect(m.shownAncestor('1.0')).toBe(3);
  });

  it("doesn't toggle a row a filter keeps open, but takes its id from the host", () => {
    const m = model({
      data: treeData,
      getSubRows: (row) => row.kids,
      columnFilters: { name: { kind: 'text', op: 'equals', value: 'A1' } },
    });
    expect(m.treeRow(0)).toMatchObject({ forced: true });
    expect(m.rows.toggleId(0)).toBeUndefined();
    expect(m.nextTreeExpanded('0', false, ['0'])).toEqual([]);
  });
});

describe('row structures: a flat data source', () => {
  it('reads row states from the cache, with no tree', () => {
    const m = model({ remote: pagedCache() });
    expect(m.tree).toBe(false);
    expect(m.rows.stateAt(0)).toBe('loaded');
    expect(m.rows.stateAt(6)).toBe('loading');
    expect(idAt(m, 6)).toBe('6');
    for (const read of [m.treeRow(0), m.rows.depthAt(0), m.rows.parentAt(0), m.rows.toggleId(0)]) {
      expect(read).toBeUndefined();
    }
    expect(m.nextTreeExpanded('0', true, [])).toBeUndefined();
    expect(m.sourceRow(0)).toBeUndefined();
  });

  it('counts stubbed rows without states as loaded', () => {
    const m = model({
      remote: {
        rowCount: 3,
        entryAt: () => undefined,
        indexOf: () => undefined,
        loadedIds: () => [],
      },
    });
    expect(m.rows.stateAt(1)).toBe('loaded');
    expect(m.tree).toBe(false);
  });

  it('reserves stand-in ids with getRowId', () => {
    const cache = pagedCache();
    expect(idAt(model({ remote: cache }), 7)).toBe('7');
    expect(idAt(model({ remote: cache, getRowId: (row) => row.name }), 7)).toBe('\u00007');
  });
});

describe("row structures: a data source's tree", () => {
  it('gives parents and depths of loaded rows and placeholders', () => {
    const { tree, m } = remoteTree();
    tree.setExpanded(['1']);
    tree.beginChildren('1');
    tree.resolveChildren('1', [{ name: 'B1' }, { name: 'B2' }]);
    expect(m.rows.parentAt(2)).toBe(1);
    expect(m.rows.depthAt(2)).toBe(1);
    tree.setExpanded(['1', '3']);
    tree.beginChildren('3');
    // A, B, B1, B2, C, D, D's loading row.
    expect(m.rows.stateAt(6)).toBe('loading');
    expect(m.treeRow(6)).toBeUndefined();
    expect(m.rows.parentAt(6)).toBe(5);
    expect(m.rows.depthAt(6)).toBe(1);
  });

  it("keeps a loading child row's stand-in as rows load above it", () => {
    const { tree, m } = remoteTree();
    tree.setExpanded(['3']);
    tree.beginChildren('3');
    // A, B, C, D, D's loading row.
    const id = idAt(m, 4);
    expect(id.startsWith('\u0000c')).toBe(true);
    tree.setExpanded(['3', '1']);
    tree.beginChildren('1');
    tree.resolveChildren('1', [{ name: 'B1' }, { name: 'B2' }]);
    expect(m.rows.standIn(id)).toEqual({ index: 6, same: true, moves: true });
    // Its children came: the stand-in now holds the loaded child.
    tree.resolveChildren('3', [{ name: 'D1' }]);
    expect(m.rows.standIn(id)).toEqual({ index: 6, same: true, moves: true });
    expect(idAt(m, 6)).toBe('3.0');
    // Collapsed: its parent stands for it.
    tree.setExpanded(['1']);
    expect(m.rows.standIn(id)).toEqual({ index: 5, same: false, moves: true });
  });

  it('names an unloaded top-level row by its top-level index', () => {
    const { tree, m } = remoteTree();
    expect(idAt(m, 5)).toBe('\u0000t5');
    tree.setExpanded(['1']);
    tree.beginChildren('1');
    tree.resolveChildren('1', [{ name: 'B1' }, { name: 'B2' }]);
    expect(m.rows.standIn('\u0000t5')).toEqual({ index: 7, same: true, moves: true });
  });

  it('toggles rows with children, and closes ids not loaded', () => {
    const { tree, m } = remoteTree();
    tree.setExpanded(['1']);
    tree.beginChildren('1');
    tree.resolveChildren('1', [{ name: 'B1' }]);
    expect(m.rows.toggleId(1)).toBe('1');
    // A leaf's toggle changes nothing.
    expect(m.rows.toggleId(2)).toBe('1.0');
    expect(m.nextTreeExpanded('1.0', true, [])).toBeUndefined();
    expect(m.nextTreeExpanded('99', false, ['99'])).toEqual([]);
    expect(m.nextTreeExpanded('0', true, [])).toBeUndefined();
  });
});

describe('plain stand-in ids', () => {
  it('round-trip, reserved or not', () => {
    expect(plainStandIn(plainStandInId(3, true), true)).toEqual({
      index: 3,
      same: true,
      moves: false,
    });
    expect(plainStandIn(plainStandInId(3, false), false)).toEqual({
      index: 3,
      same: true,
      moves: false,
    });
    expect(plainStandIn('3', true)).toBeUndefined();
    expect(plainStandIn('\u00003', false)).toBeUndefined();
  });
});

describe('row structures: the row order keeps its identity', () => {
  it('for data, across an update that only resizes', () => {
    const m = model({ data: treeData, getSubRows: (row) => row.kids, treeExpanded: ['0'] });
    const order = m.rowOrder;
    m.update({ columnSizing: { name: 120 } });
    expect(m.rowOrder).toBe(order);
  });

  it("for a data source's tree, across an update that only resizes", () => {
    const { m } = remoteTree();
    const order = m.rowOrder;
    m.update({ columnSizing: { name: 120 } });
    expect(m.rowOrder).toBe(order);
  });
});
