import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, ColumnDef, ColumnFilterState, DataSource } from 'argus-table';
import 'argus-table';
import { orders, type Order } from './data.js';

const data = orders(100_000);

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, filter: 'set' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, filter: 'set' },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
  },
];

const meta = {
  title: 'Features/Filtering',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Rendered body rows, in order, as their cells' text by column id. */
function rows(table: HTMLElement): Record<string, string>[] {
  return [
    ...(table.shadowRoot?.querySelectorAll<HTMLElement>('[part~="body"] > [role="row"]') ?? []),
  ]
    .sort(
      (a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')),
    )
    .map((row) =>
      Object.fromEntries(
        [...row.querySelectorAll<HTMLElement>('[role="gridcell"]')].map((cell) => [
          cell.dataset.col ?? '',
          cell.querySelector('slot')?.assignedElements()[0]?.textContent.trim() ?? '',
        ]),
      ),
    );
}

/** The filters less one column's. */
function without(filters: ColumnFilterState, id: string): ColumnFilterState {
  return Object.fromEntries(Object.entries(filters).filter(([key]) => key !== id));
}

/**
 * `quickFilter` keeps the rows that contain each word of a text in one of their shown
 * columns, ignoring case: wire it to your own search box. Here 100,000 orders are
 * searched as you type ("oslo 77", say). The table announces the number of rows left
 * to screen readers.
 */
export const QuickFilter: Story = {
  render: () => {
    const onInput = (event: Event) => {
      const table = document.querySelector<ArgusTable<Order>>('#quick-filter-table');
      if (table) table.quickFilter = (event.target as HTMLInputElement).value;
    };
    return html`<label style="display: block; margin-block-end: 12px; font: 14px sans-serif">
        Search orders
        <input type="search" @input=${onInput} />
      </label>
      <argus-table
        id="quick-filter-table"
        aria-label="Orders"
        style="block-size: 360px"
        .columns=${columns}
        .data=${data}
      ></argus-table>`;
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
    const search = canvasElement.querySelector('input');
    if (!table || !search) return;
    await userEvent.type(search, 'oslo 777');
    await waitFor(() => {
      const shown = rows(table);
      return expect(
        shown.length > 0 &&
          shown.every(
            (r) => r.city === 'Oslo' && Object.values(r).some((text) => text.includes('777')),
          ),
      ).toBe(true);
    });
    await userEvent.clear(search);
    await waitFor(() => expect(new Set(rows(table).map((r) => r.city)).size).toBe(5));
  },
};

/**
 * `columnFilters` holds a filter per column id: `text` (contains, equals, starts with,
 * empty), `number` and `date` (comparisons and ranges), or `set` (one of a list of
 * values). It's a plain object, so it saves as JSON. Here it is set from the page; the
 * column menu (`@argus-table/header-menu`) lets users set filters on columns with a
 * `filter` kind. Filtered headers get the `header-cell-filtered` part and a funnel mark.
 */
export const ColumnFilters: Story = {
  render: () => {
    let filters: ColumnFilterState = {
      status: { kind: 'set', values: ['open'] },
      total: { kind: 'number', op: 'ge', value: 500 },
    };
    const update = (next: ColumnFilterState) => {
      filters = next;
      const table = document.querySelector<ArgusTable<Order>>('#column-filters-table');
      if (table) table.columnFilters = filters;
    };
    const onStatus = (event: Event) => {
      const value = (event.target as HTMLSelectElement).value;
      const rest = without(filters, 'status');
      update(value ? { ...rest, status: { kind: 'set', values: [value] } } : rest);
    };
    const onTotal = (event: Event) => {
      const value = (event.target as HTMLInputElement).valueAsNumber;
      const rest = without(filters, 'total');
      update(Number.isNaN(value) ? rest : { ...rest, total: { kind: 'number', op: 'ge', value } });
    };
    return html`<div
        style="display: flex; gap: 16px; margin-block-end: 12px; font: 14px sans-serif"
      >
        <label
          >Status
          <select @change=${onStatus}>
            <option value="">any</option>
            <option value="open" selected>open</option>
            <option value="paid">paid</option>
            <option value="shipped">shipped</option>
          </select></label
        >
        <label>Total at least <input type="number" value="500" @input=${onTotal} /></label>
      </div>
      <argus-table
        id="column-filters-table"
        aria-label="Orders"
        style="block-size: 360px"
        .columns=${columns}
        .data=${data}
        .columnFilters=${filters}
      ></argus-table>`;
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
    const status = canvasElement.querySelector('select');
    if (!table || !status) return;
    await table.updateComplete;
    await waitFor(() =>
      expect(rows(table).every((r) => r.status === 'open' && Number(r.total) >= 500)).toBe(true),
    );
    const header = table.shadowRoot?.querySelector('[role="columnheader"][data-col="status"]');
    await expect(header?.part.contains('header-cell-filtered')).toBe(true);
    await userEvent.selectOptions(status, 'paid');
    await waitFor(() => expect(rows(table).every((r) => r.status === 'paid')).toBe(true));
    await userEvent.selectOptions(status, 'open');
  },
};

/**
 * With a `dataSource`, the table doesn't filter: `columnFilters` and `quickFilter` go to
 * `getRows({ start, end, sorting, filters, quickFilter, signal })`, and a change reloads
 * from the top. A `set` filter there lists the column's `filterOptions`, since the
 * table can't see every value. This pretend server filters by status and searches
 * the customer.
 */
export const DataSourceFilters: Story = {
  render: () => {
    const all = orders(10_000);
    const source: DataSource<Order> = {
      async getRows({ start, end, filters, quickFilter, signal }) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        signal.throwIfAborted();
        const status = filters.status;
        const words = quickFilter.toLowerCase().split(/\s+/).filter(Boolean);
        const rows = all.filter(
          (o) =>
            (status?.kind !== 'set' || status.values.includes(o.status)) &&
            words.every((w) => o.customer.toLowerCase().includes(w)),
        );
        return { rows: rows.slice(start, end), total: rows.length };
      },
    };
    const remote = columns.map((c) =>
      c.id === 'status' ? { ...c, filterOptions: ['open', 'paid', 'shipped'] } : c,
    );
    return html`<argus-table
      aria-label="Orders"
      style="block-size: 360px"
      .columns=${remote}
      .dataSource=${source}
      .columnFilters=${{ status: { kind: 'set', values: ['shipped'] } }}
      quick-filter="customer 9"
    ></argus-table>`;
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
    if (!table) return;
    await waitFor(
      () => {
        const shown = rows(table);
        return expect(
          shown.length > 0 &&
            shown.every((r) => r.status === 'shipped' && r.customer?.includes('9')),
        ).toBe(true);
      },
      { timeout: 3000 },
    );
  },
};

/** `<argus-column filter="…">` gives a column a filter kind in markup. */
export const Children: Story = {
  render: () =>
    html`<argus-table
      aria-label="Orders"
      style="block-size: 300px"
      .data=${data.slice(0, 200)}
      .columnFilters=${{ city: { kind: 'set', values: ['Quito'] } }}
    >
      <argus-column column-id="id" header="Order" accessor="id" width="100"></argus-column>
      <argus-column column-id="customer" header="Customer" accessor="customer" filter="text">
      </argus-column>
      <argus-column column-id="city" header="City" accessor="city" filter="set"></argus-column>
    </argus-table>`,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
    if (!table) return;
    await waitFor(() => {
      const shown = rows(table);
      return expect(shown.length > 0 && shown.every((r) => r.city === 'Quito')).toBe(true);
    });
  },
};
