import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent } from 'storybook/test';
import type { ColumnDef } from 'argus-table';
import 'argus-table';

interface Order {
  id: string;
  customer: string;
  city: string;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];
const data: Order[] = Array.from({ length: 10_000 }, (_, i) => ({
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

const meta = {
  title: 'Features/Keyboard',
  component: 'argus-table',
  render: () => {
    const log = (text: string) => {
      const out = document.querySelector('#argus-click-log');
      if (out) out.textContent = text;
    };
    return html`<argus-table
        style="block-size: 360px"
        .columns=${columns}
        .data=${data}
        .getRowId=${(o: Order) => o.id}
        @argus-cell-click=${(e: CustomEvent<{ columnId: string; value: unknown }>) => {
          log(`argus-cell-click: ${e.detail.columnId} = ${String(e.detail.value)}`);
        }}
      ></argus-table>
      <p id="argus-click-log" aria-live="polite">Click a cell.</p>`;
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/**
 * Tab into the table: it is one tab stop, starting on the first header. The arrow
 * keys move between cells and between the header and the body; Home and End jump
 * to the start or end of the row. PageDown and PageUp move by a page of rows and
 * scroll with it; Ctrl+Home and Ctrl+End (Cmd on macOS) jump to the first header
 * and the last cell. Enter on a body cell fires the click events (see the log).
 * Enter or Space sorts a focused sortable header, and Alt+Arrow resizes it.
 * Scroll away and press an arrow: focus comes back.
 */
export const Navigation: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    const root = table?.shadowRoot;
    if (!table || !root) return;
    // Tab lands on the first header. user-event's tab() can't see tab stops in a
    // shadow root, so focus that header the way Tab would.
    const first = root.querySelector<HTMLElement>('[role="columnheader"][tabindex="0"]');
    await expect(first?.dataset.col).toBe('id');
    first?.focus();
    await expect(root.activeElement).toBe(first);
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await table.updateComplete;
    const cell = root.activeElement as HTMLElement | null;
    await expect(cell?.dataset.col).toBe('customer');
    await expect(cell?.parentElement?.getAttribute('aria-rowindex')).toBe('2');
    // A page down moves by several rows at once and keeps the column.
    await userEvent.keyboard('{PageDown}');
    await table.updateComplete;
    const paged = root.activeElement as HTMLElement | null;
    await expect(paged?.dataset.col).toBe('customer');
    await expect(Number(paged?.parentElement?.getAttribute('aria-rowindex'))).toBeGreaterThan(3);
  },
};
