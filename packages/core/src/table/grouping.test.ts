import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemoteGroups } from '../data/remote-groups.js';
import { sameSelection, toggleBranch } from '../state/selection.js';
import type { ColumnDef } from '../types.js';
import { createTableModel, type TableModelOptions } from './create-table.js';

interface Sale {
  name: string;
  region: string;
  status: string;
  amount: number;
}

const sales: Sale[] = [
  { name: 'a', region: 'EU', status: 'Open', amount: 10 },
  { name: 'b', region: 'APAC', status: 'Done', amount: 5 },
  { name: 'c', region: 'EU', status: 'Done', amount: 7 },
  { name: 'd', region: 'APAC', status: 'Open', amount: 30 },
  { name: 'e', region: 'EU', status: 'Open', amount: 1 },
];

const columns: ColumnDef<Sale, string>[] = [
  { id: 'name', accessor: 'name', sortable: true },
  { id: 'region', accessor: 'region', groupable: true, sortable: true },
  { id: 'status', accessor: 'status', groupable: true },
  { id: 'amount', accessor: 'amount', sortable: true, aggregate: 'sum' },
  { id: 'plain', accessor: 'amount', sortable: true },
];

const model = (overrides: Partial<TableModelOptions<Sale, string>> = {}) =>
  createTableModel<Sale, string>({
    columns,
    data: sales,
    getRowId: (row) => row.name,
    sorting: [],
    columnSizing: {},
    grouping: ['region'],
    ...overrides,
  });

const APAC = '\u0000g["region","APAC"]';
const EU = '\u0000g["region","EU"]';

/** Each shown row: a group's value, or a data row's name. */
const shown = (m: ReturnType<typeof model>) =>
  Array.from({ length: m.rowCount }, (_, i) => {
    const group = m.rows.groupAt(i);
    return group ? `[${String(group.value)}]` : m.rowAt(i)?.original.name;
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('grouping', () => {
  it('shows closed group rows, in value order, with their counts and totals', () => {
    const m = model();
    expect(m.tree).toBe(true);
    expect(m.rows.grouped).toBe(true);
    expect(shown(m)).toEqual(['[APAC]', '[EU]']);
    expect(m.rows.groupAt(0)).toEqual({
      id: APAC,
      groupColumnId: 'region',
      value: 'APAC',
      count: 2,
      depth: 0,
      totals: { amount: 35 },
    });
    expect(m.rowAt(0)).toBeUndefined();
    expect(m.valueAt(0, 'region')).toBeUndefined();
    expect(m.cellContext(0, 'region')).toBeUndefined();
    expect(m.treeRow(0)).toMatchObject({ hasChildren: true, open: false, forced: false, depth: 0 });
    expect(m.rows.idAt(0)).toBe(APAC);
  });

  it('opens a group through treeExpanded: its rows follow it, one level down', () => {
    const m = model({ treeExpanded: [EU] });
    expect(shown(m)).toEqual(['[APAC]', '[EU]', 'a', 'c', 'e']);
    expect(m.treeRow(2)).toMatchObject({ depth: 1, parent: 1, setSize: 3, posInSet: 1 });
    expect(m.cellContext(2, 'name')).toMatchObject({ row: sales[0], rowId: 'a', depth: 1 });
    expect(m.nextTreeExpanded(APAC, true)).toEqual([EU, APAC]);
    // Data rows have no children to open.
    expect(m.nextTreeExpanded('a', true)).toBeUndefined();
    expect(m.indexOf('c')).toBe(3);
  });

  it('nests groups: two levels, ids along the path', () => {
    const open = '\u0000g["region","EU","status","Open"]';
    const m = model({ grouping: ['region', 'status'], treeExpanded: [EU, open] });
    expect(shown(m)).toEqual(['[APAC]', '[EU]', '[Done]', '[Open]', 'a', 'e']);
    expect(m.rows.groupAt(3)).toMatchObject({
      id: open,
      depth: 1,
      count: 2,
      totals: { amount: 11 },
    });
    expect(m.rows.depthAt(4)).toBe(2);
  });

  it('sorting by a totalled column orders groups by their totals and rows within them', () => {
    const m = model({ treeExpanded: [APAC, EU], sorting: [{ id: 'amount', desc: true }] });
    expect(shown(m)).toEqual(['[APAC]', 'd', 'b', '[EU]', 'a', 'c', 'e']);
    const asc = model({ treeExpanded: [APAC, EU], sorting: [{ id: 'amount', desc: false }] });
    expect(shown(asc)).toEqual(['[EU]', 'e', 'c', 'a', '[APAC]', 'b', 'd']);
  });

  it('a count of a text column sorts groups as numbers, not as text', () => {
    const counted = columns.map((c) =>
      c.id === 'name' ? { ...c, aggregate: 'count' as const } : c,
    );
    const many: Sale[] = [
      ...Array.from({ length: 12 }, (_, i) => ({
        name: `x${String(i)}`,
        region: 'Big',
        status: 'Open',
        amount: 1,
      })),
      ...Array.from({ length: 9 }, (_, i) => ({
        name: `y${String(i)}`,
        region: 'Small',
        status: 'Open',
        amount: 1,
      })),
    ];
    const m = model({ columns: counted, data: many, sorting: [{ id: 'name', desc: true }] });
    expect(shown(m)).toEqual(['[Big]', '[Small]']);
    m.update({ sorting: [{ id: 'name', desc: false }] });
    expect(shown(m)).toEqual(['[Small]', '[Big]']);
  });

  it('new columns or grouping arrays with the same contents keep the groups and the order', () => {
    const m = model({ treeExpanded: [EU] });
    const order = m.rowOrder;
    m.update({ columns: [...columns], grouping: ['region'] });
    expect(m.rowOrder).toBe(order);
    // A new getRowId gives the rows new ids.
    m.update({ getRowId: (row) => row.name.toUpperCase() });
    expect(m.rowOrder).not.toBe(order);
    expect(m.rows.idAt(2)).toBe('A');
  });

  it('sorting by a column without a total keeps groups in value order', () => {
    const m = model({ treeExpanded: [APAC, EU], sorting: [{ id: 'plain', desc: true }] });
    expect(shown(m)).toEqual(['[APAC]', 'd', 'b', '[EU]', 'a', 'c', 'e']);
    const byName = model({ sorting: [{ id: 'name', desc: true }] });
    expect(shown(byName)).toEqual(['[APAC]', '[EU]']);
  });

  it('sorting by the grouped column reverses the groups', () => {
    const m = model({ sorting: [{ id: 'region', desc: true }] });
    expect(shown(m)).toEqual(['[EU]', '[APAC]']);
  });

  it('filters apply to the rows: counts and totals follow, empty groups go', () => {
    const m = model({ columnFilters: { status: { kind: 'text', op: 'equals', value: 'Open' } } });
    expect(shown(m)).toEqual(['[APAC]', '[EU]']);
    expect(m.rows.groupAt(1)).toMatchObject({ count: 2, totals: { amount: 11 } });
    const apac = model({ quickFilter: 'apac' });
    expect(shown(apac)).toEqual(['[APAC]']);
  });

  it('ignores ids of columns that aren’t groupable, and unknown ones', () => {
    expect(model({ grouping: ['name', 'nope'] }).rows.grouped).toBe(false);
    expect(shown(model({ grouping: ['name', 'region'] }))).toEqual(['[APAC]', '[EU]']);
  });

  it('is ignored, with one warning, with tree rows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const m = model({ getSubRows: () => undefined });
    expect(m.rows.grouped).toBe(false);
    expect(m.rowCount).toBe(5);
    expect(m.rowCount).toBe(5);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('a hidden grouped column still groups', () => {
    const m = model({ columnVisibility: { region: false } });
    expect(shown(m)).toEqual(['[APAC]', '[EU]']);
  });

  it('open groups stay open by their ids: across new data, and a grouping changed and back', () => {
    const m = model({ treeExpanded: [EU] });
    m.update({ data: [...sales] });
    expect(shown(m)).toEqual(['[APAC]', '[EU]', 'a', 'c', 'e']);
    m.update({ grouping: ['status'] });
    expect(shown(m)).toEqual(['[Done]', '[Open]']);
    m.update({ grouping: ['region'] });
    expect(shown(m)).toEqual(['[APAC]', '[EU]', 'a', 'c', 'e']);
    // A group whose rows all left is gone.
    m.update({ data: sales.filter((s) => s.region === 'EU') });
    expect(shown(m)).toEqual(['[EU]', 'a', 'c', 'e']);
  });

  it('a closed group stands for its rows; selection never holds a group id', () => {
    const m = model();
    expect(m.shownAncestor('c')).toBe(1);
    expect(m.selectableIds()).toEqual([]);
    const open = model({ treeExpanded: [EU] });
    expect(open.selectableIds()).toEqual(['a', 'c', 'e']);
    const tree = open.branchTree();
    if (!tree) throw new Error('no branch tree');
    const ticked = toggleBranch([], EU, tree);
    expect(sameSelection(ticked, ['a', 'c', 'e'])).toBe(true);
    expect(open.branchCheck(new Set(ticked))(1)).toBe('all');
    expect(open.branchCheck(new Set(['a']))(1)).toBe('some');
    expect(open.branchCheckAll(new Set(['a', 'b', 'c', 'd', 'e']))).toBe('all');
    expect(open.branchCheckAll(new Set(ticked))).toBe('some');
    expect(open.branchSelectAll([])).toEqual(['b', 'd', 'a', 'c', 'e']);
  });

  it('groupedOrder lists group rows and every kept row, closed groups’ too, in sort order', () => {
    const order = model({ sorting: [{ id: 'amount', desc: true }] }).groupedOrder();
    expect(order?.map((r) => r.id)).toEqual([APAC, 'd', 'b', EU, 'a', 'c', 'e']);
    expect(order?.map((r) => r.depth)).toEqual([0, 1, 1, 0, 1, 1, 1]);
    expect(order?.filter((r) => !r.group).map((r) => r.index)).toEqual([3, 1, 0, 2, 4]);
    expect(order?.[0]?.group).toMatchObject({ value: 'APAC', count: 2, totals: { amount: 35 } });
    expect(model({ grouping: [] }).groupedOrder()).toBeUndefined();
  });

  it('without grouping, nothing is grouped', () => {
    const m = model({ grouping: [] });
    expect(m.rows.grouped).toBe(false);
    expect(m.rows.groupAt(0)).toBeUndefined();
    expect(m.tree).toBe(false);
    expect(m.rowCount).toBe(5);
  });
});

describe('grouping with a data source', () => {
  /** EU open with its two rows loaded, US closed. */
  const remote = () => {
    const groups = new RemoteGroups<Sale>({
      grouping: ['region'],
      pageSize: 10,
      expanded: [EU],
      getRowId: (row) => row.name,
    });
    const answer = (
      key: string,
      response: { rows: unknown[]; groups?: unknown[]; total?: number },
    ) => {
      const level = groups.levels().find((l) => l.key === key);
      if (!level) throw new Error(`no level ${key}`);
      groups.cacheOf(level)?.begin(0);
      groups.resolve(level, 0, response);
    };
    answer('', {
      rows: [],
      groups: [
        { value: 'EU', count: 2 },
        { value: 'US', count: 1 },
      ],
      total: 2,
    });
    answer(EU, { rows: [sales[0], sales[2]] });
    return model({ data: [], remote: groups });
  };

  it('reads the remote as grouped rows', () => {
    const m = remote();
    expect(m.tree).toBe(true);
    expect(m.rows.grouped).toBe(true);
    expect(m.rowCount).toBe(4);
    expect(m.rowAt(0)).toBeUndefined();
    expect(m.cellContext(0, 'name')).toBeUndefined();
    expect(m.cellContext(1, 'name')).toMatchObject({ row: sales[0], rowId: 'a', depth: 1 });
    expect(m.rows.groupAt(3)).toMatchObject({ value: 'US', count: 1, depth: 0 });
  });

  it('selects by group over the loaded rows; a group is checked when they are', () => {
    const m = remote();
    expect(m.branchSelectAll([])).toEqual(['a', 'c']);
    expect(m.branchCheck(new Set(['a', 'c']))(0)).toBe('all');
    expect(m.branchCheck(new Set(['a']))(0)).toBe('some');
    expect(m.nextTreeExpanded('\u0000g["region","US"]', true)).toEqual(['\u0000g["region","US"]']);
  });
});
