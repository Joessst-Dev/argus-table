import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, ColumnDef } from 'argus-table';
import 'argus-table';
import { applyEdit, cellEditing, type CellEditDetail } from '@argus-table/editing';
import { headerMenu } from '@argus-table/header-menu';
import { orders, type Order } from './data.js';

const meta = {
  title: 'Add-ons/Editing',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

// Kept between renders: new plugin instances would reconnect.
const plugins = [cellEditing<Order>(), headerMenu<Order>()];

const orderColumns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    meta: { edit: true },
  },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 130,
    filter: 'set',
    filterOptions: ['open', 'paid', 'shipped'],
    meta: { edit: true },
  },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
    meta: {
      edit: {
        editable: (row) => row.status !== 'shipped',
        validate: (value) =>
          value === null || (typeof value === 'number' && value < 0)
            ? 'Enter an amount of 0 or more'
            : undefined,
      },
    },
  },
];

/** The app's side: apply each edit to `data`. */
function apply(event: CustomEvent<CellEditDetail<unknown>>) {
  const table = event.currentTarget as ArgusTable<unknown>;
  table.data = applyEdit(table.data, event.detail, table.columns);
}

async function tableIn<T>(canvasElement: HTMLElement): Promise<ArgusTable<T>> {
  const table = canvasElement.querySelector<ArgusTable<T>>('argus-table');
  if (!table) throw new Error('no <argus-table>');
  await table.updateComplete;
  return table;
}

function cellOf<T>(table: ArgusTable<T>, row: number, col: string): HTMLElement {
  const cell = table.shadowRoot?.querySelector<HTMLElement>(
    `[aria-rowindex="${String(row + 2)}"] > [data-col="${col}"]`,
  );
  if (!cell) throw new Error(`no cell ${String(row)} ${col}`);
  return cell;
}

const textOf = (cell: HTMLElement) =>
  cell.querySelector('slot')?.assignedElements()[0]?.textContent.trim();

/**
 * `@argus-table/editing` is a plugin: `table.plugins = [cellEditing()]`, and each
 * editable column says so in `meta: { edit: true }` or `meta: { edit: { … } }`.
 * Press Enter or F2, start typing, or double-click a cell to edit it; Enter
 * commits and moves down, Tab moves to the next editable column, Escape
 * cancels. The editor follows the column's `filter` kind: text for Customer, a
 * select of `filterOptions` for Status, the number editor for Total (which
 * validates, and can't be edited on shipped orders).
 *
 * The table never changes `data`: a commit fires `argus-cell-edit`, and the app
 * applies it, here with `applyEdit(table.data, event.detail, table.columns)`.
 */
export const Orders: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px"
      .columns=${orderColumns}
      .data=${orders(200)}
      .getRowId=${(o: Order) => o.id}
      .plugins=${plugins}
      @argus-cell-edit=${apply}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn<Order>(canvasElement);
    cellOf(table, 0, 'customer').focus();
    await userEvent.keyboard('{Enter}');
    const input = await waitFor(() => {
      const found = table.querySelector<HTMLInputElement>('.argus-edit-input');
      if (!found) throw new Error('no editor');
      return found;
    });
    await expect(input.getAttribute('aria-label')).toBe('Customer, row 1');
    await userEvent.keyboard('Ada Lovelace{Enter}');
    await waitFor(() => expect(textOf(cellOf(table, 0, 'customer'))).toBe('Ada Lovelace'));
    await expect(table.data[0]?.customer).toBe('Ada Lovelace');
  },
};

/** The number editor with `validate`: a message keeps the editor open until the value is right. */
export const Validation: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 240px"
      .columns=${orderColumns}
      .data=${orders(20).map((o) => ({ ...o, status: 'open' }))}
      .getRowId=${(o: Order) => o.id}
      .plugins=${plugins}
      @argus-cell-edit=${apply}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn<Order>(canvasElement);
    cellOf(table, 0, 'total').focus();
    await userEvent.keyboard('-5{Enter}');
    const message = await waitFor(() => {
      const found = table.querySelector<HTMLElement>('.argus-edit-error');
      if (!found) throw new Error('no message');
      return found;
    });
    await expect(message.textContent).toBe('Enter an amount of 0 or more');
    await expect(table.querySelector('.argus-edit-input')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
    await userEvent.keyboard('{Escape}');
  },
};

interface Task {
  id: string;
  title: string;
  due: Date | null;
  done: boolean;
  priority: 1 | 2 | 3;
}

const tasks: Task[] = Array.from({ length: 30 }, (_, i) => ({
  id: `t${String(i + 1)}`,
  title: `Task ${String(i + 1)}`,
  due: i % 4 === 3 ? null : new Date(2026, 10, 16 + i),
  done: i % 3 === 0,
  priority: ((i % 3) + 1) as 1 | 2 | 3,
}));

const taskPlugins = [cellEditing<Task>()];

const taskColumns: ColumnDef<Task>[] = [
  { id: 'title', header: 'Task', accessor: 'title', width: { flex: 1 }, meta: { edit: true } },
  {
    id: 'due',
    header: 'Due',
    accessor: 'due',
    width: 150,
    filter: 'date',
    cell: (task) => task.due?.toLocaleDateString() ?? '',
    meta: { edit: true },
  },
  {
    id: 'done',
    header: 'Done',
    accessor: 'done',
    width: 80,
    meta: { edit: { editor: 'checkbox' } },
  },
  {
    id: 'priority',
    header: 'Priority',
    accessor: 'priority',
    width: 170,
    meta: {
      edit: {
        // A custom editor: three buttons. It commits (or cancels) itself.
        editor: ({ value, label, commit, cancel }) =>
          html`<div role="group" aria-label=${label} class="priority-editor">
            ${([1, 2, 3] as const).map(
              (p) =>
                html`<button
                  type="button"
                  aria-pressed=${String(p === value)}
                  @click=${() => {
                    commit(p);
                  }}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Tab') cancel();
                  }}
                >
                  ${'!'.repeat(p)}
                </button>`,
            )}
          </div>`,
      },
    },
  },
];

/**
 * The other editors: `date` (from the column's `filter: 'date'`; a `Date` stays a
 * `Date`), `checkbox` (a click, Space or Enter toggles it, without an editing
 * mode) and a custom editor, a function that returns content for the cell, like
 * `cell`. With the React, Vue or Angular wrapper it can return a component. It
 * gets `{ value, row, label, commit, cancel }`; the plugin focuses its first
 * control, and Escape or leaving it cancels.
 */
export const MoreEditors: Story = {
  render: () =>
    html`<style>
        .priority-editor {
          display: flex;
          gap: 4px;
        }
        .priority-editor button {
          min-inline-size: 2.5em;
          font: inherit;
        }
        .priority-editor button[aria-pressed='true'] {
          font-weight: 600;
        }
      </style>
      <argus-table
        style="block-size: 360px"
        .columns=${taskColumns}
        .data=${tasks}
        .getRowId=${(t: Task) => t.id}
        .plugins=${taskPlugins}
        @argus-cell-edit=${apply}
      ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn<Task>(canvasElement);
    const box = cellOf(table, 1, 'done')
      .querySelector('slot')
      ?.assignedElements()[0]
      ?.querySelector<HTMLInputElement>('.argus-edit-check');
    await expect(box?.checked).toBe(false);
    if (box) await userEvent.click(box);
    await waitFor(() => expect(table.data[1]?.done).toBe(true));

    cellOf(table, 0, 'priority').focus();
    await userEvent.keyboard('{Enter}');
    const buttons = await waitFor(() => {
      const found = table.querySelectorAll<HTMLButtonElement>('.priority-editor button');
      if (found.length !== 3) throw new Error('no editor');
      return found;
    });
    if (buttons[2]) await userEvent.click(buttons[2]);
    await waitFor(() => expect(table.data[0]?.priority).toBe(3));
  },
};
