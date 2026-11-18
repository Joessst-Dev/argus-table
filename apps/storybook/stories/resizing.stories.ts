import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import type {
  ArgusTable,
  ColumnDef,
  ColumnSizingChangeDetail,
  ColumnSizingState,
} from 'argus-table';
import 'argus-table';

interface Task {
  id: number;
  title: string;
  owner: string;
  estimate: number;
}

const owners = ['Ada', 'Grace', 'Linus', 'Barbara', 'Ken'];
const data: Task[] = Array.from({ length: 5_000 }, (_, i) => ({
  id: i + 1,
  title: `Task ${String(i + 1)}: ${['Plan', 'Build', 'Review', 'Ship'][i % 4] ?? ''} the thing`,
  owner: owners[i % owners.length] ?? '',
  estimate: (i * 7) % 40,
}));

const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', resizable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120, minWidth: 80, maxWidth: 240 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

const meta = {
  title: 'Features/Resizing',
  component: 'argus-table',
  render: () =>
    html`<argus-table style="block-size: 420px" .columns=${columns} .data=${data}></argus-table>`,
} satisfies Meta;

export default meta;
type Story = StoryObj;

/**
 * Drag the handle on a header's inline-end edge, or focus a header and press
 * Alt+Arrow to resize by 10 px. Widths stay within `minWidth` and `maxWidth`, a
 * dragged flex column becomes fixed, and `resizable: false` (the # column) has
 * no handle.
 */
export const Uncontrolled: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    if (!table) return;
    await table.updateComplete;
    const handles = table.shadowRoot?.querySelectorAll('[part~="resize-handle"]') ?? [];
    await expect(handles.length).toBe(3);
  },
};

const STORAGE_KEY = 'argus-table:resizing-story';

function savedWidths(): ColumnSizingState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as ColumnSizingState;
  } catch {
    return {};
  }
}

/**
 * Controlled: the host owns `columnSizing`, applies each proposal from
 * `argus-column-sizing-change` and saves it, so widths survive a reload.
 */
export const ControlledAndSaved: Story = {
  render: () => {
    const onResize = (event: CustomEvent<ColumnSizingChangeDetail>) => {
      const table = event.target as ArgusTable<Task>;
      table.columnSizing = event.detail.columnSizing;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(event.detail.columnSizing));
      } catch {
        // Storage can be unavailable (private mode); the table still works.
      }
    };
    return html`<argus-table
      style="block-size: 420px"
      .columns=${columns}
      .data=${data}
      .columnSizing=${savedWidths()}
      @argus-column-sizing-change=${onResize}
    ></argus-table>`;
  },
};

const fixedColumns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', maxWidth: 70 },
  { id: 'title', header: 'Title', accessor: 'title', width: 200 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

/**
 * `stretchColumns` (`stretch-columns`): the columns fill the table's width. When
 * they're narrower than the table they stretch in proportion to their widths, up
 * to their `maxWidth` (the # column stays at 70 px); when the table gets
 * narrower they shrink back to their own widths and the table scrolls. A column
 * you resize keeps its width and the others share the space it frees.
 * `columnSizing` keeps own widths, never stretched ones.
 */
export const StretchColumns: Story = {
  render: () =>
    html`<argus-table
      stretch-columns
      style="block-size: 420px"
      .columns=${fixedColumns}
      .data=${data}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<ArgusTable<Task>>('argus-table');
    if (!table) throw new Error('no <argus-table>');
    const scroller = table.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
    const total = () =>
      [
        ...(table.shadowRoot?.querySelectorAll<HTMLElement>('[role="columnheader"][data-col]') ??
          []),
      ].reduce((sum, cell) => sum + cell.getBoundingClientRect().width, 0);
    await waitFor(() => expect(Math.abs(total() - (scroller?.clientWidth ?? 0))).toBeLessThan(2));
    // Narrower than the columns' own widths: they keep them and the table scrolls.
    table.style.inlineSize = '300px';
    await waitFor(() =>
      expect(scroller?.scrollWidth ?? 0).toBeGreaterThan(scroller?.clientWidth ?? 0),
    );
    table.style.inlineSize = '';
  },
};
