import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import type { PinnedRows } from 'argus-table';
import 'argus-table';
import { getOrderId, orderColumns, orders, totals, type Order } from './theme-orders.js';

interface Args {
  scheme: 'auto' | 'light' | 'dark';
  density: 'compact' | 'comfortable' | 'spacious';
  totals: boolean;
}

const meta = {
  title: 'Themes/Material-inspired',
  component: 'argus-table',
  // The toolbar's theme switch stays on Material-inspired here.
  globals: { theme: 'material' },
  args: { scheme: 'auto', density: 'comfortable', totals: true },
  argTypes: {
    scheme: {
      control: 'inline-radio',
      options: ['auto', 'light', 'dark'],
      description: '`data-argus-theme` on an ancestor; `auto` follows the system setting',
    },
    density: { control: 'inline-radio', options: ['compact', 'comfortable', 'spacious'] },
    totals: { control: 'boolean', description: 'A totals row in `pinnedRows.bottom`' },
  },
  render: ({ scheme, density, totals: withTotals }) => {
    const pinnedRows: PinnedRows<Order> = { bottom: withTotals ? [totals] : [] };
    return html`<style>
        .chip {
          padding: 0.15em 0.7em;
          border-radius: 8px;
          font-size: 0.857em;
          font-weight: 500;
        }
        .chip-open {
          background: light-dark(#ffdbcf, #5d4037);
        }
        .chip-paid {
          background: light-dark(#c4eed0, #1e4d2b);
        }
        .chip-shipped {
          background: light-dark(#e8def8, #4a4458);
        }
      </style>
      <div data-argus-theme=${scheme === 'auto' ? '' : scheme} style="padding: 16px">
        <argus-table
          style="block-size: 420px"
          aria-label="Orders"
          density=${density}
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

/**
 * `@argus-table/themes/material.css` borrows the feel of Material 3: its
 * baseline colours, Roboto, taller rows (40, 52 and 60px by density), an
 * outlined surface with rounded corners and deeper shadows on pinned columns.
 * It follows the system's light or dark setting; force a scheme with
 * `data-argus-theme="dark"` or `"light"` on the table or an ancestor.
 *
 * The theme loads no fonts. Load Roboto 400 and 500 yourself, or the table
 * uses the system font:
 *
 * ```js
 * import '@fontsource/roboto/400.css';
 * import '@fontsource/roboto/500.css';
 * import '@argus-table/themes/material.css';
 * ```
 *
 * The status chips are the page's own CSS: cell content is light DOM.
 */
export const Material: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    if (!table) return;
    const style = getComputedStyle(table);
    await expect(style.borderTopLeftRadius).toBe('12px');
    await expect(style.borderTopStyle).toBe('solid');
    const row = table.shadowRoot?.querySelector('[part~="row"]');
    await expect(row?.getBoundingClientRect().height).toBe(52);
  },
};

export const Dark: Story = {
  args: { scheme: 'dark' },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    if (!table) return;
    await expect(getComputedStyle(table).colorScheme).toBe('dark');
  },
};

export const Compact: Story = {
  args: { density: 'compact' },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    const row = table?.shadowRoot?.querySelector('[part~="row"]');
    await expect(row?.getBoundingClientRect().height).toBe(40);
  },
};
