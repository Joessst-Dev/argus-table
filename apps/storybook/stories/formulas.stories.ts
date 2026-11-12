import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, ColumnDef } from 'argus-table';
import 'argus-table';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';

interface Item {
  id: string;
  product: string;
  price: number;
  qty: number;
  discount: number;
  ordered: string;
}

const products = ['Desk lamp', 'Notebook', 'Pen set', 'Monitor arm', 'Chair mat'];
const prices = [12.5, 3.2, 8, 49.9, 24];
const pad = (n: number) => String(n).padStart(2, '0');

function items(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `i${String(i + 1)}`,
    product: products[i % products.length] ?? '',
    price: prices[i % prices.length] ?? 0,
    qty: (i * 7) % 23,
    discount: [0, 0.05, 0.1][i % 3] ?? 0,
    ordered: `2026-${pad(1 + (i % 12))}-${pad(1 + (i % 28))}`,
  }));
}

const data = items(1_000);

const dataColumns: ColumnDef<Item>[] = [
  { id: 'product', header: 'Product', accessor: 'product', width: 140, pin: 'start' },
  { id: 'price', header: 'Unit price', accessor: 'price', width: 100, align: 'end' },
  { id: 'qty', header: 'Quantity', accessor: 'qty', width: 100, align: 'end', sortable: true },
  { id: 'discount', header: 'Discount', accessor: 'discount', width: 100, align: 'end' },
  { id: 'ordered', header: 'Ordered', accessor: 'ordered', width: 120 },
];

const columns: ColumnDef<Item>[] = [
  ...dataColumns,
  {
    id: 'total',
    header: 'Total',
    formula: '[Unit price] * [Quantity] * (1 - [Discount])',
    width: 110,
    sortable: true,
  },
  { id: 'gross', header: 'Gross', formula: 'ROUND([Total] * 1.19, 2)', width: 110, sortable: true },
  { id: 'stock', header: 'Stock', formula: 'IF([qty] < 10, "Low", "OK")', width: 90 },
  { id: 'month', header: 'Month', formula: 'TEXT([Ordered], "mmm yyyy")', width: 110 },
];

// Kept between renders: a new plugin instance compiles every formula again.
const plugins = [formulas<Item>()];

const meta = {
  title: 'Add-ons/Formulas',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

async function tableIn(canvasElement: HTMLElement): Promise<ArgusTable<Item>> {
  const table = canvasElement.querySelector<ArgusTable<Item>>('argus-table');
  if (!table) throw new Error('no <argus-table>');
  await table.updateComplete;
  return table;
}

function headerOf(table: ArgusTable<Item>, id: string): HTMLElement {
  const header = table.shadowRoot?.querySelector<HTMLElement>(
    `[role="columnheader"][data-col="${id}"]`,
  );
  if (!header) throw new Error(`no header ${id}`);
  return header;
}

/** The content of a body cell, by the row's position in the current order (0 = first). */
function cellOf(table: ArgusTable<Item>, row: number, col: string): Element | undefined {
  const rowEl = table.shadowRoot?.querySelector(
    `[part~="row"]:not([part~="row-pinned"])[aria-rowindex="${String(row + 2)}"]`,
  );
  return rowEl?.querySelector<HTMLSlotElement>(`[data-col="${col}"] slot`)?.assignedElements()[0];
}

const textOf = (table: ArgusTable<Item>, row: number, col: string) =>
  cellOf(table, row, col)?.textContent.trim();

/**
 * `@argus-table/formulas` is a plugin: `table.plugins = [formulas()]`. A column
 * with a `formula` computes its value per row from other columns, named in
 * brackets by id or header: here Total, Gross, Stock and Month. A formula can
 * use another formula column (Gross uses Total), and a formula column sorts,
 * resizes and moves like any other.
 */
export const Default: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px"
      .columns=${columns}
      .data=${data}
      .plugins=${plugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await waitFor(() => expect(textOf(table, 1, 'total')).toBe('21.28'));
    await expect(textOf(table, 1, 'gross')).toBe('25.32');
    await expect(textOf(table, 1, 'stock')).toBe('Low');
    await expect(textOf(table, 2, 'stock')).toBe('OK');
    await expect(textOf(table, 1, 'month')).toBe('Feb 2026');
    await expect(headerOf(table, 'gross').dataset.align).toBe('end');

    await userEvent.click(headerOf(table, 'gross'));
    await userEvent.click(headerOf(table, 'gross'));
    await waitFor(() => expect(table.sorting).toEqual([{ id: 'gross', desc: true }]));
    await waitFor(async () => {
      const first = Number(textOf(table, 0, 'gross'));
      const second = Number(textOf(table, 1, 'gross'));
      await expect(first).toBeGreaterThanOrEqual(second);
      await expect(first).toBeGreaterThan(1000);
    });
  },
};

const totalOf = (item: Item) => item.price * item.qty * (1 - item.discount);

const wholeColumns: ColumnDef<Item>[] = [
  {
    id: 'product',
    header: 'Product',
    accessor: 'product',
    width: 140,
    pin: 'start',
    filter: 'set',
  },
  // Unit price, Quantity and Discount, which Total reads.
  ...dataColumns.slice(1, 4),
  {
    id: 'total',
    header: 'Total',
    formula: '[Unit price] * [Quantity] * (1 - [Discount])',
    width: 100,
    sortable: true,
  },
  {
    id: 'share',
    header: 'Share %',
    formula: 'ROUND([Total] / SUM([[Total]]) * 100, 3)',
    width: 100,
    sortable: true,
  },
  {
    id: 'orders',
    header: 'Orders of product',
    formula: 'COUNTIF([[Product]], [Product])',
    width: 150,
  },
  {
    id: 'rank',
    header: 'Rank',
    formula: 'RANK([Total], [[Total]])',
    width: 80,
    sortable: true,
  },
  {
    id: 'best',
    header: 'Best seller',
    formula: 'INDEX([[Product]], MATCH(MAX([[Total]]), [[Total]], 0))',
    width: 130,
  },
];

const wholePlugins = [formulas<Item>(), headerMenu<Item>()];

/**
 * `[[name]]` is a whole column: its values in every row the filters keep, while
 * `[name]` is the row's own value. Share % divides by `SUM([[Total]])`, Orders of
 * product counts with `COUNTIF`, Rank ranks with `RANK`, and Best seller looks up
 * the product of the largest total with `INDEX` and `MATCH`. Filter Product from
 * its column menu: every total follows. A filter on Share % itself hides rows but
 * leaves its totals alone.
 */
export const WholeColumns: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px"
      .columns=${wholeColumns}
      .data=${data}
      .plugins=${wholePlugins}
      .sorting=${[{ id: 'rank', desc: false }]}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const sum = data.reduce((acc, item) => acc + totalOf(item), 0);
    const best = data.reduce((a, b) => (totalOf(b) > totalOf(a) ? b : a));
    await waitFor(() => expect(textOf(table, 0, 'rank')).toBe('1'));
    await expect(textOf(table, 0, 'orders')).toBe(String(data.length / products.length));
    await expect(textOf(table, 0, 'best')).toBe(best.product);
    await expect(Number(textOf(table, 0, 'share'))).toBeCloseTo((totalOf(best) / sum) * 100, 2);

    // Only notebooks: the totals, ranks and the best seller follow the filter.
    table.columnFilters = { product: { kind: 'set', values: ['Notebook'] } };
    const notebooks = data.filter((item) => item.product === 'Notebook');
    const notebookSum = notebooks.reduce((acc, item) => acc + totalOf(item), 0);
    const top = Math.max(...notebooks.map(totalOf));
    await waitFor(() => expect(textOf(table, 0, 'product')).toBe('Notebook'));
    await expect(textOf(table, 0, 'rank')).toBe('1');
    await expect(textOf(table, 0, 'best')).toBe('Notebook');
    await expect(textOf(table, 0, 'orders')).toBe(String(notebooks.length));
    await expect(Number(textOf(table, 0, 'share'))).toBeCloseTo((top / notebookSum) * 100, 2);
  },
};

const errorColumns: ColumnDef<Item>[] = [
  ...dataColumns.slice(0, 3),
  { id: 'per', header: 'Per piece', formula: '[Unit price] / [Quantity]', width: 110 },
  {
    id: 'safe',
    header: 'Per piece (safe)',
    formula: 'IFERROR(ROUND([Unit price] / [Quantity], 2), "–")',
    width: 150,
  },
  { id: 'missing', header: 'Weight × 2', formula: '[Weight] * 2', width: 110 },
  { id: 'loop', header: 'Loop', formula: '[Loop] + 1', width: 90 },
  { id: 'unknown', header: 'Tax', formula: 'TAX([Unit price])', width: 90 },
];

/**
 * Errors are cell values, never crashes: they pass through the rest of the
 * formula, explain themselves in a tooltip, and sort last. `IFERROR` replaces
 * them. `--argus-formula-error-fg` colours them.
 */
export const Errors: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 260px; --argus-formula-error-fg: #b42318"
      .columns=${errorColumns}
      .data=${items(5)}
      .plugins=${plugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const error = (col: string) => {
      const el = cellOf(table, 0, col)?.querySelector('.argus-formula-error');
      return el && [el.textContent, el.getAttribute('title')];
    };
    await waitFor(() => expect(error('per')).toEqual(['#DIV/0!', 'Division by zero.']));
    await expect(textOf(table, 0, 'safe')).toBe('–');
    await expect(textOf(table, 1, 'safe')).toBe('0.46');
    await expect(error('missing')).toEqual(['#REF!', 'There is no column [Weight].']);
    await expect(error('loop')).toEqual(['#CYCLE!', 'The formula depends on its own result.']);
    await expect(error('unknown')).toEqual(['#NAME?', 'There is no function TAX.']);
  },
};

const vatPlugins = [
  formulas<Item>({
    functions: {
      VAT: { fn: (net) => Number(net) * 0.19, args: [1, 1], returns: 'number' },
    },
  }),
];

/**
 * Functions of your own go in the `functions` option:
 * `formulas({ functions: { VAT: { fn: (net) => Number(net) * 0.19, args: [1, 1] } } })`.
 * Names are case-insensitive.
 */
export const CustomFunctions: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 300px"
      .columns=${
        [
          ...dataColumns.slice(0, 3),
          { id: 'net', header: 'Net', formula: '[Unit price] * [Quantity]', width: 100 },
          { id: 'vat', header: 'VAT', formula: 'ROUND(vat([Net]), 2)', width: 100 },
        ] satisfies ColumnDef<Item>[]
      }
      .data=${items(20)}
      .plugins=${vatPlugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await waitFor(() => expect(textOf(table, 2, 'net')).toBe('112'));
    await expect(textOf(table, 2, 'vat')).toBe('21.28');
  },
};

// Formulas first: the header menu wraps headers, and formulas name columns by their header.
const menuPlugins = [formulas<Item>(), headerMenu<Item>()];

/**
 * With the column menu, list `formulas()` first: `[formulas(), headerMenu()]`.
 * Formula columns get the menu like any other.
 */
export const WithHeaderMenu: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px"
      .columns=${columns}
      .data=${data}
      .plugins=${menuPlugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await waitFor(() => expect(textOf(table, 1, 'gross')).toBe('25.32'));
    const button = headerOf(table, 'total')
      .querySelector('slot')
      ?.assignedElements()[0]
      ?.querySelector<HTMLElement>('.argus-header-menu-button');
    if (!button) throw new Error('no menu button');
    await userEvent.click(button);
    const menu = await waitFor(() => {
      const open = table.querySelector<HTMLElement>('.argus-header-menu:popover-open');
      if (!open) throw new Error('menu not open');
      return open;
    });
    const sortDown = [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find(
      (i) => i.textContent.trim() === 'Sort descending',
    );
    if (!sortDown) throw new Error('no Sort descending');
    await userEvent.click(sortDown);
    await waitFor(() => expect(table.sorting).toEqual([{ id: 'total', desc: true }]));
  },
};

const editPlugins = [formulas<Item>({ editing: 'edit' }), headerMenu<Item>()];

/** Applies what the formula editor proposes: the app owns `columns`. */
function applyProposal(event: CustomEvent<{ columns: ColumnDef[] }>) {
  (event.currentTarget as ArgusTable<Item>).columns = event.detail.columns;
}

async function menuItem(table: ArgusTable<Item>, columnId: string, label: string) {
  const button = headerOf(table, columnId)
    .querySelector('slot')
    ?.assignedElements()[0]
    ?.querySelector<HTMLElement>('.argus-header-menu-button');
  if (!button) throw new Error(`no menu button on ${columnId}`);
  await userEvent.click(button);
  return waitFor(() => {
    const found = [
      ...table.querySelectorAll<HTMLElement>('.argus-header-menu:popover-open [role="menuitem"]'),
    ].find((i) => i.textContent.trim().startsWith(label));
    if (!found) throw new Error(`no item ${label}`);
    return found;
  });
}

async function editorOf(table: ArgusTable<Item>): Promise<HTMLDialogElement> {
  // The editor loads on first use: give the import time.
  return waitFor(
    () => {
      const dialog = table.querySelector<HTMLDialogElement>('dialog.argus-formula-editor');
      if (!dialog?.open) throw new Error('editor not open');
      return dialog;
    },
    { timeout: 5000 },
  );
}

/**
 * With `formulas({ editing: 'edit' })` and the column menu, users add, edit,
 * rename and delete formula columns. The editor colours the formula, suggests
 * columns after `[` and functions by name, shows the arguments of the function
 * the cursor is in, and previews the first five rows. The table doesn't change
 * its columns itself: the plugin fires `argus-formula-column-add`, `-change`
 * and `-remove`, and the app sets `columns` to `event.detail.columns`.
 */
export const Editing: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px"
      .columns=${columns}
      .data=${data}
      .plugins=${editPlugins}
      @argus-formula-column-add=${applyProposal}
      @argus-formula-column-change=${applyProposal}
      @argus-formula-column-remove=${applyProposal}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await userEvent.click(await menuItem(table, 'gross', 'Add formula column…'));
    const dialog = await editorOf(table);
    await userEvent.keyboard('Net');
    await userEvent.tab();
    // `[[` types a [ (a single one starts a key name).
    await userEvent.keyboard('ROUND([[Gr');
    await waitFor(() =>
      expect(dialog.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain(
        'Gross',
      ),
    );
    await userEvent.keyboard('{Enter} / 1.19, 2)');
    await waitFor(() =>
      expect(dialog.querySelector('.argus-formula-preview tbody tr')).not.toBeNull(),
    );
    await userEvent.click(
      [...dialog.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add column') ??
        dialog,
    );
    await waitFor(() => expect(table.columns.map((c) => c.id)).toContain('net'));
    await waitFor(() => expect(textOf(table, 1, 'net')).toBe('21.28'));
  },
};

/**
 * The editor open on a formula column, as the menu's "Edit formula…" opens it.
 * Theme tokens set on the table style it: `--argus-dialog-accent` here.
 */
export const EditorOpen: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px; --argus-dialog-accent: #2f5bd3; --argus-dialog-accent-fg: #fff"
      .columns=${columns}
      .data=${data}
      .plugins=${editPlugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await userEvent.click(await menuItem(table, 'gross', 'Edit formula…'));
    const dialog = await editorOf(table);
    await waitFor(() =>
      expect(dialog.querySelector('.argus-formula-mirror')?.textContent).toBe(
        'ROUND([Total] * 1.19, 2)',
      ),
    );
  },
};
