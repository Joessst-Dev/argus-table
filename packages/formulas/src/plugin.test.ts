import { afterEach, describe, expect, test, vi } from 'vitest';
import { html } from 'lit';
import 'argus-table';
import type { ArgusTable, ColumnDef, DataSource } from 'argus-table';
import { headerMenu } from '@argus-table/header-menu';
import { formulas } from './index.js';

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
      { id: 'counted', accessor: (r: Row) => (reads++, r.qty) },
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
