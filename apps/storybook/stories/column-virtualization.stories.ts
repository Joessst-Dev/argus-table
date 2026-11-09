import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ColumnDef } from 'argus-table';
import 'argus-table';

const COLUMNS = 500;

interface Row {
  id: number;
  name: string;
}

const data: Row[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i + 1,
  name: `Item ${String(i + 1)}`,
}));

const columns: ColumnDef<Row>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start' },
  { id: 'name', header: 'Name', accessor: 'name', width: 120, pin: 'start' },
  ...Array.from({ length: COLUMNS }, (_, j): ColumnDef<Row> => ({
    id: `c${String(j + 1)}`,
    header: `Col ${String(j + 1)}`,
    // Computed per cell: nothing is stored for the 5M cells.
    accessor: (row) => (row.id * 31 + j * 17) % 1000,
    width: 90,
    align: 'end',
  })),
  {
    id: 'actions',
    header: '',
    width: 80,
    pin: 'end',
    cell: () => html`<button type="button" tabindex="-1">Open</button>`,
  },
];

interface Args {
  virtualizeColumns: boolean;
  dir: 'ltr' | 'rtl';
}

const meta = {
  title: 'Features/Column virtualization',
  component: 'argus-table',
  args: { virtualizeColumns: true, dir: 'ltr' },
  argTypes: {
    virtualizeColumns: {
      control: 'boolean',
      description: 'Off, all 503 columns render in every row',
    },
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
  },
  render: ({ virtualizeColumns, dir }) =>
    html`<argus-table
      aria-label="Wide table"
      dir=${dir}
      style="block-size: 420px"
      ?virtualize-columns=${virtualizeColumns}
      .columns=${columns}
      .data=${data}
    ></argus-table>`,
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

const headers = (table: Element | null) => [
  ...(table?.shadowRoot?.querySelectorAll<HTMLElement>('[role="columnheader"]') ?? []),
];

/**
 * `virtualize-columns` renders the scrolling columns in view, plus two on each
 * side; the pinned ones always render. Keyboard focus reaches every column:
 * End jumps to the last one and the table scrolls it into view.
 */
export const WideTable: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    // A handful of the 503 columns.
    await expect(headers(table).length).toBeLessThan(30);
    const root = table?.shadowRoot;
    const cell = root?.querySelector<HTMLElement>('[part~="body"] [data-col="name"]');
    if (!root || !cell) throw new Error('table not rendered');
    await userEvent.click(cell);
    await userEvent.keyboard('{End}{ArrowLeft}');
    await waitFor(async () => {
      const active = root.activeElement as HTMLElement | null;
      await expect(active?.dataset.col).toBe(`c${String(COLUMNS)}`);
      const header = root.querySelector('[role="columnheader"][data-col="c500"]');
      const scroller = root.querySelector('[part~="table"]');
      const right = scroller?.getBoundingClientRect().right ?? 0;
      await expect(header?.getBoundingClientRect().right).toBeLessThanOrEqual(right);
    });
    await expect(headers(table).length).toBeLessThan(30);
    // The columns stay on one line: none wraps below the others.
    const row = root.querySelector('[part~="header-row"]')?.getBoundingClientRect();
    const tops = headers(table).map((h) => h.getBoundingClientRect().top);
    await expect(tops.every((top) => Math.abs(top - (row?.top ?? 0)) < 1)).toBe(true);
  },
};

/** In RTL the columns scroll the other way; the window follows. */
export const RightToLeft: Story = {
  args: { dir: 'rtl' },
};
