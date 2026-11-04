import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import type { ColumnDef } from 'argus-table';
import 'argus-table';
import { orderColumns, orders, type Order } from '../data.js';

const data = orders(500);

const columns: ColumnDef<Order>[] = [
  ...orderColumns.filter((c) => c.id !== 'status'),
  {
    id: 'status',
    header: 'Status',
    width: 120,
    // A template: its markup lands in the light DOM, where the page's CSS applies.
    cell: (order) => html`<span class="badge badge-${order.status}">${order.status}</span>`,
  },
  {
    id: 'actions',
    header: html`<span class="visually-hidden">Actions</span>`,
    width: 90,
    pin: 'end',
    cell: (order) => html`<button type="button" aria-label="Open ${order.id}">Open</button>`,
  },
];

const meta = {
  title: 'Styling/Slotted content',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

/**
 * Cell and header content is rendered into the light DOM and slotted into the
 * cells, so the page's own CSS, utility classes and components work inside
 * cells. Here `.badge` is a plain class from the page's stylesheet.
 */
export const PageCss: Story = {
  render: () =>
    html`<style>
        .badge {
          padding: 0.1em 0.6em;
          border-radius: 999px;
          font-size: 0.85em;
        }
        .badge-open {
          background: light-dark(#fff4d6, #3a2d07);
        }
        .badge-paid {
          background: light-dark(#dcf5e3, #0f3320);
        }
        .badge-shipped {
          background: light-dark(#e3e9fb, #1b2647);
        }
        .visually-hidden {
          position: absolute;
          inline-size: 1px;
          block-size: 1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
        }
      </style>
      <argus-table
        style="block-size: 360px"
        aria-label="Orders"
        .columns=${columns}
        .data=${data}
      ></argus-table>`,
  play: async ({ canvasElement }) => {
    const badge = canvasElement.querySelector('.badge');
    await expect(badge).not.toBeNull();
    await expect(badge && getComputedStyle(badge).borderRadius).toBe('999px');
  },
};
