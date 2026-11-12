import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent } from 'storybook/test';
import type { ArgusTable, ColumnDef, SortState } from 'argus-table';
import 'argus-table';

interface Product {
  sku: string;
  name: string;
  stock: number | undefined;
  price: number;
}

const names = ['Anvil', 'Bolt', 'Clamp', 'Drill', 'Easel', 'File', 'Gauge', 'Hinge'];
const data: Product[] = Array.from({ length: 10_000 }, (_, i) => ({
  sku: `SKU-${String(i + 1).padStart(5, '0')}`,
  name: `${names[i % names.length] ?? ''} ${String((i * 37) % 100)}`,
  // Every 13th product has no stock figure: empty values sort last either way.
  stock: i % 13 === 0 ? undefined : (i * 7919) % 500,
  price: Math.round(((i * 53) % 10_000) * 1.3) / 100,
}));

const columns: ColumnDef<Product>[] = [
  { id: 'sku', header: 'SKU', accessor: 'sku', width: 120 },
  {
    id: 'name',
    header: 'Name',
    accessor: 'name',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
  },
  { id: 'stock', header: 'Stock', accessor: 'stock', width: 100, align: 'end', sortable: true },
  {
    id: 'price',
    header: 'Price',
    accessor: 'price',
    width: 110,
    align: 'end',
    sortable: true,
    cell: (p) => p.price.toFixed(2),
  },
];

const meta = {
  title: 'Features/Sorting',
  component: 'argus-table',
  render: () =>
    html`<argus-table style="block-size: 420px" .columns=${columns} .data=${data}></argus-table>`,
} satisfies Meta;

export default meta;
type Story = StoryObj;

/**
 * Columns with `sortable: true` sort on click, or Enter and Space on the focused
 * header: ascending, descending, then back to the original order. Without a
 * `sorting` property the table keeps the order itself.
 */
export const Uncontrolled: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    if (!table) return;
    await table.updateComplete;
    const price = table.shadowRoot?.querySelectorAll<HTMLElement>('[part~="header-cell"]')[3];
    if (!price) return;
    await userEvent.click(price);
    await table.updateComplete;
    await expect(price.getAttribute('aria-sort')).toBe('ascending');
  },
};

/**
 * Controlled: the host owns `sorting`. A click fires `argus-sorting-change` with the
 * proposed order, and the table only re-sorts when the host sets it. This one
 * accepts every change except sorting by name descending.
 */
export const Controlled: Story = {
  render: () => {
    const onChange = (event: CustomEvent<{ sorting: SortState }>) => {
      const table = event.target as ArgusTable<Product>;
      const [first] = event.detail.sorting;
      if (first?.id === 'name' && first.desc) return;
      table.sorting = event.detail.sorting;
    };
    return html`<argus-table
      style="block-size: 420px"
      .columns=${columns}
      .data=${data}
      .sorting=${[{ id: 'stock', desc: true }]}
      @argus-sorting-change=${onChange}
    ></argus-table>`;
  },
};
