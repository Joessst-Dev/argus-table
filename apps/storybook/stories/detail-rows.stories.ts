import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, ExpandedChangeDetail, RowDetailContext } from 'argus-table';
import 'argus-table';
import { orderColumns, orders, type Order } from './data.js';

const data = orders(2_000);
const getRowId = (o: Order) => o.id;

const meta = {
  title: 'Features/Detail rows',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** The table in a story, once it has rendered. */
async function tableIn(canvasElement: HTMLElement): Promise<ArgusTable<Order>> {
  const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
  if (!table) throw new Error('no <argus-table>');
  await table.updateComplete;
  return table;
}

/** The chevron of the body row at an `aria-rowindex`. */
function chevron(table: ArgusTable<Order>, ariaRowIndex: number): HTMLButtonElement {
  const button = table.shadowRoot?.querySelector<HTMLButtonElement>(
    `[part~="body"] > [aria-rowindex="${String(ariaRowIndex)}"] [part~="expand-toggle"]`,
  );
  if (!button) throw new Error(`no chevron in row ${String(ariaRowIndex)}`);
  return button;
}

/** The detail panel's cell at an `aria-rowindex`. */
const panelAt = (table: ArgusTable<Order>, ariaRowIndex: number) =>
  table.shadowRoot?.querySelector<HTMLElement>(
    `[part~="row-detail"][aria-rowindex="${String(ariaRowIndex)}"] > [part~="detail"]`,
  );

/** Applies a chevron's proposal, for stories that open panels from the start (`expanded` set). */
const apply = (event: CustomEvent<ExpandedChangeDetail>) => {
  (event.currentTarget as ArgusTable<Order>).expanded = event.detail.expanded;
};

/** A summary of the order: what a panel shows in the simplest case. */
const summary = ({ row }: RowDetailContext<Order>) =>
  html`<dl
    class="order-summary"
    style="display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; margin: 0"
  >
    <dt>Customer</dt>
    <dd style="margin: 0">${row.customer}</dd>
    <dt>Ships to</dt>
    <dd style="margin: 0">${row.city}</dd>
    <dt>Status</dt>
    <dd style="margin: 0">${row.status}</dd>
  </dl>`;

/**
 * `rowDetail` adds a column of chevrons; a chevron opens a panel under its row
 * with whatever `rowDetail` returns for it, `{ row, rowId, index }` in hand.
 * Several panels can be open at once (`expanded`, row ids). A panel is as tall
 * as its content, up to `--argus-detail-max-height` (400px), and spans the
 * visible width.
 */
export const Basic: Story = {
  render: () =>
    html`<argus-table
      aria-label="Orders"
      style="block-size: 420px"
      .columns=${orderColumns}
      .data=${data}
      .getRowId=${getRowId}
      .rowDetail=${summary}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const seen: ExpandedChangeDetail[] = [];
    table.addEventListener('argus-expanded-change', (event) => {
      seen.push(event.detail);
    });
    await userEvent.click(chevron(table, 3));
    await waitFor(() => expect(table.expanded).toEqual(['o2']));
    await expect(seen).toEqual([{ expanded: ['o2'], rowId: 'o2', open: true }]);
    await waitFor(() => expect(panelAt(table, 4)).toBeTruthy());
    await expect(table.querySelector('.order-summary')?.textContent).toContain('Customer 2');
    await expect(chevron(table, 3).getAttribute('aria-expanded')).toBe('true');
  },
};

const notes = new Map<string, string>();

/**
 * Panels hold interactive content: a form here. Arrow down onto a panel, press
 * Enter (or F2) to go into it, and Escape to come back to the grid. Keys typed
 * in the form are the form's. What was typed stays while the panel scrolls out
 * of view and back.
 */
export const Form: Story = {
  render: () =>
    html`<argus-table
      aria-label="Orders"
      style="block-size: 420px"
      .columns=${orderColumns}
      .data=${data}
      .getRowId=${getRowId}
      .rowDetail=${({ row, rowId }: RowDetailContext<Order>) =>
        html`<form
          class="order-form"
          style="display: flex; gap: 8px; align-items: end"
          @submit=${(event: SubmitEvent) => {
            event.preventDefault();
            const input = (event.currentTarget as HTMLFormElement).elements.namedItem('note');
            notes.set(rowId, (input as HTMLInputElement).value);
          }}
        >
          <label style="display: grid">Note for ${row.customer}<input name="note" /></label>
          <button type="submit">Save</button>
        </form>`}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await userEvent.click(chevron(table, 2));
    await waitFor(() => expect(panelAt(table, 3)).toBeTruthy());
    const cell = table.shadowRoot?.querySelector<HTMLElement>(
      '[part~="body"] > [aria-rowindex="2"] > [data-col="customer"]',
    );
    cell?.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(panelAt(table, 3)?.tabIndex).toBe(0));
    await userEvent.keyboard('{Enter}');
    const input = table.querySelector<HTMLInputElement>('.order-form input');
    await waitFor(() => expect(document.activeElement).toBe(input));
    await userEvent.keyboard('Leave at the door');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(table.shadowRoot?.activeElement).toBe(panelAt(table, 3)));
    await expect(input?.value).toBe('Leave at the door');
  },
};

const lines = (order: Order) =>
  Array.from({ length: 4 + (Number(order.id.slice(1)) % 30) }, (_, i) => ({
    id: `${order.id}-${String(i + 1)}`,
    product: `Product ${String.fromCharCode(65 + (i % 26))}`,
    quantity: (i % 5) + 1,
  }));

/**
 * A nested table in a panel: the order's lines. With `block-size: auto` and a
 * `max-block-size` it fits its rows, and past them it scrolls inside the panel.
 * Its keys, clicks and sorting are its own.
 */
export const NestedTable: Story = {
  render: () =>
    html`<argus-table
      aria-label="Orders"
      style="block-size: 480px"
      .columns=${orderColumns}
      .data=${data}
      .getRowId=${getRowId}
      .expanded=${['o1', 'o4']}
      @argus-expanded-change=${apply}
      .rowDetail=${({ row }: RowDetailContext<Order>) =>
        html`<argus-table
          class="lines"
          aria-label=${`Lines of ${row.id}`}
          style="block-size: auto; max-block-size: 240px"
          .columns=${[
            { id: 'id', header: 'Line', accessor: 'id', width: 110 },
            {
              id: 'product',
              header: 'Product',
              accessor: 'product',
              width: { flex: 1 },
              sortable: true,
            },
            { id: 'quantity', header: 'Qty', accessor: 'quantity', width: 80, align: 'end' },
          ]}
          .data=${lines(row)}
        ></argus-table>`}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await waitFor(() => expect(table.querySelectorAll('argus-table.lines')).toHaveLength(2));
    const [short] = table.querySelectorAll<ArgusTable>('argus-table.lines');
    // Order o1 has 5 lines: the nested table fits them (a header and 5 rows).
    await waitFor(() => {
      const row = short?.shadowRoot?.querySelector('[part~="body"] > [role="row"]');
      const rowPx = row?.getBoundingClientRect().height ?? 0;
      return expect(
        Math.abs((short?.getBoundingClientRect().height ?? 0) - 6 * rowPx),
      ).toBeLessThan(2);
    });
  },
};

/**
 * `expanded` set by the app: a chevron only proposes the change in
 * `argus-expanded-change`, and nothing opens until the app sets it. Here the app
 * keeps one panel open at a time: it sets `expanded` to the row just opened.
 */
export const OneAtATime: Story = {
  render: () =>
    html`<argus-table
      aria-label="Orders"
      style="block-size: 420px"
      .columns=${orderColumns}
      .data=${data}
      .getRowId=${getRowId}
      .expanded=${[]}
      .rowDetail=${summary}
      @argus-expanded-change=${(event: CustomEvent<ExpandedChangeDetail>) => {
        const table = event.currentTarget as ArgusTable<Order>;
        table.expanded = event.detail.open ? [event.detail.rowId] : [];
      }}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await userEvent.click(chevron(table, 2));
    await waitFor(() => expect(table.expanded).toEqual(['o1']));
    // Row o3 is at aria-rowindex 5 now: o1's panel is above it.
    await userEvent.click(chevron(table, 5));
    await waitFor(() => expect(table.expanded).toEqual(['o3']));
  },
};

/** In a right-to-left page the chevrons point the other way and panels start at the right. */
export const RightToLeft: Story = {
  render: () =>
    html`<div dir="rtl">
      <argus-table
        aria-label="Orders"
        style="block-size: 420px"
        .columns=${orderColumns}
        .data=${data}
        .getRowId=${getRowId}
        .expanded=${['o1']}
        @argus-expanded-change=${apply}
        .rowDetail=${summary}
      ></argus-table>
    </div>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await waitFor(() => expect(panelAt(table, 3)).toBeTruthy());
    const scroller = table.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
    const panel = panelAt(table, 3)?.getBoundingClientRect();
    const box = scroller?.getBoundingClientRect();
    await expect(
      Math.abs(
        (panel?.right ?? 0) -
          ((box?.left ?? 0) + (scroller?.clientLeft ?? 0) + (scroller?.clientWidth ?? 0)),
      ),
    ).toBeLessThan(2);
  },
};
