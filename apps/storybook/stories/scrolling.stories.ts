import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, ColumnDef, ScrollAlign } from 'argus-table';
import 'argus-table';
import { orders, type Order } from './data.js';

const data = orders(100_000);

/** Twenty month columns after the order: wider than the view, so it scrolls sideways. */
const months = Array.from({ length: 20 }, (_, i) => `m${String(i + 1)}`);

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 160 },
  ...months.map((id, i): ColumnDef<Order> => ({
    id,
    header: `Month ${String(i + 1)}`,
    accessor: (order) => Math.round(order.total * (1 + i / 10)),
    width: 110,
    align: 'end',
  })),
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', pin: 'end' },
];

const meta = {
  title: 'Features/Scrolling',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

const ALIGNS: ScrollAlign[] = ['start', 'center', 'end', 'nearest'];

/**
 * `scrollToRow()` scrolls to a row by index in the current order or by `{ id }`,
 * and `scrollToColumn(id)` scrolls sideways to a column. `align` says where the
 * target lands: `'start'`, `'center'`, `'end'`, or `'nearest'` (only as far as
 * needed; the default for columns). The header, pinned rows and pinned columns
 * are left out of the view, so the target never ends up behind them. Both
 * resolve `true` once the target is in view, and `false` when there's nothing
 * to scroll to.
 */
export const ScrollToRowAndColumn: Story = {
  render: () => {
    const form = (from: Element) => {
      const root = from.closest('form');
      const table = root?.parentElement?.querySelector<ArgusTable<Order>>('argus-table');
      const value = (name: string) =>
        root?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value ?? '';
      const output = root?.querySelector('output');
      return { table, value, output };
    };
    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      const { table, value, output } = form(event.currentTarget as Element);
      if (!table || !output) return;
      const align = value('align') as ScrollAlign;
      const target = (event.submitter as HTMLButtonElement | null)?.value;
      const done =
        target === 'column'
          ? table.scrollToColumn(value('column'), { align })
          : table.scrollToRow({ id: value('row') }, { align });
      void done.then((found) => {
        output.textContent = found ? 'Scrolled.' : 'Not found.';
      });
    };
    return html`<div>
      <form
        @submit=${onSubmit}
        style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-block-end: 12px; font: 14px sans-serif"
      >
        <label>Order id <input name="row" value="o50000" size="8" /></label>
        <button type="submit" value="row">Scroll to row</button>
        <label
          >Column
          <select name="column">
            ${columns.map(
              (c) => html`<option value=${c.id} ?selected=${c.id === 'm15'}>${c.header}</option>`,
            )}
          </select></label
        >
        <button type="submit" value="column">Scroll to column</button>
        <label
          >Align
          <select name="align">
            ${ALIGNS.map((a) => html`<option ?selected=${a === 'center'}>${a}</option>`)}
          </select></label
        >
        <output aria-live="polite"></output>
      </form>
      <argus-table
        aria-label="Orders"
        style="block-size: 360px; inline-size: min(100%, 900px)"
        .getRowId=${(order: Order) => order.id}
        .columns=${columns}
        .data=${data}
      ></argus-table>
    </div>`;
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
    const [toRow, toColumn] = canvasElement.querySelectorAll('button');
    const output = canvasElement.querySelector('output');
    if (!table || !toRow || !toColumn || !output) return;
    await table.updateComplete;
    const scroller = table.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
    if (!scroller) return;

    await userEvent.click(toRow);
    await waitFor(() => expect(output.textContent).toBe('Scrolled.'));
    // Order o50000 is row 49,999, centred: a few rows above it show.
    const top = table.getState().scroll.row;
    await expect(top).toBeLessThan(49_999);
    await expect(top).toBeGreaterThan(49_990);
    const shown = [...table.children].some((c) => c.textContent === 'o50000');
    await expect(shown).toBe(true);

    output.textContent = '';
    await userEvent.click(toColumn);
    await waitFor(() => expect(output.textContent).toBe('Scrolled.'));
    await expect(scroller.scrollLeft).toBeGreaterThan(0);

    await expect(table.scrollToRow({ id: 'nope' })).resolves.toBe(false);
  },
};
