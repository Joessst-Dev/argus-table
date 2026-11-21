import { afterEach, describe, expect, test, vi } from 'vitest';
import { html } from 'lit';
import 'argus-table';
import type { ArgusTable, ColumnDef, DataSource, RowsRequest } from 'argus-table';
import { headerMenu } from '@argus-table/header-menu';
import { downloadTable, exportTable, tableExport, type ExportDetail } from './index.js';
import { unzip } from './test/unzip.js';

interface Row {
  id: string;
  name: string;
  age: number;
  city: string;
}

const data: Row[] = [
  { id: 'a', name: 'Ann', age: 30, city: 'Oslo' },
  { id: 'b', name: 'Bob', age: 10, city: 'Rome' },
  { id: 'c', name: 'Cid', age: 20, city: 'Lima' },
  { id: 'd', name: 'Dee', age: 40, city: '=cmd' },
];

const columns: ColumnDef<Row>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 140, sortable: true },
  {
    id: 'age',
    header: () => 'Age',
    accessor: 'age',
    width: 80,
    sortable: true,
    align: 'end',
    filter: 'number',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'secret', header: 'Secret', accessor: (r: Row) => r.id.toUpperCase(), hidden: true },
];

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function settle(el: ArgusTable<Row>) {
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await el.updateComplete;
}

async function fixture(props: Partial<ArgusTable<Row>> = {}): Promise<ArgusTable<Row>> {
  const el = document.createElement('argus-table') as ArgusTable<Row>;
  Object.assign(
    el,
    { columns, data, getRowId: (r: Row) => r.id, plugins: [tableExport<Row>()] },
    props,
  );
  el.style.inlineSize = '600px';
  el.style.blockSize = '300px';
  document.body.append(el);
  await settle(el);
  return el;
}

const csv = async (el: ArgusTable<Row>, options: Parameters<typeof exportTable<Row>>[2] = {}) =>
  (await exportTable(el, 'csv', { bom: false, ...options })).text();

describe('exportTable', () => {
  test('exports the columns and rows shown, sorted and filtered, with pinned rows', async () => {
    const el = await fixture({
      sorting: [{ id: 'age', desc: true }],
      columnFilters: { age: { kind: 'number', op: 'gt', value: 15 } },
      pinnedRows: { bottom: [{ id: 'sum', name: 'Total', age: 100, city: '' }] },
    });
    expect(await csv(el)).toBe(
      "Name,Age,City\r\nDee,40,'=cmd\r\nAnn,30,Oslo\r\nCid,20,Lima\r\nTotal,100,\r\n",
    );
  });

  test('grouped rows: group rows with their counts and totals, then their rows, closed groups too', async () => {
    const grouped = columns.map((c) =>
      c.id === 'city'
        ? { ...c, groupable: true }
        : c.id === 'age'
          ? { ...c, aggregate: 'sum' as const }
          : c,
    );
    const el = await fixture({
      columns: grouped,
      data: [...data, { id: 'e', name: 'Eve', age: 50, city: 'Oslo' }],
      grouping: ['city'],
      sorting: [{ id: 'age', desc: true }],
      pinnedRows: { top: [{ id: 'top', name: 'Pinned', age: 1, city: '' }] },
    });
    // Sorting by Age, which has a total, orders the groups by it too.
    expect(await csv(el)).toBe(
      'Name,Age,City\r\nPinned,1,\r\nOslo (2),80,\r\nEve,50,Oslo\r\nAnn,30,Oslo\r\n' +
        "'=cmd (1),40,\r\nDee,40,'=cmd\r\nLima (1),20,\r\nCid,20,Lima\r\nRome (1),10,\r\nBob,10,Rome\r\n",
    );
    // Selected rows: no group rows, in the grouped order.
    el.selectionMode = 'multi';
    el.selection = ['a', 'e'];
    await settle(el);
    expect(await csv(el, { rows: 'selected' })).toBe(
      'Name,Age,City\r\nEve,50,Oslo\r\nAnn,30,Oslo\r\n',
    );
  });

  test('a group of empty values and a group of a date are named by their text', async () => {
    const el = await fixture({
      columns: [
        { id: 'name', header: 'Name', accessor: 'name' },
        {
          id: 'day',
          header: 'Day',
          accessor: (r: Row) => (r.age > 15 ? new Date(2026, 10, 20) : undefined),
          groupable: true,
        },
      ],
      grouping: ['day'],
    });
    expect(await csv(el)).toBe(
      'Name,Day\r\n2026-11-20 (3),\r\nAnn,2026-11-20\r\nCid,2026-11-20\r\nDee,2026-11-20\r\n(empty) (1),\r\nBob,\r\n',
    );
  });

  test("names columns by their headers' text, wherever it is listed among the plugins", async () => {
    const el = await fixture({ plugins: [tableExport<Row>(), headerMenu<Row>()] });
    expect((await csv(el)).split('\r\n')[0]).toBe('Name,Age,City');
    // Listed after the menu, whose headers forward their text mode.
    const late = await fixture({ plugins: [headerMenu<Row>(), tableExport<Row>()] });
    expect((await csv(late)).split('\r\n')[0]).toBe('Name,Age,City');
  });

  test("names a content header by its text mode, else by the column's id", async () => {
    const el = await fixture({
      columns: [
        {
          id: 'name',
          header: ({ text }) => (text ? 'Full name' : html`<b>Name</b>`),
          accessor: 'name',
        },
        { id: 'age', header: () => html`<i>Age</i>`, accessor: 'age' },
      ],
      columnGroups: [
        {
          id: 'who',
          header: ({ text }) => (text ? 'Person' : html`<b>Who</b>`),
          columns: ['name', 'age'],
        },
      ],
    });
    expect((await csv(el)).split('\r\n').slice(0, 2)).toEqual(['Person,', 'Full name,age']);
  });

  test("reads a column's meta.export; the columns option wins field by field", async () => {
    const el = await fixture({
      columns: columns.map((c): ColumnDef<Row> =>
        c.id === 'name'
          ? {
              ...c,
              meta: { export: { header: 'Who', value: (v, row) => `${String(v)}/${row.id}` } },
            }
          : c.id === 'city'
            ? { ...c, meta: { export: { exclude: true } } }
            : c,
      ),
    });
    expect((await csv(el)).split('\r\n').slice(0, 2)).toEqual(['Who,Age', 'Ann/a,30']);
    expect(
      (await csv(el, { columns: { name: { header: 'Name' }, city: { exclude: false } } }))
        .split('\r\n')
        .slice(0, 2),
    ).toEqual(['Name,Age,City', 'Ann/a,30,Oslo']);
  });

  test('types meta.export by augmenting ColumnMeta', () => {
    const typed: ColumnDef<Row> = {
      id: 'name',
      meta: { export: { value: (_v, row) => row.name.toUpperCase() }, other: 1 },
    };
    // @ts-expect-error -- exclude is a boolean
    const wrong: ColumnDef<Row> = { id: 'name', meta: { export: { exclude: 'yes' } } };
    expect([typed, wrong]).toHaveLength(2);
  });

  test('exports the selected rows, hidden columns and per-column options', async () => {
    const el = await fixture({
      selectionMode: 'multi',
      selection: ['c', 'a'],
      pinnedRows: { top: [{ id: 'top', name: 'Top', age: 0, city: '' }] },
    });
    expect(await csv(el, { rows: 'selected' })).toBe(
      'Name,Age,City\r\nAnn,30,Oslo\r\nCid,20,Lima\r\n',
    );
    expect(
      await csv(el, {
        rows: 'selected',
        hiddenColumns: true,
        columns: {
          name: { header: 'Who', value: (v, row) => `${String(v)} (${row.id})` },
          city: { exclude: true },
        },
      }),
    ).toBe('Who,Age,Secret\r\nAnn (a),30,A\r\nCid (c),20,C\r\n');
  });

  test('writes group header rows, one cell per group across pinned sides', async () => {
    const el = await fixture({
      columns: columns.map((c) => (c.id === 'city' ? { ...c, pin: 'start' as const } : c)),
      columnGroups: [{ id: 'who', header: 'Person', columns: ['name', 'city'] }],
    });
    const lines = (await csv(el)).split('\r\n');
    expect(lines.slice(0, 3)).toEqual(['Person,,', 'City,Name,Age', 'Oslo,Ann,30']);
    expect((await csv(el, { headerGroups: false })).split('\r\n')[0]).toBe('City,Name,Age');
  });

  test('rejects for a table without the plugin, and when aborted', async () => {
    const el = await fixture({ plugins: [] });
    await expect(exportTable(el, 'csv')).rejects.toThrow(/tableExport\(\)/);
    el.plugins = [tableExport<Row>()];
    await settle(el);
    const controller = new AbortController();
    controller.abort();
    await expect(exportTable(el, 'csv', { signal: controller.signal })).rejects.toThrow();
  });

  test('keeps the headers it read when the table moves, and stops when the plugin is removed', async () => {
    const el = await fixture({ plugins: [tableExport<Row>(), headerMenu<Row>()] });
    const box = document.createElement('div');
    document.body.append(box);
    box.append(el);
    await settle(el);
    expect((await csv(el)).split('\r\n')[0]).toBe('Name,Age,City');
    el.plugins = [headerMenu<Row>()];
    await settle(el);
    await expect(exportTable(el, 'csv')).rejects.toThrow(/tableExport\(\)/);
    el.plugins = [tableExport<Row>({ delimiter: ';' }), headerMenu<Row>()];
    await settle(el);
    expect((await csv(el)).split('\r\n')[0]).toBe('Name;Age;City');
  });

  test('exports data rows only: open detail panels, the chevron and checkbox columns are left out', async () => {
    const el = await fixture({
      rowDetail: ({ row }) => html`<p>Detail of ${row.name}</p>`,
      expanded: ['a', 'c'],
      selectionMode: 'multi',
      selectionCheckboxes: true,
      selection: ['a', 'c'],
      columnPinning: { name: 'start' },
    });
    expect(await csv(el)).toBe(
      "Name,Age,City\r\nAnn,30,Oslo\r\nBob,10,Rome\r\nCid,20,Lima\r\nDee,40,'=cmd\r\n",
    );
    expect(await csv(el, { rows: 'selected' })).toBe(
      'Name,Age,City\r\nAnn,30,Oslo\r\nCid,20,Lima\r\n',
    );
    // Frozen panes cover Name alone, not the system columns before it.
    const files = await unzip(new Uint8Array(await (await exportTable(el, 'xlsx')).arrayBuffer()));
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('<pane xSplit="1" ySplit="1"');
  });

  test('uses the plugin options as defaults for every export', async () => {
    const el = await fixture({ plugins: [tableExport<Row>({ delimiter: ';', bom: false })] });
    expect((await (await exportTable(el, 'csv')).text()).split('\r\n')[0]).toBe('Name;Age;City');
  });

  test('writes an Excel workbook and a PDF, loading their writers on first use', async () => {
    const el = await fixture();
    const xlsx = await exportTable(el, 'xlsx', { sheetName: 'People' });
    expect(xlsx.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const files = await unzip(new Uint8Array(await xlsx.arrayBuffer()));
    const sheet = files.get('xl/worksheets/sheet1.xml') ?? '';
    expect(sheet).toContain('<t xml:space="preserve">Ann</t>');
    expect(sheet).toContain('<c r="B2" s="2"><v>30</v></c>');
    expect(files.get('xl/workbook.xml')).toContain('name="People"');

    const pdf = await exportTable(el, 'pdf', { title: 'People' });
    expect(pdf.type).toBe('application/pdf');
    const head = new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 8));
    expect(head).toBe('%PDF-1.4');
  });
});

describe('detail rows', () => {
  interface Line {
    product: string;
    qty: number;
  }
  const lines = (r: Row): Line[] =>
    r.id === 'b'
      ? []
      : [
          { product: `${r.name} A`, qty: 1 },
          { product: `${r.name} B`, qty: 2 },
        ];
  const detailOf = (rows: ExportDetail<Row, Line>['rows']): ExportDetail<Row, Line> => ({
    columns: [
      { id: 'product', header: 'Product' },
      { id: 'qty', header: 'Qty', align: 'end' },
    ],
    rows,
  });

  test('calls rows() for body rows only, not pinned rows or rows rowExpandable rejects', async () => {
    const el = await fixture({
      pinnedRows: { top: data.slice(0, 1) },
      rowExpandable: (r) => r.id !== 'c',
    });
    const rows = vi.fn<ExportDetail<Row, Line>['rows']>(lines);
    await csv(el, { detail: detailOf(rows) });
    expect(rows.mock.calls.map(([row]) => row.id)).toEqual(['a', 'b', 'd']);
    expect(rows.mock.calls[0]?.[1]).toEqual({ rowId: 'a', signal: undefined });
  });

  test("detail: false turns the plugin's detail off", async () => {
    const rows = vi.fn<ExportDetail<Row, Line>['rows']>(lines);
    const plain = await csv(await fixture());
    document.body.replaceChildren();
    const el = await fixture({ plugins: [tableExport<Row>({ detail: detailOf(rows) })] });
    expect(await csv(el, { detail: false })).toBe(plain);
    expect(rows).not.toHaveBeenCalled();
  });
});

describe('with a dataSource', () => {
  const all = Array.from({ length: 250 }, (_, i) => ({
    id: `r${String(i)}`,
    name: `Row ${String(i)}`,
    age: i,
    city: 'X',
  }));
  const server = () => {
    const requests: Omit<RowsRequest, 'signal'>[] = [];
    const source: DataSource<Row> = {
      pageSize: 100,
      getRows: ({ start, end, sorting, filters, quickFilter }) => {
        requests.push({ start, end, sorting, filters, quickFilter });
        return Promise.resolve({ rows: all.slice(start, end), total: all.length });
      },
    };
    return { source, requests };
  };

  test('grouped on the server: group rows and loaded rows; with allRows the top-level groups', async () => {
    const requests: RowsRequest[] = [];
    const source: DataSource<Row> = {
      getRows: (request) => {
        requests.push(request);
        if (request.groupPath?.length) {
          const rows = data.filter((r) => r.city === request.groupPath?.[0]?.value);
          return Promise.resolve({ rows, total: rows.length });
        }
        const cities = [...new Set(data.map((r) => r.city))].sort();
        const groups = cities.map((city) => ({
          value: city,
          count: data.filter((r) => r.city === city).length,
          totals: { age: data.filter((r) => r.city === city).reduce((n, r) => n + r.age, 0) },
        }));
        return Promise.resolve({ rows: [], groups, total: groups.length });
      },
    };
    const el = await fixture({
      data: undefined,
      columns: columns.map((c) => (c.id === 'city' ? { ...c, groupable: true } : c)),
      dataSource: source,
      grouping: ['city'],
      treeExpanded: ['\u0000g["city","Oslo"]'],
    });
    await vi.waitFor(async () => {
      expect(await csv(el)).toBe(
        "Name,Age,City\r\n'=cmd (1),40,\r\nLima (1),20,\r\nOslo (1),30,\r\nAnn,30,Oslo\r\nRome (1),10,\r\n",
      );
    });
    requests.length = 0;
    expect(await csv(el, { allRows: true })).toBe(
      "Name,Age,City\r\n'=cmd (1),40,\r\nLima (1),20,\r\nOslo (1),30,\r\nRome (1),10,\r\n",
    );
    expect(requests[0]).toMatchObject({ grouping: ['city'], groupPath: [] });
  });

  test('grouped on the server: allRows asks for groups before any row has loaded, and rejects rows', async () => {
    const requests: RowsRequest[] = [];
    let answer: 'groups' | 'rows' = 'groups';
    const source: DataSource<Row> = {
      getRows: (request) => {
        requests.push(request);
        return answer === 'rows' || request.groupPath?.length
          ? Promise.resolve({ rows: data, total: data.length })
          : Promise.resolve({ rows: [], groups: [{ value: 'Oslo', count: 1 }], total: 1 });
      },
    };
    const el = await fixture({
      data: undefined,
      columns: columns.map((c) => (c.id === 'city' ? { ...c, groupable: true } : c)),
      dataSource: source,
      grouping: ['city', 'city'],
    });
    expect(await csv(el, { allRows: true })).toBe('Name,Age,City\r\nOslo (1),,\r\n');
    expect(requests.at(-1)).toMatchObject({ grouping: ['city'], groupPath: [] });
    answer = 'rows';
    await expect(csv(el, { allRows: true })).rejects.toThrow(TypeError);
  });

  test('exports the loaded rows, or every row with allRows', async () => {
    const { source, requests } = server();
    const el = await fixture({ data: undefined, dataSource: source, quickFilter: 'Row' });
    await vi.waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });
    await settle(el);
    const loaded = (await csv(el)).trim().split('\r\n');
    expect(loaded.length - 1).toBeLessThan(250);
    expect(loaded[1]).toBe('Row 0,0,X');

    requests.length = 0;
    const rows = (await csv(el, { allRows: true })).trim().split('\r\n').slice(1);
    expect(rows).toHaveLength(250);
    expect(rows.at(-1)).toBe('Row 249,249,X');
    expect(requests.map((r) => [r.start, r.end])).toEqual([
      [0, 100],
      [100, 200],
      [200, 300],
    ]);
    expect(requests[0]).toMatchObject({ sorting: [], filters: {}, quickFilter: 'Row' });
  });

  test('passes the index as rowId with allRows and no getRowId', async () => {
    const { source } = server();
    const el = await fixture({ data: undefined, dataSource: source, getRowId: undefined });
    const rows = vi.fn<ExportDetail<Row>['rows']>(() => []);
    await csv(el, { allRows: true, detail: { columns: [{ id: 'x', header: 'X' }], rows } });
    expect(rows.mock.calls.slice(0, 3).map(([, context]) => context.rowId)).toEqual([
      '0',
      '1',
      '2',
    ]);
    expect(rows).toHaveBeenCalledTimes(250);
  });

  test('allRows with rows: selected keeps the selected ids', async () => {
    const { source } = server();
    const el = await fixture({
      data: undefined,
      dataSource: source,
      selectionMode: 'multi',
      selection: ['r5', 'r240'],
    });
    const rows = (await csv(el, { allRows: true, rows: 'selected' })).trim().split('\r\n');
    expect(rows.slice(1)).toEqual(['Row 5,5,X', 'Row 240,240,X']);
  });
});

describe('downloads and the column menu', () => {
  const clicks = () => {
    const links: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      links.push(this);
    });
    return links;
  };
  const announced = async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return document.querySelector('[data-argus-announcer]')?.textContent;
  };

  test('downloadTable names the file and announces the rows', async () => {
    const links = clicks();
    const el = await fixture({ plugins: [tableExport<Row>({ filename: 'people' })] });
    await downloadTable(el, 'csv');
    expect(links.map((l) => l.download)).toEqual(['people.csv']);
    expect(links[0]?.href).toMatch(/^blob:/);
    expect(await announced()).toBe('Exported 4 rows');
    await downloadTable(el, 'xlsx', { filename: 'report.xlsx' });
    expect(links[1]?.download).toBe('report.xlsx');
  });

  test('the column menu offers the formats, in the labels given', async () => {
    const links = clicks();
    const el = await fixture({
      plugins: [
        tableExport<Row>({
          formats: ['csv', 'pdf'],
          labels: { group: 'Exportieren', pdf: 'Als PDF' },
        }),
        headerMenu<Row>({ pin: false, hide: false }),
      ],
    });
    const header = el.shadowRoot?.querySelector('[role="columnheader"][data-col="city"] slot');
    const button = (header as HTMLSlotElement | null)
      ?.assignedElements()[0]
      ?.querySelector<HTMLButtonElement>('.argus-header-menu-button');
    button?.click();
    await settle(el);
    const menu = el.querySelector<HTMLElement>('.argus-header-menu:popover-open');
    if (!menu) throw new Error('menu not open');
    expect(menu.textContent).toContain('Exportieren');
    const items = [...menu.querySelectorAll<HTMLElement>('.argus-header-menu-item')];
    expect(items.map((i) => i.textContent.trim()).slice(-2)).toEqual(['CSV', 'Als PDF']);
    items.at(-2)?.click();
    await vi.waitFor(() => {
      expect(links.map((l) => l.download)).toEqual(['table.csv']);
    });
  });

  test('offers the formats with and without details in the column menu', async () => {
    const links = clicks();
    const detail: ExportDetail<Row> = {
      columns: [{ id: 'product', header: 'Product' }],
      rows: (r) => [{ product: `${r.name} A` }],
    };
    const el = await fixture({ plugins: [tableExport<Row>({ detail })] });
    const plugin = el.plugins[0] as ReturnType<typeof tableExport<Row>>;
    const host = { element: el, announce: () => undefined } as never;
    const groups = plugin.headerMenuItems('name', host);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.label)])).toEqual([
      ['Export', ['CSV', 'Excel (.xlsx)', 'PDF']],
      ['Export with details', ['CSV', 'Excel (.xlsx)', 'PDF']],
    ]);
    const download = async (group: number) => {
      groups[group]?.items[0]?.run();
      await vi.waitFor(() => {
        expect(links).toHaveLength(group + 1);
      });
      return (await fetch(links[group]?.href ?? '')).text();
    };
    expect(await download(0)).not.toContain('Product');
    expect(await download(1)).toContain('Product');

    document.body.replaceChildren();
    const plain = await fixture();
    const plainPlugin = plain.plugins[0] as ReturnType<typeof tableExport<Row>>;
    expect(plainPlugin.headerMenuItems('name', host).map((g) => g.label)).toEqual(['Export']);
  });

  test('menu: false adds no items', async () => {
    const el = await fixture({ plugins: [tableExport<Row>({ menu: false }), headerMenu<Row>()] });
    const plugin = el.plugins[0] as ReturnType<typeof tableExport<Row>>;
    expect(plugin.headerMenuItems('name', undefined as never)).toEqual([]);
  });
});
