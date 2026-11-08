import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, nothing } from 'lit';
import { expect } from 'storybook/test';
import 'argus-table';
import { orders, type Order } from './data.js';

const data = orders(10_000);

const headerTexts = (table: Element | null) =>
  [...(table?.shadowRoot?.querySelectorAll('[part~="header-cell"]') ?? [])].map(
    (h) => h.querySelector('slot')?.assignedElements()[0]?.textContent ?? '',
  );

interface Args {
  city: boolean;
}

const meta = {
  title: 'Features/Declarative columns',
  component: 'argus-column',
  args: { city: true },
  render: ({ city }) => {
    const status = (order: Order) =>
      html`<strong>${order.status === 'open' ? 'Open' : order.status}</strong>`;
    return html`<argus-table
      style="block-size: 400px"
      .data=${data}
      .getRowId=${(o: Order) => o.id}
    >
      <argus-column column-id="id" header="Order" accessor="id" width="100" pin="start">
      </argus-column>
      <argus-column
        column-id="customer"
        header="Customer"
        accessor="customer"
        width="1fr"
        min-width="160"
        sortable
      ></argus-column>
      ${
        city
          ? html`<argus-column column-id="city" header="City" accessor="city" width="140">
            </argus-column>`
          : nothing
      }
      <argus-column column-id="status" header="Status" width="120" .cell=${status}> </argus-column>
      <argus-column
        column-id="total"
        header="Total"
        accessor="total"
        width="110"
        align="end"
        sortable
      >
      </argus-column>
      <argus-column column-id="actions" header="Actions" width="100" pin="end" resizable="false">
        <template><button type="button">Open</button></template>
      </argus-column>
    </argus-table>`;
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/**
 * Columns written as `<argus-column>` children instead of the `columns` property.
 * Attributes cover the plain fields: `column-id`, `header`, `accessor` (a path),
 * `width` (`100`, `auto` or `1fr`), `min-width`, `max-width`, `pin`, `align`, and
 * the flags `sortable`, `resizable` and `reorderable` (`resizable="false"` turns one
 * off). A `<template>` child is static content for every cell, like the Open
 * buttons; set the `cell` property for content that depends on the row, like
 * Status. A non-empty `columns` property wins over the children.
 */
export const Markup: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    await expect(headerTexts(table)).toEqual([
      'Order',
      'Customer',
      'City',
      'Status',
      'Total',
      'Actions',
    ]);
    const buttons = table?.querySelectorAll('button');
    await expect(buttons?.length).toBeGreaterThan(0);
  },
};

/**
 * The table follows its children: add, remove or move an `<argus-column>`, or
 * change an attribute, and the columns update, keeping widths, order and sorting
 * by `column-id`. Framework loops (`v-for`, `@for`, `.map()`) just work. Toggle
 * the `city` control to try it.
 */
export const Dynamic: Story = {
  args: { city: false },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    await expect(headerTexts(table)).not.toContain('City');
  },
};
