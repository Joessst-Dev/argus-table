import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import 'argus-table';
import { orderColumns, orders } from '../data.js';

const data = orders(500);

const meta = {
  title: 'Styling/Parts',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

/**
 * `::part()` styles the table's structure from outside. State is part of the
 * name (`row-odd`, `header-cell-sorted`, `cell-pinned-edge`), because parts
 * can't be chained or combined with attribute selectors. Hover and focus
 * pseudo-classes work: `::part(row):hover`. Click a sortable header (Customer,
 * Total) to see `header-cell-sorted`.
 *
 * ```css
 * #parts-demo::part(header-cell) { text-transform: uppercase; letter-spacing: .04em; }
 * #parts-demo::part(header-cell-sorted) { text-decoration: underline; }
 * #parts-demo::part(row-odd) { background: light-dark(#f7f7f2, #1c1c18); }
 * #parts-demo::part(cell-pinned-edge) { border-inline-end: 1px solid currentColor; }
 * ```
 */
export const Example: Story = {
  render: () =>
    html`<style>
        #parts-demo::part(header-cell) {
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        #parts-demo::part(header-cell-sorted) {
          text-decoration: underline;
        }
        #parts-demo::part(row-odd) {
          background: light-dark(#f7f7f2, #1c1c18);
        }
        #parts-demo::part(cell-pinned-edge) {
          border-inline-end: 1px solid currentColor;
        }
      </style>
      <argus-table
        id="parts-demo"
        style="block-size: 360px"
        aria-label="Orders"
        .columns=${orderColumns}
        .data=${data}
      ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    const header = table?.shadowRoot?.querySelector('[part~="header-cell"]');
    await expect(header && getComputedStyle(header).textTransform).toBe('uppercase');
  },
};
