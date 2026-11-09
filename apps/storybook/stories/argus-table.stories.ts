import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ColumnDef, Density } from 'argus-table';
import 'argus-table';

interface Order {
  id: number;
  customer: { name: string; city: string };
  status: 'open' | 'paid' | 'shipped';
  total: number;
}

const cities = ['Berlin', 'Lisbon', 'Oslo', 'Porto', 'Riga', 'Turin', 'Utrecht'];
const statuses = ['open', 'paid', 'shipped'] as const;

function orders(count: number): Order[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    customer: { name: `Customer ${String((i * 7919) % 10_000)}`, city: cities[i % 7] ?? '' },
    status: statuses[i % 3] ?? 'open',
    total: Math.round(((i * 37) % 1000) * 1.07 * 100) / 100,
  }));
}

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, align: 'end' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer.name',
    width: { flex: 1 },
    minWidth: 160,
  },
  { id: 'city', header: 'City', accessor: 'customer.city', width: 120 },
  {
    id: 'status',
    header: 'Status',
    width: 110,
    // Cell content lives in the light DOM, so page CSS and markup work here.
    cell: (order) => html`<strong>${order.status}</strong>`,
  },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    cell: (order) => order.total.toFixed(2),
  },
];

const data = orders(100_000);

interface Args {
  density: Density;
  rows: number;
}

const meta = {
  title: 'Features/Rendering',
  component: 'argus-table',
  args: { density: 'comfortable', rows: 100_000 },
  argTypes: {
    density: { control: 'inline-radio', options: ['compact', 'comfortable', 'spacious'] },
    rows: { control: { type: 'number', min: 0, max: 100_000, step: 1000 } },
  },
  render: ({ density, rows }) =>
    html`<argus-table
      style="block-size: 480px"
      density=${density}
      .columns=${columns}
      .data=${rows === data.length ? data : data.slice(0, rows)}
    ></argus-table>`,
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/** 100,000 rows. Only the visible window plus a few rows of overscan is in the DOM. */
export const HundredThousandRows: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    const rows = table?.shadowRoot?.querySelectorAll('[part~="row"]') ?? [];
    await expect(rows.length).toBeGreaterThan(0);
    await expect(rows.length).toBeLessThan(40);
  },
};

let million: Order[] | undefined;

/**
 * 1,000,000 rows: 40M px of rows, taller than browsers render an element (about
 * 33.5M px in Chromium and Safari, 17.9M px in Firefox). The body renders
 * shorter and its scroll position is scaled, so the scrollbar still spans every
 * row; a wheel step covers a few more rows than usual. Press Ctrl+End (Cmd+End)
 * in the table to jump to the last row.
 */
export const MillionRows: Story = {
  render: ({ density }) =>
    html`<argus-table
      style="block-size: 480px"
      density=${density}
      .columns=${columns}
      .data=${(million ??= orders(1_000_000))}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    const root = table?.shadowRoot;
    if (!table || !root) return;
    root.querySelector<HTMLElement>('[role="columnheader"][tabindex="0"]')?.focus();
    await userEvent.keyboard('{Control>}{End}{/Control}');
    await waitFor(() =>
      expect(
        (root.activeElement as HTMLElement | null)?.parentElement?.getAttribute('aria-rowindex'),
      ).toBe('1000001'),
    );
    const scroller = root.querySelector<HTMLElement>('[part~="table"]');
    await expect(scroller?.scrollHeight).toBeLessThan(33_000_000);
  },
};

/** With no rows, the `empty` slot shows; its default text is "No rows". */
export const Empty: Story = {
  args: { rows: 0 },
};
