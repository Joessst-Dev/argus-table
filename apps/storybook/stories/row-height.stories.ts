import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import 'argus-table';
import type { ColumnDef } from 'argus-table';
import { orderColumns, orders, type Order } from './data.js';

const notes = [
  'Leave at the door.',
  'Fragile: glassware inside. Please keep upright and call the customer before delivery.',
  'Gift wrap, no invoice in the parcel.',
  'Customer asked to combine this order with the next one from the same address, if it ships within the week.',
];

type Note = Order & { note: string };

const data: Note[] = orders(200).map((o, i) => ({ ...o, note: notes[i % notes.length] ?? '' }));

const columns: ColumnDef<Note>[] = [
  ...(orderColumns.filter((c) => c.id !== 'customer') as ColumnDef<Note>[]),
  { id: 'note', header: 'Note', accessor: 'note', width: { flex: 1 }, minWidth: 180, wrap: true },
];

const meta = {
  title: 'Features/Row height',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

/**
 * `wrap: true` on a column (or `wrap` on `<argus-column>`) wraps its text onto
 * more lines instead of cutting it off. Rows keep their height: here
 * `row-height="56"` leaves room for two lines. Text that fits stays centred;
 * longer text starts at the top and is clipped below.
 */
export const WrappedText: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 400px"
      row-height="56"
      aria-label="Orders with notes"
      .columns=${columns}
      .data=${data}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    const row = table?.shadowRoot?.querySelector<HTMLElement>('[part~="row"]');
    await expect(row?.offsetHeight).toBe(56);
    const note = row?.querySelector<HTMLElement>('[data-col="note"]');
    await expect(note?.hasAttribute('data-wrap')).toBe(true);
    await expect(note && getComputedStyle(note).whiteSpace).toBe('normal');
  },
};
