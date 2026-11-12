import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent } from 'storybook/test';
import type { ArgusTable, ColumnDef } from 'argus-table';
import 'argus-table';

interface Product {
  sku: string;
  name: string;
  category: string;
  price: number;
}

const names = [
  'Desk lamp',
  'Ergonomic office chair with adjustable lumbar support',
  'Notebook',
  'Noise-cancelling headphones',
  'USB-C cable, 2 m',
];
const categories = ['Lighting', 'Furniture', 'Stationery', 'Audio', 'Accessories'];
const data: Product[] = Array.from({ length: 2_000 }, (_, i) => ({
  sku: `SKU-${String(10_000 + i)}`,
  name: names[i % names.length] ?? '',
  category: categories[i % categories.length] ?? '',
  price: Math.round(((i * 37) % 500) * 100 + 99) / 100,
}));

const columns: ColumnDef<Product>[] = [
  { id: 'sku', header: 'SKU', accessor: 'sku', width: 'auto', pin: 'start' },
  { id: 'name', header: 'Product', accessor: 'name', width: 'auto', maxWidth: 360 },
  { id: 'category', header: 'Category', accessor: 'category', width: 'auto' },
  { id: 'price', header: 'Price (EUR)', accessor: 'price', width: 80, align: 'end' },
];

const meta = {
  title: 'Features/Auto width',
  component: 'argus-table',
  render: () =>
    html`<argus-table style="block-size: 420px" .columns=${columns} .data=${data}></argus-table>`,
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Cells of a column whose content is cut off. */
function truncated(table: ArgusTable<Product>, id: string): number {
  const cells = table.shadowRoot?.querySelectorAll(`[data-col="${id}"]`) ?? [];
  return [...cells].filter((cell) => {
    const content = cell.querySelector('slot')?.assignedElements()[0];
    return content && content.scrollWidth > content.clientWidth;
  }).length;
}

/**
 * `width: 'auto'` fits a column to its header, its pinned rows and the rows in
 * view, within `minWidth` and `maxWidth` (Product stops at 360 px). It measures
 * once the first rows render and then keeps its width, so scrolling never moves
 * the columns. Price is a fixed 80 px.
 */
export const AutoColumns: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<ArgusTable<Product>>('argus-table');
    if (!table) return;
    await table.updateComplete;
    await new Promise(requestAnimationFrame);
    await table.updateComplete;
    await expect(truncated(table, 'sku')).toBe(0);
    await expect(truncated(table, 'category')).toBe(0);
    // No event and no state: an auto width is the column's own width, not a resize.
    await expect(table.columnSizing).toEqual({});
  },
};

/**
 * Double-click a header's resize handle to fit that column to the rows in view,
 * or call `autosizeColumns(ids?)` to fit several. Both count as resizes: they fire
 * `argus-column-sizing-change` and follow the `columnSizing` rules. Price is too narrow
 * for its header here; the play function fits it.
 */
export const FitToContent: Story = {
  render: () => {
    const fitAll = (event: Event) => {
      const table = (event.target as HTMLElement).nextElementSibling as ArgusTable<Product>;
      void table.autosizeColumns();
    };
    return html`<button type="button" @click=${fitAll}>Fit all columns</button>
      <argus-table
        style="block-size: 420px; margin-block-start: 8px"
        .columns=${columns.map((c) => ({ ...c, width: 80 }))}
        .data=${data}
      ></argus-table>`;
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<ArgusTable<Product>>('argus-table');
    const button = canvasElement.querySelector('button');
    if (!table || !button) return;
    await table.updateComplete;
    await expect(truncated(table, 'price')).toBeGreaterThan(0);
    const handle = table.shadowRoot?.querySelector('[data-resize-col="price"]');
    if (handle) await userEvent.dblClick(handle);
    await table.updateComplete;
    await expect(truncated(table, 'price')).toBe(0);
    await userEvent.click(button);
    await new Promise(requestAnimationFrame);
    await table.updateComplete;
    await expect(truncated(table, 'category')).toBe(0);
  },
};
