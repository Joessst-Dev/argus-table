import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, ColumnDef, DataSource, GroupData } from 'argus-table';
import 'argus-table';

const meta = {
  title: 'Features/Row grouping',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

interface Sale {
  id: string;
  customer: string;
  region: string;
  status: string;
  amount: number;
}

const sales: Sale[] = [
  { id: 's1', customer: 'Aurora Labs', region: 'Europe', status: 'Won', amount: 18_400 },
  { id: 's2', customer: 'Bluebird Inc.', region: 'Americas', status: 'Open', amount: 7_250 },
  { id: 's3', customer: 'Cedar & Co', region: 'Europe', status: 'Open', amount: 4_900 },
  { id: 's4', customer: 'Delta Freight', region: 'Asia Pacific', status: 'Won', amount: 22_100 },
  { id: 's5', customer: 'Ember Studio', region: 'Americas', status: 'Lost', amount: 3_600 },
  { id: 's6', customer: 'Fjord Systems', region: 'Europe', status: 'Won', amount: 9_800 },
  { id: 's7', customer: 'Granite Bank', region: 'Americas', status: 'Won', amount: 31_000 },
  { id: 's8', customer: 'Harbor Health', region: 'Asia Pacific', status: 'Open', amount: 12_300 },
];

const euros = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });
const money = (amount: unknown) => (typeof amount === 'number' ? euros.format(amount) : '');

const columns: ColumnDef<Sale>[] = [
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'region', header: 'Region', accessor: 'region', width: 140, groupable: true },
  { id: 'status', header: 'Status', accessor: 'status', width: 110, groupable: true },
  {
    id: 'amount',
    header: 'Amount',
    accessor: 'amount',
    width: 140,
    align: 'end',
    sortable: true,
    aggregate: 'sum',
    cell: (sale) => money(sale.amount),
    groupCell: ({ total }) => money(total),
  },
];
const idOf = (sale: Sale) => sale.id;

/** The table in a story, once it has rendered. */
async function tableIn(canvasElement: HTMLElement): Promise<ArgusTable> {
  const table = canvasElement.querySelector<ArgusTable>('argus-table');
  if (!table) throw new Error('no <argus-table>');
  await table.updateComplete;
  return table;
}

/** A cell of the body row at an `aria-rowindex` (the header is 1). */
function cellAt(table: ArgusTable, ariaRowIndex: number, col: string): HTMLElement {
  const cell = table.shadowRoot?.querySelector<HTMLElement>(
    `[part~="body"] > [aria-rowindex="${String(ariaRowIndex)}"] > [data-col="${col}"]`,
  );
  if (!cell) throw new Error(`no ${col} cell in row ${String(ariaRowIndex)}`);
  return cell;
}

/** The text a body cell shows: its slotted content, then a group row's count. */
const textAt = (table: ArgusTable, ariaRowIndex: number, col: string) =>
  cellAt(table, ariaRowIndex, col)
    .querySelector('slot')
    ?.assignedNodes({ flatten: true })
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();

/**
 * Rows grouped by region (`grouping`, over columns with `groupable: true`):
 * one group row per region with its value and number of rows, and the sum
 * of its amounts (`aggregate: 'sum'`, formatted by the column's `groupCell`).
 * Groups open and close like tree rows: the toggle, ArrowRight and
 * ArrowLeft on the first column, or Enter on any of their cells. Sorting by
 * Amount orders the groups by their totals, and the rows within them.
 */
export const ByRegion: Story = {
  render: () =>
    html`<argus-table
      aria-label="Sales"
      style="block-size: 420px"
      .columns=${columns}
      .data=${sales}
      .getRowId=${idOf}
      .grouping=${['region']}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await expect(table.getAttribute('role')).toBe('treegrid');
    await expect(textAt(table, 2, 'customer')).toBe('Americas');
    await expect(textAt(table, 2, 'amount')).toBe('€41,850.00');
    await expect(
      cellAt(table, 2, 'customer').querySelector('[part~="group-count"]')?.textContent,
    ).toBe('(3)');
    // Enter on a group row's cell opens it.
    cellAt(table, 3, 'amount').focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(table.treeExpanded).toEqual(['\u0000g["region","Asia Pacific"]']));
    await expect(textAt(table, 4, 'customer')).toBe('Delta Freight');
  },
};

/**
 * Two levels: by region, then by status within each region. Europe starts
 * open; its statuses are groups of their own, each with its count and total.
 */
export const RegionAndStatus: Story = {
  render: () =>
    html`<argus-table
      aria-label="Sales"
      style="block-size: 420px"
      .columns=${columns}
      .data=${sales}
      .getRowId=${idOf}
      .grouping=${['region', 'status']}
      .treeExpanded=${['\u0000g["region","Europe"]']}
    ></argus-table>`,
};

/**
 * With checkboxes in `multi` mode: a group row's checkbox ticks every row in
 * the group (part-ticked when some are), never the group itself.
 */
export const Selection: Story = {
  render: () =>
    html`<argus-table
      aria-label="Sales"
      style="block-size: 420px"
      selection-mode="multi"
      selection-checkboxes
      .columns=${columns}
      .data=${sales}
      .getRowId=${idOf}
      .grouping=${['region']}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const box = cellAt(table, 4, 'customer')
      .closest('[role="row"]')
      ?.querySelector<HTMLInputElement>('[part~="selection-checkbox"]');
    if (!box) throw new Error('no checkbox');
    await userEvent.click(box);
    await waitFor(() => expect([...table.selection].sort()).toEqual(['s1', 's3', 's6']));
  },
};

/** A pretend server: groups `sales` by the request's grouping and path, and sums the amounts. */
const salesServer: DataSource<Sale> = {
  pageSize: 50,
  getRows({ start, end, grouping = [], groupPath = [] }) {
    const rows = sales.filter((sale) =>
      groupPath.every(({ columnId, value }) => sale[columnId as keyof Sale] === value),
    );
    if (groupPath.length === grouping.length) {
      return Promise.resolve({ rows: rows.slice(start, end), total: rows.length });
    }
    const column = grouping[groupPath.length] as keyof Sale;
    const values = [...new Set(rows.map((sale) => sale[column]))].sort();
    const groups: GroupData[] = values.map((value) => {
      const inGroup = rows.filter((sale) => sale[column] === value);
      const amount = inGroup.reduce((sum, sale) => sum + sale.amount, 0);
      return { value, count: inGroup.length, totals: { amount } };
    });
    return Promise.resolve({ rows: [], groups: groups.slice(start, end), total: groups.length });
  },
};

/**
 * Grouped on the server (`dataSource`): `getRows` gets `grouping` and the
 * `groupPath` of the level it fills, and answers with groups (their `count`
 * and `totals`) or a group's rows. Each level loads page by page.
 */
export const Server: Story = {
  render: () =>
    html`<argus-table
      aria-label="Sales on the server"
      style="block-size: 420px"
      .columns=${columns}
      .getRowId=${idOf}
      .grouping=${['region']}
      .dataSource=${salesServer}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await waitFor(() => expect(textAt(table, 2, 'customer')).toBe('Americas'));
    await expect(textAt(table, 2, 'amount')).toBe('€41,850.00');
    cellAt(table, 4, 'amount').focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(textAt(table, 5, 'customer')).toBe('Aurora Labs'));
  },
};
