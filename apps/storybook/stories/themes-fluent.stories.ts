import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, nothing } from 'lit';
import { expect, userEvent } from 'storybook/test';
import type { ArgusTable, PinnedRows } from 'argus-table';
import 'argus-table';
import { getOrderId, orderColumns, orders, totals, type Order } from './theme-orders.js';

interface Args {
  scheme: 'auto' | 'light' | 'dark';
  density: 'compact' | 'comfortable' | 'spacious';
  totals: boolean;
  selection: boolean;
}

const meta = {
  title: 'Themes/Fluent-inspired',
  component: 'argus-table',
  // The toolbar's theme switch stays on Fluent-inspired here.
  globals: { theme: 'fluent' },
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
    // Fluent's tinted badges (warning, success, brand).
    return html`<style>
        .chip {
          padding: 0.1em 0.6em;
          border-radius: 999px;
          font-size: 0.857em;
          font-weight: 600;
        }
        .chip-open {
          color: light-dark(#bc4b09, #faa06b);
          background: light-dark(#fff9f5, #4a1e04);
        }
        .chip-paid {
          color: light-dark(#0e700e, #54b054);
          background: light-dark(#f1faf1, #052505);
        }
        .chip-shipped {
          color: light-dark(#115ea3, #77b7f7);
          background: light-dark(#ebf3fc, #082338);
        }
      </style>
      <div data-argus-theme=${scheme === 'auto' ? '' : scheme} style="padding: 16px">
        <argus-table
          style="block-size: 420px"
          aria-label="Orders"
          density=${density}
          selection-mode=${selection ? 'multi' : nothing}
          ?selection-checkboxes=${selection}
          .columns=${orderColumns}
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
 * `@argus-table/themes/fluent.css` borrows the feel of Fluent 2 on the web: its
 * neutral greys and brand blue, Segoe UI, a flat header on the body colour and
 * the sizes of Fluent's Table (34, 44 and 52px rows by density). It follows the
 * system's light or dark setting; force a scheme with `data-argus-theme="dark"`
 * or `"light"` on the table or an ancestor.
 *
 * The theme loads no fonts. Segoe UI comes with Windows; elsewhere the table
 * uses the system font.
 *
 * ```js
 * import '@argus-table/themes/fluent.css';
 * ```
 *
 * The status badges are the page's own CSS: cell content is light DOM.
 */
export const Fluent: Story = {
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const header = table.shadowRoot?.querySelector('[part~="header-cell"]');
    const row = table.shadowRoot?.querySelector('[part~="row"]');
    if (!header || !row) throw new Error('no header or row');
    await expect(row.getBoundingClientRect().height).toBe(44);
    // The header sits on the body colour.
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
  },
};

export const Compact: Story = {
  args: { density: 'compact' },
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const row = table.shadowRoot?.querySelector('[part~="row"]');
    await expect(row?.getBoundingClientRect().height).toBe(34);
  },
};

/** Selected rows get a light brand tint, and the checkboxes the brand colour. */
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
    await expect(getComputedStyle(selected).backgroundColor).toBe('rgb(235, 243, 252)');
    await expect(getComputedStyle(box).accentColor).toBe('rgb(15, 108, 189)');
  },
};
