import { afterEach, describe, expect, test, vi } from 'vitest';
import { LOAD_DEBOUNCE_MS } from './controllers/data-controller.js';
import type {
  ArgusTable,
  ColumnDef,
  DataSource,
  GroupData,
  LoadErrorDetail,
  RowsRequest,
} from './index.js';
import { fixture, rowText, rowsInOrder, settle } from './test-utils.js';

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
  { id: 's6', region: 'US', status: 'Open', amount: 4 },
];

const columns: ColumnDef<Sale>[] = [
  { id: 'name', accessor: 'id', header: 'Sale' },
  { id: 'region', accessor: 'region', header: 'Region', groupable: true },
  { id: 'status', accessor: 'status', header: 'Status', groupable: true },
  { id: 'amount', accessor: 'amount', header: 'Amount', sortable: true },
];

const EU = '\u0000g["region","EU"]';

/**
 * A server that groups `sales` by the request's `grouping` and `groupPath`,
 * sums the amounts, and records each request. `wrong` answers rows where
 * groups belong.
 */
function server(options: { pageSize?: number; wrong?: boolean } = {}) {
  const requests: RowsRequest[] = [];
  const source: DataSource<Sale> = {
    pageSize: options.pageSize ?? 100,
    getRows(request) {
      requests.push(request);
      const grouping = request.grouping ?? [];
      const path = request.groupPath ?? [];
      const rows = sales.filter((s) => path.every((p) => s[p.columnId as keyof Sale] === p.value));
      if (path.length === grouping.length || options.wrong) {
        const page = rows.slice(request.start, request.end);
        return Promise.resolve({ rows: page, total: rows.length });
      }
      const column = grouping[path.length] as keyof Sale;
      const values = [...new Set(rows.map((s) => s[column]))].sort();
      const groups: GroupData[] = values.map((value) => {
        const inGroup = rows.filter((s) => s[column] === value);
        return {
          value,
          count: inGroup.length,
          totals: { amount: inGroup.reduce((sum, s) => sum + s.amount, 0) },
        };
      });
      return Promise.resolve({
        rows: [],
        groups: groups.slice(request.start, request.end),
        total: groups.length,
      });
    },
  };
  return { source, requests };
}

/** Waits for the debounce, the answers and the updates they cause. */
async function loaded(el: ArgusTable<Sale>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, LOAD_DEBOUNCE_MS + 20));
    await settle(el);
  }
}

const texts = (el: ArgusTable<Sale>) => rowsInOrder(el).map((r) => rowText(r));

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('grouping with a data source', () => {
  test('loads the top-level groups with their counts and totals', async () => {
    const { source, requests } = server();
    const el = await fixture<Sale>({ columns, data: [], dataSource: source, grouping: ['region'] });
    await loaded(el);
    expect(requests[0]).toMatchObject({ grouping: ['region'], groupPath: [], start: 0 });
    expect(texts(el)).toEqual([
      ['APAC', '', '', '35'],
      ['EU', '', '', '18'],
      ['US', '', '', '4'],
    ]);
    expect(rowsInOrder(el)[1]?.querySelector('[part~="group-count"]')?.textContent).toBe('(3)');
    expect(el.getAttribute('role')).toBe('treegrid');
  });

  test('opening a group loads its rows with its groupPath', async () => {
    const { source, requests } = server();
    const el = await fixture<Sale>({ columns, data: [], dataSource: source, grouping: ['region'] });
    await loaded(el);
    el.treeExpanded = [EU];
    await loaded(el);
    expect(requests.at(-1)).toMatchObject({ groupPath: [{ columnId: 'region', value: 'EU' }] });
    expect(texts(el).map((t) => t[0])).toEqual(['APAC', 'EU', 's1', 's3', 's5', 'US']);
    // Data rows render as data rows: their cells read the row.
    expect(texts(el)[2]).toEqual(['s1', 'EU', 'Open', '10']);
  });

  test('two levels: the groups inside an open group load before its rows', async () => {
    const { source, requests } = server();
    const el = await fixture<Sale>({
      columns,
      data: [],
      dataSource: source,
      grouping: ['region', 'status'],
      treeExpanded: [EU],
    });
    await loaded(el);
    expect(requests.map((r) => r.groupPath?.length)).toEqual([0, 1]);
    expect(texts(el).map((t) => t[0])).toEqual(['APAC', 'EU', 'Done', 'Open', 'US']);
  });

  test('a page of groups loads when it scrolls into view', async () => {
    const { source, requests } = server({ pageSize: 2 });
    const el = await fixture<Sale>(
      { columns, data: [], dataSource: source, grouping: ['region'] },
      { width: 600, height: 120 },
    );
    await loaded(el);
    expect(requests.map((r) => r.start)).toEqual([0, 2]);
  });

  test('without grouping, requests carry grouping: [] and groupPath: []', async () => {
    const { source, requests } = server();
    const el = await fixture<Sale>({ columns, data: [], dataSource: source });
    await loaded(el);
    expect(requests[0]).toMatchObject({ grouping: [], groupPath: [] });
    expect(texts(el)).toHaveLength(6);
  });

  test('a server answering rows where groups belong fails the page, with Retry', async () => {
    const { source, requests } = server({ wrong: true });
    const errors: LoadErrorDetail[] = [];
    const el = await fixture<Sale>({ columns, data: [], dataSource: source, grouping: ['region'] });
    el.addEventListener('argus-load-error', (e) => errors.push(e.detail));
    await loaded(el);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ start: 0, groupPath: [] });
    expect(errors[0]?.error).toBeInstanceOf(TypeError);
    const retry = el.shadowRoot?.querySelector<HTMLButtonElement>('[part~="retry"]');
    expect(retry).not.toBeNull();
    retry?.click();
    await loaded(el);
    expect(requests.length).toBeGreaterThan(1);
  });

  test('a sort change starts over; open groups open again as they arrive', async () => {
    const { source, requests } = server();
    const el = await fixture<Sale>({
      columns,
      data: [],
      dataSource: source,
      grouping: ['region'],
      treeExpanded: [EU],
    });
    await loaded(el);
    const before = requests.length;
    el.sorting = [{ id: 'amount', desc: true }];
    await loaded(el);
    expect(requests.length).toBeGreaterThan(before);
    expect(requests.at(-1)?.sorting).toEqual([{ id: 'amount', desc: true }]);
    expect(el.treeExpanded).toEqual([EU]);
    expect(texts(el).map((t) => t[0])).toContain('s1');
  });

  test('grouping is ignored, with a warning, with a data-source tree', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { source, requests } = server();
    const el = await fixture<Sale>({
      columns,
      data: [],
      dataSource: {
        ...source,
        hasChildren: () => false,
        getChildren: () => Promise.resolve({ rows: [] }),
      },
      grouping: ['region'],
    });
    await loaded(el);
    expect(requests[0]?.grouping).toEqual([]);
    expect(warn.mock.calls.filter(([m]) => String(m).includes('grouping'))).toHaveLength(1);
  });
});
