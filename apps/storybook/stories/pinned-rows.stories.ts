import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent } from 'storybook/test';
import type { ColumnDef, DataSource, PinnedRows } from 'argus-table';
import 'argus-table';

interface Order {
  id: string;
  customer: string;
  city: string;
  items: number;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];
const data: Order[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  items: 1 + ((i * 13) % 9),
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

const sum = (key: 'items' | 'total') => data.reduce((s, o) => s + o[key], 0);
const totals: Order = {
  id: 'total',
  customer: 'Total',
  city: '',
  items: sum('items'),
  total: Math.round(sum('total') * 100) / 100,
};
const average: Order = {
  id: 'average',
  customer: 'Average',
  city: '',
  items: Math.round((sum('items') / data.length) * 10) / 10,
  total: Math.round((sum('total') / data.length) * 100) / 100,
};

const money = (value: number) => value.toLocaleString('en', { minimumFractionDigits: 2 });

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  // A cell function sees `pinned` and can show a summary row its own way.
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
    cell: (order, { pinned }) =>
      pinned ? html`<strong>${order.customer}</strong>` : order.customer,
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'items', header: 'Items', accessor: 'items', width: 90, align: 'end', sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 130,
    align: 'end',
    sortable: true,
    cell: (order) => money(order.total),
  },
];

interface Args {
  top: boolean;
  bottom: boolean;
  dir: 'ltr' | 'rtl';
}

const meta = {
  title: 'Features/Pinned rows',
  component: 'argus-table',
  args: { top: false, bottom: true, dir: 'ltr' },
  argTypes: {
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
  },
  render: ({ top, bottom, dir }) => {
    const pinnedRows: PinnedRows<Order> = {
      top: top ? [average] : [],
      bottom: bottom ? [totals] : [],
    };
    const log = (text: string) => {
      const out = document.querySelector('#argus-pinned-log');
      if (out) out.textContent = text;
    };
    return html`<argus-table
        dir=${dir}
        style="block-size: 400px"
        .columns=${columns}
        .data=${data}
        .pinnedRows=${pinnedRows}
        .getRowId=${(o: Order) => o.id}
        @argus-row-click=${(e: CustomEvent<{ rowId: string; pinned?: string }>) => {
          const { rowId, pinned } = e.detail;
          log(`argus-row-click: ${rowId}${pinned ? ` (pinned: ${pinned})` : ''}`);
        }}
      ></argus-table>
      <p id="argus-pinned-log" aria-live="polite">Click a row.</p>`;
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/**
 * `pinnedRows: { bottom: [totals] }` keeps a totals row at the bottom while the
 * body scrolls. Pinned rows are separate objects, read by the same columns, and
 * never sorted. They get the `row-pinned` and `row-pinned-bottom` parts, and
 * their background is `--argus-pinned-row-bg`.
 */
export const Totals: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    const row = table?.shadowRoot?.querySelector('[part~="row-pinned-bottom"]');
    await expect(row).not.toBeNull();
    await expect(row?.getAttribute('aria-rowindex')).toBe(String(data.length + 2));
    const scroller = table?.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
    const before = row?.getBoundingClientRect().top;
    if (scroller) scroller.scrollTop = 20_000;
    await new Promise(requestAnimationFrame);
    await table?.updateComplete;
    // Still in the same place.
    await expect(row?.getBoundingClientRect().top).toBeCloseTo(before ?? 0, 0);
  },
};

/**
 * Rows on both sides. The keyboard moves through them like any row: from the
 * header down into the top row, the body, and on to the bottom row; Ctrl+End
 * lands on the totals. PageUp and PageDown page through the body only. A click
 * or Enter fires `argus-row-click` with `pinned: 'top' | 'bottom'`.
 */
export const TopAndBottom: Story = {
  args: { top: true, bottom: true },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    const root = table?.shadowRoot;
    if (!table || !root) return;
    root.querySelector<HTMLElement>('[role="columnheader"][tabindex="0"]')?.focus();
    await userEvent.keyboard('{ArrowDown}');
    await table.updateComplete;
    const top = root.activeElement as HTMLElement | null;
    await expect(top?.closest('[part~="row-pinned-top"]')).not.toBeNull();
    await userEvent.keyboard('{Control>}{End}{/Control}');
    await table.updateComplete;
    await new Promise(requestAnimationFrame);
    const last = root.activeElement as HTMLElement | null;
    await expect(last?.closest('[part~="row-pinned-bottom"]')).not.toBeNull();
    await userEvent.keyboard('{Enter}');
    await expect(canvasElement.querySelector('#argus-pinned-log')?.textContent).toBe(
      'argus-row-click: total (pinned: bottom)',
    );
  },
};

/** Pinned rows work the same with a `dataSource`: they don't wait for pages. */
export const WithDataSource: Story = {
  args: { top: false, bottom: true },
  render: ({ dir }) => {
    const source: DataSource<Order> = {
      async getRows({ start, end }) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return { rows: data.slice(start, end), total: data.length };
      },
    };
    return html`<argus-table
      dir=${dir}
      style="block-size: 400px"
      .columns=${columns}
      .dataSource=${source}
      .pinnedRows=${{ bottom: [totals] }}
    ></argus-table>`;
  },
};

/** In RTL the pinned rows mirror with the columns. */
export const RightToLeft: Story = {
  args: { top: true, bottom: true, dir: 'rtl' },
};
