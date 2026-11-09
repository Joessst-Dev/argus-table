import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, DataSource, RowSelectDetail } from 'argus-table';
import 'argus-table';
import { orderColumns, orders, type Order } from './data.js';

const data = orders(5_000);
const getRowId = (o: Order) => o.id;

const meta = {
  title: 'Features/Row selection',
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

/** The body cell of a row id and column. Rows render in pool order: find them by id. */
function cellOf(table: ArgusTable<Order>, rowIndex: number, col = 'customer'): HTMLElement {
  const cell = table.shadowRoot?.querySelector<HTMLElement>(
    `[part~="body"] > [aria-rowindex="${String(rowIndex + 2)}"] > [data-col="${col}"]`,
  );
  if (!cell) throw new Error(`no cell in row ${String(rowIndex)}`);
  return cell;
}

const selectedRowIndices = (table: ArgusTable<Order>) =>
  [...(table.shadowRoot?.querySelectorAll('[part~="row-selected"]') ?? [])]
    .map((row) => Number(row.getAttribute('aria-rowindex')) - 2)
    .sort((a, b) => a - b);

/**
 * `selection-mode="multi"`: a click selects one row, Ctrl+click (Cmd+click on
 * macOS) adds or removes a row, and Shift+click selects the range from the last
 * row clicked. Selected rows get the `row-selected` part and
 * `--argus-row-selected-bg`; `selection` holds their ids.
 */
export const Multi: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px"
      selection-mode="multi"
      .columns=${orderColumns}
      .data=${data}
      .getRowId=${getRowId}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    // One session, so a modifier held by keyboard() still counts for click().
    const user = userEvent.setup();
    await user.click(cellOf(table, 1));
    await user.keyboard('{Shift>}');
    await user.click(cellOf(table, 3));
    await user.keyboard('{/Shift}{Control>}');
    await user.click(cellOf(table, 6));
    await user.keyboard('{/Control}');
    await table.updateComplete;
    await expect(table.selection).toEqual(['o2', 'o3', 'o4', 'o7']);
    await expect(selectedRowIndices(table)).toEqual([1, 2, 3, 6]);
  },
};

/** `selection-mode="single"`: one row at a time. Ctrl+click or Space on the selected row clears it. */
export const Single: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px"
      selection-mode="single"
      .columns=${orderColumns}
      .data=${data}
      .getRowId=${getRowId}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await userEvent.click(cellOf(table, 2));
    await userEvent.click(cellOf(table, 4));
    await table.updateComplete;
    await expect(table.selection).toEqual(['o5']);
  },
};

/**
 * `selection-checkboxes` adds a checkbox column, pinned first. A row's checkbox
 * toggles that row and keeps the others; Shift+click adds the range from the last
 * row clicked. The header's checkbox selects every row, shows a mixed state when
 * some are selected, and clears the selection when all are. Space on a focused
 * checkbox cell does the same as clicking its checkbox.
 */
export const Checkboxes: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px"
      selection-mode="multi"
      selection-checkboxes
      .columns=${orderColumns}
      .data=${data}
      .getRowId=${getRowId}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const user = userEvent.setup();
    const box = (row: number) => cellOf(table, row, '--argus-selection').querySelector('input');
    const all = table.shadowRoot?.querySelector<HTMLInputElement>(
      '[part~="header-cell-selection"] input',
    );
    if (!all) throw new Error('no select-all checkbox');
    await user.click(box(1) ?? all);
    await user.click(box(3) ?? all);
    await table.updateComplete;
    await expect(table.selection).toEqual(['o2', 'o4']);
    await expect(all.indeterminate).toBe(true);
    await user.click(all);
    await table.updateComplete;
    await expect(table.selection).toHaveLength(data.length);
    await expect(all.checked).toBe(true);
  },
};

/**
 * From the keyboard: Space toggles the focused row, Shift+ArrowUp/ArrowDown and
 * Shift+PageUp/PageDown extend the selection from the last toggled row, and
 * Ctrl+A (Cmd+A) selects every row.
 */
export const Keyboard: Story = {
  render: Multi.render,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    cellOf(table, 0).focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    await table.updateComplete;
    await expect(table.selection).toEqual(['o1', 'o2', 'o3']);
    await userEvent.keyboard('{Control>}a{/Control}');
    await table.updateComplete;
    await expect(table.selection).toHaveLength(data.length);
  },
};

/**
 * Controlled: the host owns `selection`. Every change fires `argus-row-select`
 * with the proposed ids, and the table only changes once the host sets them.
 * This one allows at most five rows.
 */
export const Controlled: Story = {
  render: () => {
    const count = document.createElement('output');
    count.textContent = '0 selected';
    const onSelect = (event: CustomEvent<RowSelectDetail>) => {
      const table = event.target as ArgusTable<Order>;
      const { selection } = event.detail;
      if (selection.length > 5) return;
      table.selection = selection;
      count.textContent = `${String(selection.length)} selected`;
    };
    const clear = (event: Event) => {
      const table = (event.target as HTMLElement).parentElement?.querySelector('argus-table');
      if (table) table.selection = [];
      count.textContent = '0 selected';
    };
    return html`<p>
        <button type="button" @click=${clear}>Clear</button>
        ${count}
      </p>
      <argus-table
        style="block-size: 380px"
        selection-mode="multi"
        .columns=${orderColumns}
        .data=${data}
        .getRowId=${getRowId}
        .selection=${[]}
        @argus-row-select=${onSelect}
      ></argus-table>`;
  },
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const user = userEvent.setup();
    await user.click(cellOf(table, 0));
    await user.keyboard('{Shift>}');
    await user.click(cellOf(table, 9));
    await user.keyboard('{/Shift}');
    await table.updateComplete;
    // Ten rows were proposed and refused.
    await expect(table.selection).toEqual(['o1']);
  },
};

/** A pretend server: pages of 100 rows after a short delay. */
const source: DataSource<Order> = {
  pageSize: 100,
  getRows: ({ start, end, signal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({ rows: data.slice(start, end), total: data.length });
      }, 300);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason as Error);
      });
    }),
};

/**
 * With a `dataSource`, only loaded rows can be selected: skeleton rows can't,
 * and Ctrl+A selects the rows loaded so far. `selection` keeps its ids while
 * pages are evicted and loaded again.
 */
export const WithDataSource: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px"
      selection-mode="multi"
      .columns=${orderColumns}
      .dataSource=${source}
      .getRowId=${getRowId}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await waitFor(() =>
      expect(cellOf(table, 0).parentElement?.part.contains('row-loading')).toBe(false),
    );
    cellOf(table, 0).focus();
    await userEvent.keyboard('{Control>}a{/Control}');
    await table.updateComplete;
    await expect(table.selection).toHaveLength(100);
  },
};
