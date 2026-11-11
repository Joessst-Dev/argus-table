import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import 'argus-table';
import type { ArgusTable, ColumnDef, ColumnGroup } from 'argus-table';
import { orders, type Order } from './data.js';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 160, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 110 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

const groups: ColumnGroup[] = [
  { id: 'who', header: 'Who', columns: ['customer', 'city'] },
  { id: 'state', header: 'Order state', columns: ['status', 'total'] },
];

const table = (canvas: HTMLElement) => {
  const el = canvas.querySelector('argus-table');
  if (!el) throw new Error('no table');
  return el;
};
const groupCell = (el: ArgusTable, key: string) => {
  const cell = el.shadowRoot?.querySelector<HTMLElement>(`[data-group-key="${key}"]`);
  if (!cell) throw new Error(`no group ${key}`);
  return cell;
};
const header = (el: ArgusTable, id: string) => {
  const cell = el.shadowRoot?.querySelector<HTMLElement>(`[part~="header-cell"][data-col="${id}"]`);
  if (!cell) throw new Error(`no header ${id}`);
  return cell;
};
const order = (el: ArgusTable) =>
  [...(el.shadowRoot?.querySelectorAll<HTMLElement>('[part~="header-cell"]') ?? [])]
    .sort((a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex))
    .map((h) => h.dataset.col);
const focusKey = (el: ArgusTable) => {
  const active = el.shadowRoot?.activeElement as HTMLElement | null | undefined;
  return active?.dataset.groupKey ?? active?.dataset.col;
};

const meta = {
  title: 'Features/Column groups',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

/**
 * `columnGroups` puts headers over several columns: `{ id, header, columns }`,
 * where `columns` lists column ids. `columns` stays a flat list. Columns without
 * a group sit under an empty filler, and the group headers take the header's
 * tokens and the parts `header-group-row`, `header-group-cell` and
 * `header-group-filler`.
 */
export const Basic: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 360px"
      aria-label="Orders by group"
      .columns=${columns}
      .columnGroups=${groups}
      .data=${orders(200)}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const el = table(canvasElement);
    await el.updateComplete;
    const who = groupCell(el, 'g:center:who');
    await expect(who.getAttribute('role')).toBe('columnheader');
    await expect(who.getAttribute('aria-colspan')).toBe('2');
    await expect(who.getBoundingClientRect().width).toBeCloseTo(280, 0);
  },
};

/**
 * Groups nest, and each level adds a header row. Here "Shipping" sits inside
 * "Who", over City alone: three header rows. Groups are top-aligned, so a
 * column with fewer groups over it has fillers below its groups.
 */
export const Nested: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 360px"
      aria-label="Orders with nested groups"
      .columns=${columns}
      .columnGroups=${[
        {
          id: 'who',
          header: 'Who',
          columns: ['customer', { id: 'shipping', header: 'Shipping', columns: ['city'] }],
        },
        { id: 'state', header: 'Order state', columns: ['status', 'total'] },
      ]}
      .data=${orders(200)}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const el = table(canvasElement);
    await el.updateComplete;
    await expect(el.shadowRoot?.querySelectorAll('[part~="header-group-row"]')).toHaveLength(2);
    await expect(
      el.shadowRoot?.querySelector('[part~="header-row"]')?.getAttribute('aria-rowindex'),
    ).toBe('3');
  },
};

/**
 * `<argus-column-group>` writes the groups as markup, around `<argus-column>`s
 * and other groups. A non-empty `columnGroups` property wins over them.
 */
export const Declarative: Story = {
  render: () =>
    html`<argus-table style="block-size: 300px" aria-label="Declarative groups" .data=${orders(50)}>
      <argus-column column-id="id" header="Order" accessor="id" width="100"></argus-column>
      <argus-column-group group-id="who" header="Who">
        <argus-column column-id="customer" header="Customer" accessor="customer"></argus-column>
        <argus-column column-id="city" header="City" accessor="city" width="120"></argus-column>
      </argus-column-group>
      <argus-column column-id="total" header="Total" accessor="total" align="end"></argus-column>
    </argus-table>`,
  play: async ({ canvasElement }) => {
    const el = table(canvasElement);
    await el.updateComplete;
    const slot = groupCell(el, 'g:center:who').querySelector('slot');
    await expect(slot?.assignedElements()[0]?.textContent).toBe('Who');
    await expect(order(el)).toEqual(['id', 'customer', 'city', 'total']);
  },
};

/**
 * A group whose columns are pinned to different sides shows on each side: here
 * Order is pinned to the start, so "Ids" has a sticky part over it and a
 * scrolling part over Reference. Scroll sideways: the pinned part stays.
 */
export const PinnedSplit: Story = {
  render: () => {
    const wide: ColumnDef<Order>[] = [
      ...columns.map((c) => (c.id === 'id' ? { ...c, pin: 'start' as const } : c)),
      { id: 'ref', header: 'Reference', accessor: (o) => `R-${o.id}`, width: 400 },
    ];
    return html`<argus-table
      style="block-size: 300px; inline-size: 600px"
      aria-label="Orders with a pinned group"
      .columns=${wide}
      .columnGroups=${[{ id: 'ids', header: 'Ids', columns: ['id', 'ref'] }, ...groups]}
      .data=${orders(50)}
    ></argus-table>`;
  },
  play: async ({ canvasElement }) => {
    const el = table(canvasElement);
    await el.updateComplete;
    await expect(groupCell(el, 'g:start:ids').dataset.pin).toBe('start');
    await expect(groupCell(el, 'g:center:ids').getAttribute('aria-colspan')).toBe('1');
  },
};

/**
 * A group's columns stay together. Drag a group header to move the whole group,
 * or press Alt+Shift+Arrow on it; a column moves only within its group.
 * `argus-column-reorder` then carries the `groupId`.
 */
export const Reorder: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 300px"
      aria-label="Reorder groups"
      .columns=${columns}
      .columnGroups=${groups}
      .data=${orders(50)}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const el = table(canvasElement);
    await el.updateComplete;
    const moves: string[] = [];
    el.addEventListener('argus-column-reorder', (e) => {
      moves.push(e.detail.groupId ?? e.detail.columnId);
    });
    groupCell(el, 'g:center:state').focus();
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
    await waitFor(() => expect(order(el)).toEqual(['id', 'status', 'total', 'customer', 'city']));
    await expect(moves).toEqual(['state']);
    // A column can't leave its group.
    header(el, 'customer').focus();
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
    await el.updateComplete;
    await expect(order(el)).toEqual(['id', 'status', 'total', 'customer', 'city']);
  },
};

/**
 * Drag the handle on a group's edge, or press Alt+Arrow on a focused group, to
 * resize the group: the change is spread over its resizable columns in proportion
 * to their widths. A double-click fits them to their content. `reorderable: false`
 * keeps a group in place ("Who" here); its columns still move within it.
 */
export const ResizeAndFixed: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 300px"
      aria-label="Resize groups"
      .columns=${columns}
      .columnGroups=${[{ ...groups[0], reorderable: false }, groups[1]]}
      .data=${orders(50)}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const el = table(canvasElement);
    await el.updateComplete;
    await expect(groupCell(el, 'g:center:who').dataset.moveGroup).toBeUndefined();
    groupCell(el, 'g:center:state').focus();
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    await waitFor(() => expect(Object.keys(el.columnSizing).sort()).toEqual(['status', 'total']));
  },
};

/**
 * Group headers are part of the keyboard navigation: ArrowUp from a column
 * header goes to its group, ArrowDown back to the column, Left and Right move
 * between the groups of a row, and PageDown goes into the body. Groups don't
 * sort.
 */
export const Keyboard: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 300px"
      aria-label="Keyboard through groups"
      .columns=${columns}
      .columnGroups=${groups}
      .data=${orders(50)}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const el = table(canvasElement);
    await el.updateComplete;
    header(el, 'city').focus();
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(focusKey(el)).toBe('g:center:who'));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(focusKey(el)).toBe('g:center:state'));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(focusKey(el)).toBe('status'));
  },
};

/**
 * With `virtualizeColumns`, every group header still renders, spanning all its
 * columns. A wide group's label stays in view while its columns scroll past.
 */
export const WideGroup: Story = {
  render: () => {
    const many: ColumnDef<Order>[] = Array.from({ length: 80 }, (_, i) => ({
      id: `m${String(i)}`,
      header: `Month ${String(i + 1)}`,
      accessor: (o) => Math.round(o.total * ((i % 7) + 1)),
      width: 110,
      align: 'end',
    }));
    return html`<argus-table
      style="block-size: 300px"
      aria-label="Orders by month"
      virtualize-columns
      .columns=${[columns[0], columns[1], ...many] as ColumnDef<Order>[]}
      .columnGroups=${[
        { id: 'y1', header: 'First year', columns: many.slice(0, 40).map((c) => c.id) },
        { id: 'y2', header: 'Second year', columns: many.slice(40).map((c) => c.id) },
      ]}
      .data=${orders(100)}
    ></argus-table>`;
  },
  play: async ({ canvasElement }) => {
    const el = table(canvasElement);
    await el.updateComplete;
    const scroller = el.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
    if (!scroller) throw new Error('no scroller');
    scroller.scrollLeft = 2000;
    await waitFor(async () => {
      const label = groupCell(el, 'g:center:y1').querySelector('.group-label');
      const box = scroller.getBoundingClientRect();
      const r = label?.getBoundingClientRect();
      await expect(r && r.left >= box.left && r.right <= box.right).toBe(true);
    });
  },
};
