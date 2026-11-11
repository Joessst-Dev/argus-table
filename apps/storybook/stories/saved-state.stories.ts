import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, ColumnDef, TableState } from 'argus-table';
import 'argus-table';
import { headerMenu } from '@argus-table/header-menu';
import { orders, type Order } from './data.js';

const data = orders(10_000);
// One plugin instance, kept: a new one would reconnect and close an open menu.
const plugins = [headerMenu<Order>()];

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true, filter: 'set' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, filter: 'set' },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
  },
];

const meta = {
  title: 'Features/Saved state',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

const STORAGE_KEY = 'argus-table:saved-state-story';

function load(): TableState | undefined {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as TableState) : undefined;
  } catch {
    return undefined;
  }
}

function store(state: TableState | undefined): void {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the table still works.
  }
}

const tableOf = (from: Element) =>
  from.closest('div')?.parentElement?.querySelector<ArgusTable<Order>>('argus-table');

/**
 * `getState()` returns what users changed (sort order, column widths, order, pins,
 * hidden columns, filters, selection, `quickFilter` and the scroll position) as one
 * object of plain JSON, and `setState(state)` puts it back. Sort, resize, move or
 * hide columns (the column menu pins, hides and filters them), scroll, then Save:
 * the layout goes to `localStorage` and comes back with Restore, after a reload too.
 * `setState()` changes only the keys it's given, leaves properties you control
 * alone and fires no events.
 */
export const SaveAndRestore: Story = {
  render: () => {
    const status = (from: Element, text: string) => {
      const output = from.closest('div')?.querySelector('output');
      if (output) output.textContent = text;
    };
    const onSave = (event: Event) => {
      const button = event.currentTarget as HTMLElement;
      store(tableOf(button)?.getState());
      status(button, 'Saved.');
    };
    const onRestore = (event: Event) => {
      const button = event.currentTarget as HTMLElement;
      const saved = load();
      if (!saved) {
        status(button, 'Nothing saved yet.');
        return;
      }
      void tableOf(button)
        ?.setState(saved)
        .then(() => {
          status(button, 'Restored.');
        });
    };
    const onForget = (event: Event) => {
      store(undefined);
      status(event.currentTarget as HTMLElement, 'Forgotten.');
    };
    return html`<div>
      <div
        style="display: flex; gap: 8px; align-items: center; margin-block-end: 12px; font: 14px sans-serif"
      >
        <button type="button" @click=${onSave}>Save</button>
        <button type="button" @click=${onRestore}>Restore</button>
        <button type="button" @click=${onForget}>Forget</button>
        <output aria-live="polite"></output>
      </div>
      <argus-table
        aria-label="Orders"
        style="block-size: 360px"
        selection-mode="multi"
        .getRowId=${(order: Order) => order.id}
        .columns=${columns}
        .data=${data}
        .plugins=${plugins}
      ></argus-table>
    </div>`;
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
    const [save, restore, forget] = canvasElement.querySelectorAll('button');
    if (!table || !save || !restore || !forget) return;
    await table.updateComplete;
    const sortBy = (id: string) =>
      table.shadowRoot?.querySelector<HTMLElement>(`[data-sort-col="${id}"]`);

    const total = sortBy('total');
    if (total) await userEvent.click(total);
    await table.scrollToRow(250);
    await userEvent.click(save);
    await expect(load()).toMatchObject({
      sorting: [{ id: 'total', desc: false }],
      scroll: { row: 250 },
    });

    const city = sortBy('city');
    if (city) await userEvent.click(city);
    await table.scrollToRow(0);
    await userEvent.click(restore);
    await waitFor(() => {
      const state = table.getState();
      return expect([state.sorting, state.scroll.row]).toEqual([
        [{ id: 'total', desc: false }],
        250,
      ]);
    });

    // Leave the story as it started.
    await userEvent.click(forget);
    await table.setState({ sorting: [], scroll: { row: 0, left: 0 } });
  },
};
