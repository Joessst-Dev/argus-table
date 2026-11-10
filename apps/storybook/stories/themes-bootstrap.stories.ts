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
  title: 'Themes/Bootstrap-inspired',
  component: 'argus-table',
  // The toolbar's theme switch stays on Bootstrap-inspired here.
  globals: { theme: 'bootstrap' },
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
    // Bootstrap's .badge with .text-bg-warning, -success and -info.
    return html`<style>
        .chip {
          padding: 0.35em 0.65em;
          border-radius: 0.375rem;
          font-size: 0.75em;
          font-weight: 700;
          line-height: 1;
        }
        .chip-open {
          color: #000;
          background: #ffc107;
        }
        .chip-paid {
          color: #fff;
          background: #198754;
        }
        .chip-shipped {
          color: #000;
          background: #0dcaf0;
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
 * `@argus-table/themes/bootstrap.css` looks like a Bootstrap 5
 * `.table.table-striped.table-hover` without loading Bootstrap: its colours,
 * system font stack, padding, striped rows, hover colour and the 2px divider
 * under the header. Rows keep the table's own heights, which match Bootstrap's
 * (40px, and 32px at `compact` like `.table-sm`). It follows the system's light
 * or dark setting; force a scheme with `data-argus-theme="dark"` or `"light"` on
 * the table or an ancestor.
 *
 * ```js
 * import '@argus-table/themes/bootstrap.css';
 * ```
 *
 * Turn the stripes off with `argus-table { --argus-row-stripe-bg: var(--argus-bg); }`.
 * The status badges are the page's own CSS: cell content is light DOM.
 */
export const Bootstrap: Story = {
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const even = table.shadowRoot?.querySelector('[part~="row-even"]');
    const odd = table.shadowRoot?.querySelector('[part~="row-odd"]');
    if (!even || !odd) throw new Error('no rows');
    await expect(even.getBoundingClientRect().height).toBe(40);
    // Striped.
    await expect(getComputedStyle(odd).backgroundColor).not.toBe(
      getComputedStyle(even).backgroundColor,
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
    await expect(row?.getBoundingClientRect().height).toBe(32);
  },
};

/** Selected rows use `.table-primary`'s colour, and the checkboxes the primary colour. */
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
    await expect(getComputedStyle(selected).backgroundColor).toBe('rgb(207, 226, 255)');
    await expect(getComputedStyle(box).accentColor).toBe('rgb(13, 110, 253)');
  },
};
