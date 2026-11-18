import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import type { ArgusTable, ColumnDef, ColumnGroup } from 'argus-table';
import 'argus-table';
import {
  downloadTable,
  exportTable,
  tableExport,
  type ExportDetail,
  type ExportFormat,
} from '@argus-table/export';
import { headerMenu } from '@argus-table/header-menu';
import { orderColumns, orders, type Order } from './data.js';

const data = orders(1_000);
const columns = orderColumns.map((c) =>
  c.id === 'city'
    ? { ...c, filter: 'set' as const }
    : c.id === 'total'
      ? { ...c, filter: 'number' as const }
      : c,
);
const groups: ColumnGroup[] = [{ id: 'where', header: 'Delivery', columns: ['city', 'status'] }];
// Kept between renders: new plugin instances would reconnect.
const plugins = [tableExport<Order>({ filename: 'orders', title: 'Orders' }), headerMenu<Order>()];

const meta = {
  title: 'Add-ons/Export',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

async function tableIn(canvasElement: HTMLElement): Promise<ArgusTable<Order>> {
  const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
  if (!table) throw new Error('no <argus-table>');
  await table.updateComplete;
  return table;
}

/** A toolbar button's export: the table and the "selected rows only" box are its neighbours. */
const downloadAs = (format: ExportFormat) => (event: Event) => {
  const root = (event.currentTarget as HTMLElement).closest('.export-demo');
  const table = root?.querySelector<ArgusTable<Order>>('argus-table');
  const selected = root?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked;
  if (!table) return;
  void downloadTable(table, format, { rows: selected ? 'selected' : 'view' });
};

function search(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const table = input.closest('.export-demo')?.querySelector<ArgusTable<Order>>('argus-table');
  if (table) table.quickFilter = input.value;
}

/**
 * `@argus-table/export` is a plugin: `table.plugins = [tableExport(), headerMenu()]`.
 * `downloadTable(table, 'csv' | 'xlsx' | 'pdf')` saves what the table shows (the
 * columns in their order, the rows sorted and filtered, with the pinned rows and
 * the group headers) and `exportTable()` returns the file as a `Blob`. The
 * buttons here call it; with `headerMenu()`, every column menu offers the formats
 * too. Excel cells keep their types (numbers, dates, booleans), and the header
 * rows and pinned columns are frozen. The Excel and PDF writers load on first use.
 */
export const Default: Story = {
  render: () =>
    html`<div class="export-demo" style="display: grid; gap: 8px">
      <div role="toolbar" aria-label="Export" style="display: flex; gap: 8px; align-items: center">
        <label>Search <input type="search" @input=${search} /></label>
        <label><input type="checkbox" /> Selected rows only</label>
        <button @click=${downloadAs('csv')}>CSV</button>
        <button @click=${downloadAs('xlsx')}>Excel</button>
        <button @click=${downloadAs('pdf')}>PDF</button>
      </div>
      <argus-table
        style="block-size: 420px"
        selection-mode="multi"
        selection-checkboxes
        .columns=${columns}
        .columnGroups=${groups}
        .data=${data}
        .getRowId=${(row: Order) => row.id}
        .plugins=${plugins}
      ></argus-table>
    </div>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    table.quickFilter = 'Oslo';
    const text = async (options = {}) =>
      (await exportTable(table, 'csv', { bom: false, ...options })).text();
    const lines = await waitFor(async () => {
      const csv = (await text()).trim().split('\r\n');
      await expect(csv).toHaveLength(2 + 200);
      return csv;
    });
    await expect(lines.slice(0, 3)).toEqual([
      ',,Delivery,,',
      'Order,Customer,City,Status,Total',
      'o2,Customer 2,Oslo,paid,79.2',
    ]);
    table.selection = ['o7', 'o2'];
    await expect((await text({ rows: 'selected' })).trim().split('\r\n').slice(2)).toEqual([
      'o2,Customer 2,Oslo,paid,79.2',
      'o7,Customer 7,Oslo,open,475.1',
    ]);
    table.selection = [];
    table.quickFilter = '';
  },
};

const metaColumns: ColumnDef<Order>[] = orderColumns.map((c): ColumnDef<Order> => {
  if (c.id === 'customer') {
    // A template header names the column through its text mode.
    return { ...c, header: ({ text }) => (text ? 'Customer' : html`<b>Customer</b> ✦`) };
  }
  if (c.id === 'status') return { ...c, meta: { export: { exclude: true } } };
  if (c.id === 'total') {
    return {
      ...c,
      cell: (o) => `${o.total.toFixed(2)} €`,
      meta: { export: { header: 'Total (EUR)', value: (v) => Math.round(Number(v)) } },
    };
  }
  return c;
});

/**
 * A column's `meta.export` sets how it is exported (`header`, `value`, `exclude`),
 * next to its definition; the `columns` option of `tableExport()` or of a call
 * wins field by field. Headers that are templates (or JSX, VNodes) name the column
 * through their text mode: `header: ({ text }) => (text ? 'Customer' : html`…`)`.
 * Here Status stays out of the files, Total is exported as whole euros under
 * another header, and Customer keeps its name.
 */
export const ColumnMeta: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 360px"
      .columns=${metaColumns}
      .data=${data}
      .getRowId=${(row: Order) => row.id}
      .plugins=${plugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const lines = await waitFor(async () => {
      const csv = (await (await exportTable(table, 'csv', { bom: false })).text()).split('\r\n');
      await expect(csv[0]).toBe('Order,Customer,City,Total (EUR)');
      return csv;
    });
    await expect(lines[1]).toMatch(/^o\d+,Customer \d+,\w+,\d+$/);
  },
};

interface Line {
  product: string;
  qty: number;
}
/** An order's lines: one to three, the same every time. */
const linesOf = (order: Order): Line[] =>
  Array.from({ length: 1 + (Number(order.id.slice(1)) % 3) }, (_, i) => ({
    product: `Product ${String.fromCharCode(65 + i)}`,
    qty: i + 1,
  }));
const detail: ExportDetail<Order, Line> = {
  columns: [
    { id: 'product', header: 'Product', width: 160 },
    { id: 'qty', header: 'Qty', align: 'end', width: 60 },
  ],
  rows: (order) => linesOf(order),
};
const detailPlugins = [
  tableExport<Order>({ filename: 'orders', title: 'Orders', detail }),
  headerMenu<Order>(),
];

/**
 * `detail` adds the rows behind each row (an order's lines) to every export:
 * under their row in Excel (one column in, grouped so they collapse) and PDF, and
 * in CSV one line per detail row with the order repeated. The app supplies them:
 * `{ columns, rows(row, { rowId, signal }) }`, a promise if they have to be
 * fetched; the export doesn't read the panels. With `detail` in `tableExport()`,
 * the column menu offers Export (without the lines) and Export with details.
 */
export const WithDetails: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px"
      .columns=${orderColumns}
      .data=${data}
      .getRowId=${(row: Order) => row.id}
      .rowDetail=${({ row }: { row: Order }) =>
        linesOf(row)
          .map((line) => `${String(line.qty)} × ${line.product}`)
          .join(', ')}
      .plugins=${detailPlugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const csv = (await (await exportTable(table, 'csv', { bom: false })).text()).split('\r\n');
    await expect(csv[0]).toBe('Order,Customer,City,Status,Total,Product,Qty');
    // Order o1 has two lines: one CSV line each, with the order repeated.
    await expect(csv[1]).toMatch(/^o1,.*,Product A,1$/);
    await expect(csv[2]).toMatch(/^o1,.*,Product B,2$/);
    const button = table
      .querySelector('[slot^="h-"]')
      ?.querySelector<HTMLButtonElement>('.argus-header-menu-button');
    button?.click();
    const menu = await waitFor(() => {
      const open = table.querySelector<HTMLElement>('.argus-header-menu:popover-open');
      if (!open) throw new Error('menu not open');
      return open;
    });
    await expect(menu.textContent).toContain('Export with details');
    menu.hidePopover();
  },
};
