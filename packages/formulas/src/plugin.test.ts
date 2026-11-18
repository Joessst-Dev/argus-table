import { afterEach, describe, expect, test, vi } from 'vitest';
import { html } from 'lit';
import 'argus-table';
import type { ArgusPlugin, ArgusTable, ColumnDef, DataSource, PluginHost } from 'argus-table';
import { headerMenu } from '@argus-table/header-menu';
import { formulas, formulaTrees, type FormulaTrees } from './index.js';

interface Row {
  id: string;
  name: string;
  price: number;
  qty: number;
  info?: { unit: string };
}

const data: Row[] = [
  { id: 'a', name: 'Apple', price: 2, qty: 12, info: { unit: 'kg' } },
  { id: 'b', name: 'Banana', price: 0.5, qty: 4, info: { unit: 'pc' } },
  { id: 'c', name: 'Cherry', price: 10, qty: 0 },
];

const base: ColumnDef<Row>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 100 },
  { id: 'price', header: 'Unit price', accessor: 'price', width: 80 },
  { id: 'qty', header: 'Quantity', accessor: 'qty', width: 80 },
];

const withFormulas = (...extra: ColumnDef<Row>[]): ColumnDef<Row>[] => [...base, ...extra];

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
  Object.assign(el, { data, getRowId: (r: Row) => r.id, plugins: [formulas()] }, props);
  el.style.inlineSize = '800px';
  el.style.blockSize = '300px';
  document.body.append(el);
  await settle(el);
  return el;
}

const contentOf = (cell: Element | null) =>
  (cell?.querySelector('slot') as HTMLSlotElement | null)?.assignedElements()[0];

/** A column's cell text, body rows in display order. */
const texts = (el: ArgusTable<Row>, col: string) =>
  [...(el.shadowRoot?.querySelectorAll('[part~="row"]:not([part~="row-pinned"])') ?? [])]
    .sort(
      (a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')),
    )
    .map((row) => contentOf(row.querySelector(`[data-col="${col}"]`))?.textContent.trim());

const headerOf = (el: ArgusTable<Row>, id: string) => {
  const h = el.shadowRoot?.querySelector<HTMLElement>(`[role="columnheader"][data-col="${id}"]`);
  if (!h) throw new Error(`no header ${id}`);
  return h;
};

/** The error code and tooltip shown in a column's cell, in a body row by display index. */
const errorOf = (el: ArgusTable<Row>, col: string, row = 0) => {
  const rows = [
    ...(el.shadowRoot?.querySelectorAll('[part~="row"]:not([part~="row-pinned"])') ?? []),
  ];
  const cell = rows.find((r) => r.getAttribute('aria-rowindex') === String(row + 2));
  const error = contentOf(cell?.querySelector(`[data-col="${col}"]`) ?? null)?.querySelector(
    '.argus-formula-error',
  );
  return error ? [error.textContent, error.getAttribute('title')] : undefined;
};

describe('formula columns', () => {
  test('computes values from other columns, by id or by header, and from other formulas', async () => {
    const el = await fixture({
      columns: withFormulas(
        { id: 'total', header: 'Total', formula: '[price] * [Quantity]' },
        { id: 'gross', header: 'Gross', formula: 'ROUND([Total] * 1.19, 2)' },
        { id: 'status', header: 'Status', formula: 'IF([qty] < 10, "Low", "OK")' },
      ),
    });
    expect(texts(el, 'total')).toEqual(['24', '2', '0']);
    expect(texts(el, 'gross')).toEqual(['28.56', '2.38', '0']);
    expect(texts(el, 'status')).toEqual(['OK', 'Low', 'Low']);
  });

  test('reads property paths and accessor functions', async () => {
    const el = await fixture({
      columns: [
        ...base,
        { id: 'unit', accessor: 'info.unit' },
        { id: 'double', accessor: (r: Row) => r.qty * 2 },
        { id: 'label', formula: 'CONCAT([qty], " ", [unit], " / ", [double])' },
      ],
    });
    expect(texts(el, 'label')).toEqual(['12 kg / 24', '4 pc / 8', '0  / 0']);
  });

  test('shows numbers without float noise and aligns numbers to the end', async () => {
    const el = await fixture({
      columns: withFormulas(
        { id: 'sum', formula: '0.1 + 0.2' },
        { id: 'text', formula: '[name] & "!"' },
        { id: 'aligned', formula: '[qty] * 2', align: 'center' },
      ),
    });
    expect(texts(el, 'sum')).toEqual(['0.3', '0.3', '0.3']);
    expect(headerOf(el, 'sum').dataset.align).toBe('end');
    expect(headerOf(el, 'text').dataset.align).toBe('start');
    expect(headerOf(el, 'aligned').dataset.align).toBe('center');
  });

  test('marks formula headers with ƒx, hidden from screen readers', async () => {
    const el = await fixture({
      columns: withFormulas({ id: 'total', header: 'Total', formula: '1' }),
    });
    const header = contentOf(headerOf(el, 'total'));
    expect(header?.querySelector('.argus-formula-mark')?.getAttribute('aria-hidden')).toBe('true');
    expect(header?.querySelector('.argus-formula-mark')?.textContent).toBe('ƒx');
    expect(header?.querySelector('.argus-formula-label')?.textContent).toBe('Total');
    expect(contentOf(headerOf(el, 'price'))?.textContent).toBe('Unit price');
  });

  test("passes the header's text on, and names a template header by it in formulas", async () => {
    const names: (string | undefined)[] = [];
    const after: ArgusPlugin<Row> = {
      name: 'names',
      columns: (defs, host) => {
        names.splice(0, Infinity, ...defs.map((d) => host.headerText(d)));
        return undefined;
      },
    };
    const el = await fixture({
      plugins: [formulas(), after],
      columns: [
        ...base.map((c) =>
          c.id === 'price'
            ? { ...c, header: ({ text }: { text: boolean }) => (text ? 'Cost' : html`<i>Cost</i>`) }
            : c,
        ),
        { id: 'total', header: 'Total', formula: '[cost] * [qty]' },
      ],
    });
    expect(names).toEqual(['Name', 'Cost', 'Quantity', 'Total']);
    expect(texts(el, 'total')).toEqual(['24', '2', '0']);
  });

  test('leaves headers alone with marker: false', async () => {
    const el = await fixture({
      plugins: [formulas({ marker: false })],
      columns: withFormulas({ id: 'total', header: 'Total', formula: '1' }),
    });
    expect(contentOf(headerOf(el, 'total'))?.textContent).toBe('Total');
  });

  test('passes columns through untouched without formulas', () => {
    const plugin = formulas<Row>();
    const columns = withFormulas();
    const host = { element: document.createElement('argus-table') };
    expect(plugin.columns?.(columns, host as never)).toBe(columns);
  });

  test('keeps a custom cell for values, but shows errors itself', async () => {
    const el = await fixture({
      columns: withFormulas({
        id: 'ratio',
        formula: '[price] / [qty]',
        cell: (_row, context) => html`<b>${String(context.value)}</b>`,
      }),
    });
    expect(texts(el, 'ratio').slice(0, 2)).toEqual(['0.16666666666666666', '0.125']);
    expect(errorOf(el, 'ratio', 2)).toEqual(['#DIV/0!', 'Division by zero.']);
  });
});

describe('errors', () => {
  test('are cell values with a tooltip', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = await fixture({
      columns: withFormulas(
        { id: 'div', formula: '[price] / [qty]' },
        { id: 'ref', formula: '[nope] + 1' },
        { id: 'unknown', formula: 'NOPE()' },
        { id: 'syntax', formula: '[price] *' },
        { id: 'arity', formula: 'ROUND()' },
      ),
    });
    expect(texts(el, 'div')).toEqual(['0.166666666666667', '0.125', '#DIV/0!']);
    expect(errorOf(el, 'div', 2)).toEqual(['#DIV/0!', 'Division by zero.']);
    expect(errorOf(el, 'ref')).toEqual(['#REF!', 'There is no column [nope].']);
    expect(errorOf(el, 'unknown')).toEqual(['#NAME?', 'There is no function NOPE.']);
    expect(errorOf(el, 'syntax')).toEqual(['#ERROR!', 'The formula ends too early.']);
    expect(errorOf(el, 'arity')).toEqual(['#ERROR!', 'ROUND takes 1 to 2 arguments.']);
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([
      'argus-table: formula column "syntax": The formula ends too early.',
      'argus-table: formula column "arity": ROUND takes 1 to 2 arguments.',
    ]);
    // Reported once, not on every transform.
    el.columns = [...el.columns];
    await settle(el);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  test('a cycle is #CYCLE! in every column of it, and passes on to the columns using it', async () => {
    const el = await fixture({
      columns: withFormulas(
        { id: 'a', formula: '[b] + 1' },
        { id: 'b', formula: '[a] + 1' },
        { id: 'self', formula: '[self] * 2' },
        { id: 'user', formula: '[a] * 2' },
        { id: 'fine', formula: '[qty] + 1' },
      ),
    });
    expect(texts(el, 'a')[0]).toBe('#CYCLE!');
    expect(texts(el, 'b')[0]).toBe('#CYCLE!');
    expect(texts(el, 'self')[0]).toBe('#CYCLE!');
    expect(texts(el, 'user')[0]).toBe('#CYCLE!');
    expect(texts(el, 'fine')).toEqual(['13', '5', '1']);
  });
});

describe('sorting', () => {
  test('sorts by the computed value, errors last both ways', async () => {
    const el = await fixture({
      columns: withFormulas({
        id: 'per',
        header: 'Per',
        formula: '[qty] / [price]',
        sortable: true,
      }),
      data: [...data, { id: 'd', name: 'Date', price: 0, qty: 1 }],
    });
    expect(texts(el, 'per')).toEqual(['6', '8', '0', '#DIV/0!']);
    headerOf(el, 'per').click();
    await settle(el);
    expect(texts(el, 'per')).toEqual(['0', '6', '8', '#DIV/0!']);
    headerOf(el, 'per').click();
    await settle(el);
    expect(texts(el, 'per')).toEqual(['8', '6', '0', '#DIV/0!']);
  });

  test('a changed formula shows and sorts by the new values', async () => {
    const el = await fixture({
      columns: withFormulas({ id: 'calc', formula: '[qty]', sortable: true }),
      sorting: [{ id: 'calc', desc: false }],
    });
    expect(texts(el, 'name')).toEqual(['Cherry', 'Banana', 'Apple']);
    el.columns = withFormulas({ id: 'calc', formula: '-[price]', sortable: true });
    await settle(el);
    expect(texts(el, 'calc')).toEqual(['-10', '-2', '-0.5']);
    expect(texts(el, 'name')).toEqual(['Cherry', 'Apple', 'Banana']);
  });

  test('formula columns can’t sort with a dataSource: the server doesn’t know them', async () => {
    const dataSource: DataSource<Row> = {
      getRows: ({ start, end }) => Promise.resolve({ rows: data.slice(start, end), total: 3 }),
    };
    const el = await fixture({
      data: undefined,
      dataSource,
      columns: withFormulas({ id: 'total', formula: '[price] * [qty]', sortable: true }),
    });
    await vi.waitFor(() => {
      expect(texts(el, 'total')).toEqual(['24', '2', '0']);
    });
    headerOf(el, 'total').click();
    await settle(el);
    expect(el.sorting).toEqual([]);
  });

  test('formula columns can’t filter with a dataSource either', async () => {
    let host: PluginHost<Row> | undefined;
    const grab: ArgusPlugin<Row> = {
      name: 'grab',
      connect(h) {
        host = h;
        return undefined;
      },
    };
    const dataSource: DataSource<Row> = {
      getRows: ({ start, end }) => Promise.resolve({ rows: data.slice(start, end), total: 3 }),
    };
    const columns = withFormulas({ id: 'total', formula: '[price] * [qty]', filter: 'number' });
    const el = await fixture({ data: undefined, dataSource, columns, plugins: [formulas(), grab] });
    expect(host?.column('total')?.filter).toBeUndefined();
    el.dataSource = undefined;
    el.data = data;
    // The plugin reads `dataSource` when the columns run again.
    el.columns = [...columns];
    await settle(el);
    expect(host?.column('total')?.filter).toBe('number');
  });
});

describe('filtering', () => {
  test('filters by computed values; errors count as empty', async () => {
    const el = await fixture({
      columns: withFormulas(
        { id: 'total', formula: '[price] * [qty]', filter: 'number' },
        { id: 'per', formula: '[price] / [qty]', filter: 'number' },
      ),
    });
    el.columnFilters = { total: { kind: 'number', op: 'ge', value: 2 } };
    await settle(el);
    expect(texts(el, 'name')).toEqual(['Apple', 'Banana']);
    // Cherry's quantity is 0: #DIV/0!.
    el.columnFilters = { per: { kind: 'number', op: 'empty' } };
    await settle(el);
    expect(texts(el, 'name')).toEqual(['Cherry']);
  });

  test('the quick filter finds computed values', async () => {
    const el = await fixture({
      columns: withFormulas({ id: 'total', formula: '[price] * [qty]' }),
      quickFilter: '24',
    });
    expect(texts(el, 'name')).toEqual(['Apple']);
  });
});

describe('whole columns', () => {
  const filterable = (...extra: ColumnDef<Row>[]): ColumnDef<Row>[] => [
    ...base.map((c): ColumnDef<Row> => {
      if (c.id === 'name') return { ...c, filter: 'text', sortable: true };
      return c.id === 'price' ? { ...c, filter: 'number' } : c;
    }),
    ...extra,
  ];
  const share: ColumnDef<Row> = {
    id: 'share',
    header: 'Share',
    formula: '[qty] / SUM([[qty]])',
    filter: 'number',
    sortable: true,
  };

  test('cover the rows the filters keep', async () => {
    const el = await fixture({ columns: filterable(share) });
    // Quantities 12, 4, 0 of 16.
    expect(texts(el, 'share')).toEqual(['0.75', '0.25', '0']);
    el.columnFilters = { price: { kind: 'number', op: 'ge', value: 1 } };
    await settle(el);
    expect(texts(el, 'name')).toEqual(['Apple', 'Cherry']);
    expect(texts(el, 'share')).toEqual(['1', '0']);
    el.columnFilters = {};
    await settle(el);
    expect(texts(el, 'share')).toEqual(['0.75', '0.25', '0']);
  });

  test('a filter on a column using them hides rows but leaves the totals alone', async () => {
    const el = await fixture({ columns: filterable(share) });
    el.columnFilters = { share: { kind: 'number', op: 'gt', value: 0.2 } };
    await settle(el);
    expect(texts(el, 'name')).toEqual(['Apple', 'Banana']);
    expect(texts(el, 'share')).toEqual(['0.75', '0.25']);
  });

  test('follow the quick filter, the user’s filters and new data', async () => {
    const el = await fixture({ columns: filterable(share), quickFilter: 'banana' });
    expect(texts(el, 'share')).toEqual(['1']);
    el.quickFilter = '';
    await settle(el);
    expect(texts(el, 'share')).toEqual(['0.75', '0.25', '0']);
    el.data = [...data, { id: 'd', name: 'Date', price: 3, qty: 4 }];
    await settle(el);
    expect(texts(el, 'share')).toEqual(['0.6', '0.2', '0', '0.2']);
  });

  test('sort by a column using them, again after a filter', async () => {
    const el = await fixture({
      columns: filterable({ ...share, formula: 'RANK([price], [[price]], TRUE)' }),
      sorting: [{ id: 'share', desc: false }],
    });
    expect(texts(el, 'name')).toEqual(['Banana', 'Apple', 'Cherry']);
    expect(texts(el, 'share')).toEqual(['1', '2', '3']);
    el.columnFilters = { name: { kind: 'text', op: 'contains', value: 'e' } };
    await settle(el);
    expect(texts(el, 'name')).toEqual(['Apple', 'Cherry']);
    expect(texts(el, 'share')).toEqual(['1', '2']);
  });

  test('look up, count and rank, and are computed for pinned rows too', async () => {
    const el = await fixture({
      columns: filterable(
        { id: 'cherry', formula: 'XLOOKUP("cherry", [[name]], [[price]])' },
        { id: 'cheaper', formula: 'COUNTIF([[price]], "<" & [price])' },
        share,
      ),
      pinnedRows: { bottom: [{ id: 'p', name: 'Pinned', price: 1, qty: 8 }] },
    });
    expect(texts(el, 'cherry')).toEqual(['10', '10', '10']);
    expect(texts(el, 'cheaper')).toEqual(['1', '0', '2']);
    const pinned = el.shadowRoot?.querySelector('[part~="row-pinned-bottom"] [data-col="share"]');
    expect(contentOf(pinned ?? null)?.textContent).toBe('0.5');
  });

  test('other formula columns keep their accessors when the rows change', async () => {
    let seen: readonly ColumnDef<Row, unknown>[] = [];
    const spy: ArgusPlugin<Row> = {
      name: 'spy',
      columns(defs) {
        seen = defs;
        return defs;
      },
    };
    const el = await fixture({
      columns: filterable({ id: 'total', formula: '[price] * [qty]' }, share),
      plugins: [formulas(), spy],
    });
    const accessor = (id: string) => seen.find((d) => d.id === id)?.accessor;
    const total = accessor('total');
    const before = accessor('share');
    el.columnFilters = { price: { kind: 'number', op: 'ge', value: 1 } };
    await settle(el);
    expect(accessor('total')).toBe(total);
    expect(accessor('share')).not.toBe(before);
    // A filter on the column itself doesn't change its rows.
    const after = accessor('share');
    el.columnFilters = { ...el.columnFilters, share: { kind: 'number', op: 'ge', value: 0 } };
    await settle(el);
    expect(accessor('share')).toBe(after);
  });

  test('are #N/A with a dataSource, whose rows aren’t all loaded', async () => {
    const dataSource: DataSource<Row> = {
      getRows: ({ start, end }) => Promise.resolve({ rows: data.slice(start, end), total: 3 }),
    };
    const el = await fixture({ data: undefined, dataSource, columns: withFormulas(share) });
    await vi.waitFor(() => {
      expect(errorOf(el, 'share')?.[0]).toBe('#N/A');
    });
  });
});

describe('updates', () => {
  test('new data is computed again', async () => {
    const el = await fixture({
      columns: withFormulas({ id: 'total', formula: '[price] * [qty]' }),
    });
    el.data = [{ id: 'x', name: 'X', price: 3, qty: 3 }];
    await settle(el);
    expect(texts(el, 'total')).toEqual(['9']);
  });

  test('a new columns array with the same formulas reads nothing again', async () => {
    let reads = 0;
    const columns = [
      ...base,
      // Hidden: the table reads the cells it renders on every update; only the
      // formula reads this column.
      { id: 'counted', accessor: (r: Row) => (reads++, r.qty), hidden: true },
      { id: 'total', formula: '[counted] * 2', sortable: true },
    ];
    const el = await fixture({ columns, sorting: [{ id: 'total', desc: true }] });
    expect(texts(el, 'total')).toEqual(['24', '8', '0']);
    const after = reads;
    el.columns = [...columns];
    await settle(el);
    expect(texts(el, 'total')).toEqual(['24', '8', '0']);
    expect(reads).toBe(after);
  });

  test('a formula that changes what it reads follows the change', async () => {
    const el = await fixture({
      columns: [...base, { id: 'src', accessor: 'qty' }, { id: 'total', formula: '[src] * 2' }],
    });
    expect(texts(el, 'total')).toEqual(['24', '8', '0']);
    el.columns = [...base, { id: 'src', accessor: 'price' }, { id: 'total', formula: '[src] * 2' }];
    await settle(el);
    expect(texts(el, 'total')).toEqual(['4', '1', '20']);
  });

  test('pinned rows are computed too', async () => {
    const el = await fixture({
      columns: withFormulas({ id: 'total', formula: '[price] * [qty]' }),
      pinnedRows: { bottom: [{ id: 'sum', name: 'Sum', price: 12.5, qty: 2 }] },
    });
    const pinned = el.shadowRoot?.querySelector('[part~="row-pinned-bottom"] [data-col="total"]');
    expect(contentOf(pinned ?? null)?.textContent).toBe('25');
  });
});

describe('options and setup', () => {
  test('functions of your own, case-insensitive, may fail or replace built-ins', async () => {
    const el = await fixture({
      plugins: [
        formulas({
          functions: {
            vat: { fn: (n) => Number(n) * 0.19, args: [1, 1], returns: 'number' },
            boom: {
              fn: () => {
                throw new Error('no');
              },
            },
            LEN: { fn: () => 'replaced' },
            inf: { fn: () => Infinity },
          },
        }),
      ],
      columns: withFormulas(
        { id: 'vat', formula: 'VAT([price] * 100)' },
        { id: 'boom', formula: 'boom()' },
        { id: 'len', formula: 'LEN([name])' },
        { id: 'inf', formula: 'INF()' },
        { id: 'err', formula: 'VAT(1 / 0)' },
      ),
    });
    expect(texts(el, 'vat')).toEqual(['38', '9.5', '190']);
    expect(headerOf(el, 'vat').dataset.align).toBe('end');
    expect(errorOf(el, 'boom')).toEqual(['#VALUE!', 'BOOM failed.']);
    expect(texts(el, 'len')[0]).toBe('replaced');
    expect(texts(el, 'inf')[0]).toBe('#NUM!');
    expect(texts(el, 'err')[0]).toBe('#DIV/0!');
  });

  test('rejects function names a formula couldn’t call', () => {
    expect(() => formulas({ functions: { 'my fn': { fn: () => 1 } } })).toThrow(
      '@argus-table/formulas: "my fn" isn\'t a valid function name.',
    );
  });

  test('works with <argus-column formula> children', async () => {
    const el = document.createElement('argus-table') as ArgusTable<Row>;
    el.innerHTML = `
      <argus-column column-id="price" header="Price" accessor="price"></argus-column>
      <argus-column column-id="qty" header="Qty" accessor="qty"></argus-column>
      <argus-column column-id="total" header="Total" formula="[Price] * [Qty]"></argus-column>
    `;
    Object.assign(el, { data, plugins: [formulas()] });
    el.style.inlineSize = '600px';
    el.style.blockSize = '300px';
    document.body.append(el);
    await settle(el);
    expect(texts(el, 'total')).toEqual(['24', '2', '0']);
  });

  test('works before headerMenu(), which wraps the headers', async () => {
    const el = await fixture({
      plugins: [formulas<Row>(), headerMenu<Row>()],
      columns: withFormulas({
        id: 'total',
        header: 'Total',
        formula: '[Unit price] * 2',
        sortable: true,
      }),
    });
    expect(texts(el, 'total')).toEqual(['4', '1', '20']);
    const header = contentOf(headerOf(el, 'total'));
    expect(header?.querySelector('.argus-header-menu-button')).not.toBeNull();
    expect(header?.querySelector('.argus-formula-mark')).not.toBeNull();
  });

  test('one plugin serves several tables', async () => {
    const plugin = formulas<Row>();
    const one = await fixture({
      plugins: [plugin],
      columns: withFormulas({ id: 'f', formula: '[qty] + 1' }),
    });
    const two = await fixture({
      plugins: [plugin],
      columns: withFormulas({ id: 'f', formula: '[qty] * 10' }),
    });
    await settle(one);
    expect(texts(one, 'f')).toEqual(['13', '5', '1']);
    expect(texts(two, 'f')).toEqual(['120', '40', '0']);
  });

  test('adopts its styles into the table’s root node', async () => {
    await fixture({ columns: withFormulas({ id: 'f', formula: '1' }) });
    const css = document.adoptedStyleSheets.flatMap((s) => [...s.cssRules].map((r) => r.cssText));
    expect(css.join('\n')).toContain('argus-formulas');
  });
});

/** What a data source was asked for, with the trees it read. */
interface Seen {
  sorting: unknown;
  trees: FormulaTrees;
}

/** A data source over `data` that reads the trees of the table on the page, as an app's would. */
const remote = (seen: Seen[] = []): DataSource<Row> => ({
  getRows: ({ start, end, sorting }) => {
    const table = document.querySelector('argus-table');
    if (table) seen.push({ sorting, trees: formulaTrees(table) });
    return Promise.resolve({ rows: data.slice(start, end), total: data.length });
  },
});

/** A plugin that keeps the host, to read the columns as the table has them. */
function grabHost() {
  const got: { host?: PluginHost<Row> } = {};
  const plugin: ArgusPlugin<Row> = {
    name: 'grab',
    connect(h) {
      got.host = h;
      return undefined;
    },
  };
  return { got, plugin };
}

const product = {
  type: 'binary',
  operator: '*',
  left: { type: 'ref', column: 'price' },
  right: { type: 'ref', column: 'qty' },
};

describe('with a dataSource and server: true', () => {
  test('formula columns sort, and getRows reads their trees', async () => {
    const seen: Seen[] = [];
    const el = await fixture({
      data: undefined,
      dataSource: remote(seen),
      columns: withFormulas({ id: 'total', formula: '[price] * [qty]', sortable: true }),
      plugins: [formulas({ server: true })],
    });
    headerOf(el, 'total').click();
    await settle(el);
    expect(el.sorting).toEqual([{ id: 'total', desc: false }]);
    await vi.waitFor(() => {
      expect(seen.at(-1)?.sorting).toEqual([{ id: 'total', desc: false }]);
    });
    expect(seen.at(-1)?.trees.columns.total).toEqual(product);
    expect(seen.at(-1)?.trees.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  test('formula columns keep their filter', async () => {
    const { got, plugin } = grabHost();
    await fixture({
      data: undefined,
      dataSource: remote(),
      columns: withFormulas({ id: 'total', formula: '[price] * [qty]', filter: 'number' }),
      plugins: [formulas({ server: true }), plugin],
    });
    expect(got.host?.column('total')?.filter).toBe('number');
  });

  test('broken and whole-column formulas, and those reading them, stay unsortable', async () => {
    const { got, plugin } = grabHost();
    const opts = { sortable: true, filter: 'number' } as const;
    const el = await fixture({
      data: undefined,
      dataSource: remote(),
      columns: withFormulas(
        { id: 'bad', formula: '[price] *', ...opts },
        { id: 'share', formula: 'SUM([[price]])', ...opts },
        { id: 'pct', formula: '[share] * 100', ...opts },
      ),
      plugins: [formulas({ server: true }), plugin],
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const id of ['bad', 'share', 'pct']) {
      expect(got.host?.column(id)?.sortable).toBe(false);
      expect(got.host?.column(id)?.filter).toBeUndefined();
    }
    expect(formulaTrees(el).columns).toEqual({});
  });

  test('sortable and filter follow a dataSource set or removed later', async () => {
    const { got, plugin } = grabHost();
    const el = await fixture({
      columns: withFormulas({
        id: 'total',
        formula: '[price] * [qty]',
        sortable: true,
        filter: 'number',
      }),
      plugins: [formulas(), plugin],
    });
    expect(got.host?.column('total')?.sortable).toBe(true);
    el.dataSource = remote();
    await settle(el);
    expect(got.host?.column('total')?.sortable).toBe(false);
    expect(got.host?.column('total')?.filter).toBeUndefined();
    el.dataSource = undefined;
    await settle(el);
    expect(got.host?.column('total')?.sortable).toBe(true);
    expect(got.host?.column('total')?.filter).toBe('number');
  });

  test('an id named like an Object property is no exception', async () => {
    const { got, plugin } = grabHost();
    const el = await fixture({
      data: undefined,
      dataSource: remote(),
      columns: withFormulas({ id: 'toString', formula: '[price] * [qty]', sortable: true }),
      plugins: [formulas(), plugin],
    });
    expect(got.host?.column('toString')?.sortable).toBe(false);
    expect(Object.keys(formulaTrees(el).columns)).toEqual(['toString']);
  });

  test('formulaTrees gives each table its own trees, with one plugin for both', async () => {
    const plugin = formulas<Row>({ server: true });
    const a = await fixture({
      columns: withFormulas({ id: 'total', formula: '[price] * [qty]' }),
      plugins: [plugin],
    });
    const b = await fixture({
      columns: withFormulas({ id: 'total', formula: '[price] + [qty]' }),
      plugins: [plugin],
    });
    expect(formulaTrees(a).columns.total).toMatchObject({ operator: '*' });
    expect(formulaTrees(b).columns.total).toMatchObject({ operator: '+' });
  });

  test('formulaTrees works with data too, and gives no columns without formulas()', async () => {
    const el = await fixture({
      columns: withFormulas({ id: 'total', formula: '[price] * [qty]' }),
    });
    expect(formulaTrees(el).columns).toEqual({ total: product });
    expect(formulaTrees(document.createElement('argus-table')).columns).toEqual({});
  });
});

describe('reloading a dataSource when formulas change, with server: true', () => {
  const total = (formula: string): ColumnDef<Row> => ({ id: 'total', formula, sortable: true });
  const twice: ColumnDef<Row> = { id: 'twice', formula: '[total] * 2', sortable: true };

  /** A table on a data source, settled, with `refresh` watched. */
  async function mount(props: Partial<ArgusTable<Row>> = {}) {
    const el = await fixture({
      data: undefined,
      dataSource: remote(),
      columns: withFormulas(total('[price] * [qty]'), twice),
      plugins: [formulas({ server: true })],
      ...props,
    });
    const refresh = vi.spyOn(el, 'refresh');
    return { el, refresh };
  }

  test('changing the sorted formula reloads once', async () => {
    const { el, refresh } = await mount({ sorting: [{ id: 'total', desc: true }] });
    el.columns = withFormulas(total('[price] + [qty]'), twice);
    await settle(el);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('changing a formula the sorted one reads reloads', async () => {
    const { el, refresh } = await mount({ sorting: [{ id: 'twice', desc: false }] });
    el.columns = withFormulas(total('[price] + [qty]'), twice);
    await settle(el);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('a filter on a formula column counts too', async () => {
    const { el, refresh } = await mount({
      columnFilters: { total: { kind: 'number', op: 'gt', value: 1 } },
    });
    el.columns = withFormulas(total('[price] + [qty]'), twice);
    await settle(el);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('so does quick filter text', async () => {
    const { el, refresh } = await mount({ quickFilter: 'a' });
    el.columns = withFormulas(total('[price] + [qty]'), twice);
    await settle(el);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('removing the last formula columns reloads, with quick filter text', async () => {
    const { el, refresh } = await mount({ quickFilter: 'a' });
    el.columns = withFormulas();
    await settle(el);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('removing the sorted formula column reloads, with other formula columns left', async () => {
    const { el, refresh } = await mount({ sorting: [{ id: 'twice', desc: false }] });
    el.columns = withFormulas(total('[price] * [qty]'));
    await settle(el);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('no reload when nothing sorts or filters by formulas', async () => {
    const { el, refresh } = await mount({ sorting: [{ id: 'name', desc: false }] });
    el.columns = withFormulas(total('[price] + [qty]'), twice);
    await settle(el);
    expect(refresh).not.toHaveBeenCalled();
  });

  test('no reload for the same formulas in a new array', async () => {
    const { el, refresh } = await mount({ sorting: [{ id: 'total', desc: true }] });
    el.columns = withFormulas(total('[price] * [qty]'), { ...twice });
    await settle(el);
    expect(refresh).not.toHaveBeenCalled();
  });

  test('no reload when the sort changes in the same update: that reloads already', async () => {
    const { el, refresh } = await mount({ sorting: [{ id: 'total', desc: true }] });
    el.columns = withFormulas(total('[price] + [qty]'), twice);
    el.sorting = [{ id: 'total', desc: false }];
    await settle(el);
    expect(refresh).not.toHaveBeenCalled();
  });

  test('no reload with server off', async () => {
    const { el, refresh } = await mount({
      plugins: [formulas()],
      quickFilter: 'a',
    });
    el.columns = withFormulas(total('[price] + [qty]'), twice);
    await settle(el);
    expect(refresh).not.toHaveBeenCalled();
  });
});
