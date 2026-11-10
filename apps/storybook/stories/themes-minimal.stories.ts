import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, nothing } from 'lit';
import { expect, userEvent } from 'storybook/test';
import type { ArgusTable, ColumnDef, PinnedRows } from 'argus-table';
import 'argus-table';
import { getOrderId, orderColumns, orders, totals, type Order } from './theme-orders.js';

// Status as a coloured dot plus the label, no badge (page CSS: cell content is
// light DOM). The label is plain text in the cell, so axe reads it against the
// row even in rows rendered out of view.
const columns: ColumnDef<Order>[] = orderColumns.map((column) =>
  column.id === 'status'
    ? {
        ...column,
        cell: (order, { pinned }) =>
          pinned ? '' : html`<span class="dot dot-${order.status}"></span>${order.status}`,
      }
    : column,
);

interface Args {
  scheme: 'auto' | 'light' | 'dark';
  density: 'compact' | 'comfortable' | 'spacious';
  totals: boolean;
  selection: boolean;
}

const meta = {
  title: 'Themes/Minimal',
  component: 'argus-table',
  // The toolbar's theme switch stays on Minimal here.
  globals: { theme: 'minimal' },
  args: { scheme: 'auto', density: 'comfortable', totals: true, selection: false },
  argTypes: {
    scheme: {
      control: 'inline-radio',
      options: ['auto', 'light', 'dark'],
      description: '`data-argus-theme` on an ancestor; `auto` follows the system setting',
    },
    density: { control: 'inline-radio', options: ['compact', 'comfortable', 'spacious'] },
    totals: { control: 'boolean', description: 'A totals row in `pinnedRows.bottom`' },
    selection: {
      control: 'boolean',
      description: '`selection-mode="multi"` with `selection-checkboxes`',
    },
  },
  render: ({ scheme, density, totals: withTotals, selection }) => {
    const pinnedRows: PinnedRows<Order> = { bottom: withTotals ? [totals] : [] };
    return html`<style>
        .dot {
          display: inline-block;
          inline-size: 8px;
          block-size: 8px;
          margin-inline-end: 8px;
          border-radius: 50%;
        }
        .dot-open {
          background: light-dark(#b45309, #f0b35b);
        }
        .dot-paid {
          background: light-dark(#1f8a4c, #4fbf7f);
        }
        .dot-shipped {
          background: light-dark(#2f5bd3, #6e9cf0);
        }
      </style>
      <div data-argus-theme=${scheme === 'auto' ? '' : scheme} style="padding: 16px">
        <argus-table
          style="block-size: 480px"
          aria-label="Orders"
          density=${density}
          selection-mode=${selection ? 'multi' : nothing}
          ?selection-checkboxes=${selection}
          .columns=${columns}
          .data=${orders}
          .pinnedRows=${pinnedRows}
          .getRowId=${getOrderId}
        ></argus-table>
      </div>`;
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

async function tableIn(canvasElement: HTMLElement): Promise<ArgusTable<Order>> {
  const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
  if (!table) throw new Error('no <argus-table>');
  await table.updateComplete;
  return table;
}

/**
 * `@argus-table/themes/minimal.css` is a quiet, airy table: header and body on
 * one surface, no column lines, faint hairlines between rows, small uppercase
 * column labels, 44, 56 and 68px rows by density and one amber accent. It was
 * designed dark first and follows the system's light or dark setting; force a
 * scheme with `data-argus-theme="dark"` or `"light"` on the table or an
 * ancestor.
 *
 * The theme loads no fonts. Load Instrument Sans on the page (400, 500 and
 * 600); without it the table uses the system font.
 *
 * ```js
 * import '@fontsource/instrument-sans/400.css';
 * import '@fontsource/instrument-sans/500.css';
 * import '@fontsource/instrument-sans/600.css';
 * import '@argus-table/themes/minimal.css';
 * ```
 *
 * The status dots are the page's own CSS: cell content is light DOM.
 */
export const Minimal: Story = {
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const header = table.shadowRoot?.querySelector('[part~="header-cell"]');
    const row = table.shadowRoot?.querySelector('[part~="row"]');
    if (!header || !row) throw new Error('no header or row');
    await expect(row.getBoundingClientRect().height).toBe(56);
    await expect(getComputedStyle(header).textTransform).toBe('uppercase');
    // Header and body share one surface.
    await expect(getComputedStyle(header).backgroundColor).toBe(
      getComputedStyle(row).backgroundColor,
    );
  },
};

export const Dark: Story = {
  args: { scheme: 'dark' },
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await expect(getComputedStyle(table).colorScheme).toBe('dark');
    const row = table.shadowRoot?.querySelector('[part~="row-even"]');
    if (!row) throw new Error('no row');
    await expect(getComputedStyle(row).backgroundColor).toBe('rgb(15, 16, 18)');
  },
};

export const Compact: Story = {
  args: { density: 'compact' },
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const row = table.shadowRoot?.querySelector('[part~="row"]');
    await expect(row?.getBoundingClientRect().height).toBe(44);
  },
};

/** Selected rows get a faint amber tint, and the checkboxes the amber itself. */
export const Selection: Story = {
  args: { scheme: 'light', selection: true },
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const box = table.shadowRoot?.querySelector<HTMLInputElement>(
      '[part~="body"] [part~="cell-selection"] input',
    );
    if (!box) throw new Error('no row checkbox');
    await userEvent.click(box);
    await table.updateComplete;
    const selected = table.shadowRoot?.querySelector('[part~="row-selected"]');
    if (!selected) throw new Error('no selected row');
    await expect(getComputedStyle(selected).backgroundColor).toBe('rgb(253, 244, 231)');
    await expect(getComputedStyle(box).accentColor).toBe('rgb(180, 83, 9)');
  },
};
