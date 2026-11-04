import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import type { ColumnDef } from 'argus-table';
import 'argus-table';

interface Order {
  id: string;
  customer: string;
  city: string;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];
const data: Order[] = Array.from({ length: 1_000 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

interface Args {
  scheme: 'auto' | 'light' | 'dark';
  density: 'compact' | 'comfortable' | 'spacious';
}

const meta = {
  title: 'Themes/Default',
  component: 'argus-table',
  // The toolbar's theme switch stays on Default here.
  globals: { theme: 'default' },
  args: { scheme: 'auto', density: 'comfortable' },
  argTypes: {
    scheme: {
      control: 'inline-radio',
      options: ['auto', 'light', 'dark'],
      description: '`data-argus-theme` on an ancestor; `auto` follows the system setting',
    },
    density: { control: 'inline-radio', options: ['compact', 'comfortable', 'spacious'] },
  },
  render: ({ scheme, density }) =>
    html`<div data-argus-theme=${scheme === 'auto' ? '' : scheme}>
      <argus-table
        style="block-size: 360px"
        density=${density}
        .columns=${columns}
        .data=${data}
      ></argus-table>
    </div>`,
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/**
 * `@argus-table/themes/default.css`: neutral colours that follow the system's
 * light or dark setting, the page's font, and an accent for focus, sorting and
 * the resize handle. Force a scheme with `data-argus-theme="dark"` or
 * `"light"` on the table or an ancestor.
 *
 * ```js
 * import '@argus-table/themes/default.css';
 * ```
 */
export const Default: Story = {};

export const Dark: Story = {
  args: { scheme: 'dark' },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    if (!table) return;
    await expect(getComputedStyle(table).colorScheme).toBe('dark');
  },
};
