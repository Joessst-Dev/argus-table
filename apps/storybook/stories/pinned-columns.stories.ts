import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import type { ColumnDef } from 'argus-table';
import 'argus-table';

interface Row {
  id: number;
  name: string;
  values: number[];
}

const data: Row[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i + 1,
  name: `Item ${String(i + 1)}`,
  values: Array.from({ length: 12 }, (_, j) => (i * 31 + j * 17) % 1000),
}));

const columns: ColumnDef<Row>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start' },
  { id: 'name', header: 'Name', accessor: 'name', width: 140, pin: 'start' },
  ...Array.from({ length: 12 }, (_, j): ColumnDef<Row> => ({
    id: `m${String(j + 1)}`,
    header: `Month ${String(j + 1)}`,
    accessor: (row) => row.values[j],
    width: 110,
    align: 'end',
  })),
  {
    id: 'actions',
    header: '',
    width: 80,
    pin: 'end',
    cell: () => html`<button type="button">Open</button>`,
  },
];

interface Args {
  dir: 'ltr' | 'rtl';
  shadow: string;
}

const meta = {
  title: 'Features/Pinned columns',
  component: 'argus-table',
  args: { dir: 'ltr', shadow: '' },
  argTypes: {
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
    shadow: {
      control: 'text',
      description: '`--argus-pinned-shadow`, e.g. `none` or `6px 0 8px -6px rgb(0 0 0 / .4)`',
    },
  },
  render: ({ dir, shadow }) =>
    html`<argus-table
      dir=${dir}
      style="block-size: 420px; ${shadow ? `--argus-pinned-shadow: ${shadow}` : ''}"
      .columns=${columns}
      .data=${data}
    ></argus-table>`,
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/**
 * `pin: 'start'` and `pin: 'end'` keep columns in place while the rest scroll
 * sideways. The cell next to the scrolling columns gets the `cell-pinned-edge`
 * part and the `--argus-pinned-shadow`.
 */
export const StartAndEnd: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    const row = table?.shadowRoot?.querySelector('[part~="row"]');
    await expect(row?.querySelectorAll('[part~="cell-pinned"]').length).toBe(3);
    await expect(row?.querySelectorAll('[part~="cell-pinned-edge"]').length).toBe(2);
  },
};

/** In RTL, `'start'` is the right side and `'end'` the left; the shadow mirrors with it. */
export const RightToLeft: Story = {
  args: { dir: 'rtl' },
};
