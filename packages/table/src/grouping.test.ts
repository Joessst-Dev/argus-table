import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ArgusPlugin, ArgusTable, ColumnDef, PluginHost } from './index.js';
import { fixture, rowsInOrder, settle } from './test-utils.js';

interface Sale {
  id: string;
  region: string;
  status: string;
  amount: number;
}

const sales: Sale[] = [
  { id: 's1', region: 'EU', status: 'Open', amount: 10 },
  { id: 's2', region: 'APAC', status: 'Done', amount: 5 },
  { id: 's3', region: 'EU', status: 'Done', amount: 7 },
  { id: 's4', region: 'APAC', status: 'Open', amount: 30 },
  { id: 's5', region: 'EU', status: 'Open', amount: 1 },
];

const columns: ColumnDef<Sale>[] = [
  { id: 'name', accessor: 'id', header: 'Sale' },
  { id: 'region', accessor: 'region', header: 'Region', groupable: true },
  { id: 'status', accessor: 'status', header: 'Status', groupable: true },
  { id: 'amount', accessor: 'amount', header: 'Amount', aggregate: 'sum' },
];

const EU = '\u0000g["region","EU"]';

/** A plugin that hands the test its host. */
function hostOf(): { plugin: ArgusPlugin<Sale>; host: () => PluginHost<Sale> } {
  let host: PluginHost<Sale> | undefined;
  return {
    plugin: {
      name: 'test-host',
      connect(h) {
        host = h;
      },
    },
    host: () => {
      if (!host) throw new Error('not connected');
      return host;
    },
  };
}

const mount = (props: Partial<ArgusTable<Sale>> = {}) =>
  fixture<Sale>({ columns, data: sales, getRowId: (row) => row.id, ...props });

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('grouping', () => {
  test('groups the body: group rows count, and the table is a treegrid', async () => {
    const el = await mount({ grouping: ['region'] });
    expect(el.getAttribute('role')).toBe('treegrid');
    expect(rowsInOrder(el)).toHaveLength(2);
    el.treeExpanded = [EU];
    await settle(el);
    expect(rowsInOrder(el)).toHaveLength(5);
  });

  test('setGrouping: uncontrolled, applies and fires after the update', async () => {
    const { plugin, host } = hostOf();
    const el = await mount({ plugins: [plugin] });
    const seen: unknown[] = [];
    el.addEventListener('argus-grouping-change', (e) => {
      seen.push({ detail: e.detail, applied: el.grouping });
    });
    host().setGrouping(['region', 'name'], 'region');
    expect(seen).toEqual([]);
    await settle(el);
    // `name` isn't groupable: left out.
    expect(seen).toEqual([
      { detail: { grouping: ['region'], columnId: 'region' }, applied: ['region'] },
    ]);
    expect(host().grouping()).toEqual(['region']);
    // No change, no event.
    host().setGrouping(['region'], 'region');
    await settle(el);
    expect(seen).toHaveLength(1);
  });

  test('setGrouping: controlled, fires the proposed value right away and changes nothing', async () => {
    const { plugin, host } = hostOf();
    const el = await mount({ plugins: [plugin], grouping: [] });
    const seen: unknown[] = [];
    el.addEventListener('argus-grouping-change', (e) => seen.push(e.detail));
    host().setGrouping(['status'], 'status');
    expect(seen).toEqual([{ grouping: ['status'], columnId: 'status' }]);
    await settle(el);
    expect(el.grouping).toEqual([]);
  });

  test('group(), groupedRows(): group rows and every data row in grouped order', async () => {
    const { plugin, host } = hostOf();
    await mount({ plugins: [plugin], grouping: ['region'] });
    expect(host().group(0)).toEqual({
      id: '\u0000g["region","APAC"]',
      groupColumnId: 'region',
      value: 'APAC',
      count: 2,
      depth: 0,
      totals: { amount: 35 },
    });
    expect(
      host()
        .groupedRows()
        ?.map((r) => r.id),
    ).toEqual(['s2', 's4', 's1', 's3', 's5']);
    expect(host().groupedRows()?.[0]?.row).toBe(sales[1]);
    expect(host().column('region')?.groupable).toBe(true);
  });

  test('group() is undefined for data rows; groupedRows() without grouping', async () => {
    const { plugin, host } = hostOf();
    const el = await mount({ plugins: [plugin], grouping: ['region'], treeExpanded: [EU] });
    expect(host().group(2)).toBeUndefined();
    el.grouping = [];
    await settle(el);
    expect(host().groupedRows()).toBeUndefined();
  });

  test('getState() and setState() carry grouping; setState leaves a controlled one alone', async () => {
    const el = await mount();
    await el.setState({ grouping: ['status'] });
    expect(el.getState().grouping).toEqual(['status']);
    const controlled = await mount({ grouping: [] });
    await controlled.setState({ grouping: ['status'] });
    expect(controlled.grouping).toEqual([]);
  });

  test('with a dataSource, grouping is ignored with one warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = await mount({
      data: [],
      dataSource: { getRows: () => Promise.resolve({ rows: sales, total: sales.length }) },
      grouping: ['region'],
    });
    await settle(el);
    expect(el.getAttribute('role')).toBe('grid');
    expect(warn.mock.calls.filter(([m]) => String(m).includes('grouping'))).toHaveLength(1);
  });
});
