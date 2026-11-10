import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, render } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type {
  ArgusTable,
  ColumnDef,
  ColumnPin,
  ColumnPinningState,
  ColumnVisibilityState,
} from 'argus-table';
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
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start', hideable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: 180 },
  ...Array.from({ length: 8 }, (_, j): ColumnDef<Task> => ({
    id: `q${String(j + 1)}`,
    header: `Metric ${String(j + 1)}`,
    accessor: (row) => (row.id * (j + 3)) % 997,
    width: 120,
    align: 'end',
  })),
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 110 },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, hidden: true },
];

const meta = {
  title: 'Features/Column pinning and visibility',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Column ids in the order the headers show. */
function headerOrder(table: HTMLElement): (string | undefined)[] {
  const headers = [
    ...(table.shadowRoot?.querySelectorAll<HTMLElement>('[role="columnheader"]') ?? []),
  ];
  return headers
    .sort((a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex))
    .map((h) => h.dataset.col);
}

const label = (column: ColumnDef<Task>) =>
  typeof column.header === 'string' ? column.header : column.id;

/**
 * `columnPinning` pins and unpins columns at runtime, over their own `pin`, and
 * `columnVisibility` hides and shows them, over their own `hidden` (Status starts
 * hidden). Both are plain objects keyed by column id, so they save as JSON. The
 * controls here set the properties; the column menu (`@argus-table/header-menu`)
 * lets users do the same. A hidden column still sorts and keeps its place.
 */
export const Controls: Story = {
  render: () => {
    let pinning: ColumnPinningState = {};
    let visibility: ColumnVisibilityState = {};
    const table = () => document.querySelector<ArgusTable<Task>>('#pin-hide-table');
    const shown = (c: ColumnDef<Task>) => visibility[c.id] ?? !c.hidden;
    const pinOf = (c: ColumnDef<Task>) => {
      const pin = pinning[c.id];
      return pin === undefined ? (c.pin ?? 'none') : pin === false ? 'none' : pin;
    };
    const update = () => {
      const el = table();
      if (el) {
        el.columnPinning = pinning;
        el.columnVisibility = visibility;
      }
      const controls = document.querySelector<HTMLElement>('#pin-hide-controls');
      if (controls) render(controlsOf(), controls);
    };
    const onShow = (column: ColumnDef<Task>, event: Event) => {
      visibility = { ...visibility, [column.id]: (event.target as HTMLInputElement).checked };
      update();
    };
    const onPin = (column: ColumnDef<Task>, event: Event) => {
      const value = (event.target as HTMLSelectElement).value;
      const pin: ColumnPin | false = value === 'start' || value === 'end' ? value : false;
      pinning = { ...pinning, [column.id]: pin };
      update();
    };
    const controlsOf = () =>
      html`${columns.map(
        (c) =>
          html`<fieldset style="display: inline-flex; gap: 6px; align-items: center">
            <legend>${label(c)}</legend>
            <label
              ><input
                type="checkbox"
                .checked=${shown(c)}
                ?disabled=${c.hideable === false}
                @change=${(e: Event) => {
                  onShow(c, e);
                }}
              />
              Shown</label
            >
            <label
              >Pin
              <select
                .value=${pinOf(c)}
                @change=${(e: Event) => {
                  onPin(c, e);
                }}
              >
                <option value="none">none</option>
                <option value="start">start</option>
                <option value="end">end</option>
              </select></label
            >
          </fieldset>`,
      )}`;
    return html`<div id="pin-hide-controls" style="margin-block-end: 12px; font: 13px sans-serif">
        ${controlsOf()}
      </div>
      <argus-table
        id="pin-hide-table"
        aria-label="Tasks"
        style="block-size: 360px; inline-size: 760px"
        .columns=${columns}
        .data=${data}
      ></argus-table>`;
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<ArgusTable<Task>>('argus-table');
    if (!table) return;
    await table.updateComplete;
    await expect(headerOrder(table)).not.toContain('status');

    const ownerPin = canvasElement.querySelectorAll('select')[10];
    if (!ownerPin) throw new Error('no select for Owner');
    await userEvent.selectOptions(ownerPin, 'start');
    await waitFor(() => expect(headerOrder(table).slice(0, 2)).toEqual(['id', 'owner']));
    const titleShown = canvasElement.querySelectorAll<HTMLInputElement>('input')[1];
    if (!titleShown) throw new Error('no checkbox for Title');
    await userEvent.click(titleShown);
    await waitFor(() => expect(headerOrder(table)).not.toContain('title'));

    // Back to how the story started.
    await userEvent.click(titleShown);
    await userEvent.selectOptions(ownerPin, 'none');
    await waitFor(() => expect(headerOrder(table).slice(0, 3)).toEqual(['id', 'title', 'q1']));
  },
};

/**
 * With `<argus-column>` children, the standard `hidden` attribute hides a column,
 * and `pinnable="false"` or `hideable="false"` keep users from pinning or hiding it.
 */
export const Children: Story = {
  render: () =>
    html`<argus-table aria-label="Tasks" style="block-size: 360px" .data=${data}>
      <argus-column
        column-id="id"
        header="#"
        accessor="id"
        width="70"
        pin="start"
        hideable="false"
      ></argus-column>
      <argus-column column-id="title" header="Title" accessor="title" width="2fr"></argus-column>
      <argus-column column-id="owner" header="Owner" accessor="owner" hidden></argus-column>
      <argus-column column-id="status" header="Status" accessor="status"></argus-column>
    </argus-table>`,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<ArgusTable<Task>>('argus-table');
    if (!table) return;
    await table.updateComplete;
    await waitFor(() => expect(headerOrder(table)).toEqual(['id', 'title', 'status']));
    const owner = canvasElement.querySelector<HTMLElement>('argus-column[column-id="owner"]');
    if (!owner) return;
    owner.hidden = false;
    await waitFor(() => expect(headerOrder(table)).toEqual(['id', 'title', 'owner', 'status']));
    owner.hidden = true;
    await waitFor(() => expect(headerOrder(table)).toEqual(['id', 'title', 'status']));
  },
};
