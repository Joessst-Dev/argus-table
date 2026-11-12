import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, ColumnDef, ColumnOrderState, ColumnOrderChangeDetail } from 'argus-table';
import 'argus-table';

interface Task {
  id: number;
  title: string;
  owner: string;
  status: string;
  estimate: number;
}

const owners = ['Ada', 'Grace', 'Linus', 'Barbara', 'Ken'];
const statuses = ['Open', 'In progress', 'Review', 'Done'];
const data: Task[] = Array.from({ length: 5_000 }, (_, i) => ({
  id: i + 1,
  title: `Task ${String(i + 1)}`,
  owner: owners[i % owners.length] ?? '',
  status: statuses[i % statuses.length] ?? '',
  estimate: (i * 7) % 40,
}));

const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', reorderable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 130 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

const meta = {
  title: 'Features/Column reorder',
  component: 'argus-table',
  render: () =>
    html`<argus-table style="block-size: 420px" .columns=${columns} .data=${data}></argus-table>`,
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Column ids in the order the headers show. */
function headerOrder(table: ArgusTable): (string | undefined)[] {
  const headers = [
    ...(table.shadowRoot?.querySelectorAll<HTMLElement>('[role="columnheader"]') ?? []),
  ];
  return headers
    .sort((a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex))
    .map((h) => h.dataset.col);
}

/**
 * Drag a header to move its column: a line marks where it will land, and Escape
 * cancels. Or focus a header and press Alt+Shift+Arrow to move it one place;
 * screen readers hear where it went. `reorderable: false` (the # column) can't be
 * picked up, though other columns can move past it.
 */
export const Uncontrolled: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    if (!table) return;
    await table.updateComplete;
    const owner = table.shadowRoot?.querySelector<HTMLElement>('[data-col="owner"]');
    owner?.focus();
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
    await waitFor(() =>
      expect(headerOrder(table)).toEqual(['id', 'owner', 'title', 'status', 'estimate']),
    );
    await expect(table.shadowRoot?.activeElement?.getAttribute('data-col')).toBe('owner');
    // Put it back, so the story looks as it started.
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
    await waitFor(() =>
      expect(headerOrder(table)).toEqual(['id', 'title', 'owner', 'status', 'estimate']),
    );
  },
};

const STORAGE_KEY = 'argus-table:column-reorder-story';

function savedOrder(): ColumnOrderState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ColumnOrderState;
  } catch {
    return [];
  }
}

/**
 * Controlled: the host owns `columnOrder`, applies each proposal from
 * `argus-column-order-change` and saves it, so the order survives a reload.
 */
export const ControlledAndSaved: Story = {
  render: () => {
    const onReorder = (event: CustomEvent<ColumnOrderChangeDetail>) => {
      const table = event.target as ArgusTable<Task>;
      table.columnOrder = event.detail.columnOrder;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(event.detail.columnOrder));
      } catch {
        // Storage can be unavailable (private mode); the table still works.
      }
    };
    return html`<argus-table
      style="block-size: 420px"
      .columns=${columns}
      .data=${data}
      .columnOrder=${savedOrder()}
      @argus-column-order-change=${onReorder}
    ></argus-table>`;
  },
};

const wide: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start' },
  { id: 'title', header: 'Title', accessor: 'title', width: 140, pin: 'start' },
  ...Array.from({ length: 10 }, (_, j): ColumnDef<Task> => ({
    id: `q${String(j + 1)}`,
    header: `Metric ${String(j + 1)}`,
    accessor: (row) => (row.id * (j + 3)) % 997,
    width: 120,
    align: 'end',
  })),
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 110, pin: 'end' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, pin: 'end' },
];

/**
 * Pinned columns move only among themselves, and scrolling columns among
 * theirs: a drag never pins or unpins a column. Drag a scrolling column toward
 * the table's edge and the table scrolls with it.
 */
export const PinnedGroups: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px; inline-size: 760px"
      .columns=${wide}
      .data=${data}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    if (!table) return;
    await table.updateComplete;
    const title = table.shadowRoot?.querySelector<HTMLElement>('[data-col="title"]');
    title?.focus();
    // The last of the start-pinned columns: one step on would leave the group.
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
    await expect(headerOrder(table).slice(0, 3)).toEqual(['id', 'title', 'q1']);
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
    await waitFor(() => expect(headerOrder(table).slice(0, 2)).toEqual(['title', 'id']));
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
    await waitFor(() => expect(headerOrder(table).slice(0, 2)).toEqual(['id', 'title']));
  },
};
