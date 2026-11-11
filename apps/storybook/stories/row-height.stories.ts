import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import 'argus-table';
import type { ColumnDef } from 'argus-table';
import { orderColumns, orders, type Order } from './data.js';

const frame = () => new Promise(requestAnimationFrame);

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

/**
 * `row-height="auto"` fits each row to its content: wrapped text, and content
 * taller than a line (here a bar whose height follows the total). The row
 * height (`density`, `--argus-row-height`) is the least a row is, and the
 * header's height. Content sits at the top of its cell, with the padding that
 * centres one line (`--argus-cell-padding-block`). Pinned rows grow too.
 *
 * Rows are measured as they render, so rows not seen yet count as one line,
 * and the rows in view stay put while rows above them are measured. Give
 * images a size, so rows don't move when they load.
 */
export const AutoRowHeight: Story = {
  render: () => {
    const auto: ColumnDef<Note>[] = [
      ...columns,
      {
        id: 'bar',
        header: 'Bar',
        width: 70,
        cell: (o) =>
          html`<div
            style="inline-size: 12px; block-size: ${String(16 + Math.round(o.total % 60))}px; background: currentColor; opacity: 0.4"
          ></div>`,
      },
    ];
    return html`<argus-table
      style="block-size: 480px"
      row-height="auto"
      aria-label="Orders with notes, rows fit their content"
      .columns=${auto}
      .data=${data}
      .pinnedRows=${{
        bottom: [
          {
            id: 'total',
            customer: '',
            city: '',
            status: 'open',
            total: data.reduce((sum, o) => sum + o.total, 0),
            note: 'Total of all orders, before discounts and shipping, in the currency of the order.',
          },
        ],
      }}
    ></argus-table>`;
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    await frame();
    await frame();
    await table?.updateComplete;
    const root = table?.shadowRoot;
    const rows = [...(root?.querySelectorAll<HTMLElement>('[part~="body"] > [part~="row"]') ?? [])]
      .map((row) => ({
        index: Number(row.getAttribute('aria-rowindex')),
        box: row.getBoundingClientRect(),
      }))
      .sort((a, b) => a.index - b.index)
      .slice(0, 6);
    // Rows of different heights, one below the other.
    await expect(new Set(rows.map((r) => Math.round(r.box.height))).size).toBeGreaterThan(1);
    for (let i = 1; i < rows.length; i++) {
      await expect(Math.abs((rows[i]?.box.top ?? 0) - (rows[i - 1]?.box.bottom ?? 0))).toBeLessThan(
        1,
      );
    }
    // The header stays one row tall: no taller than the shortest row.
    const header = root?.querySelector<HTMLElement>('[part~="header"]');
    const shortest = Math.min(...rows.map((r) => Math.round(r.box.height)));
    await expect(header?.offsetHeight).toBeLessThanOrEqual(shortest);
  },
};
