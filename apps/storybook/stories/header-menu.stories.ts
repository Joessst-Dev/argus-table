import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, SortingChangeDetail } from 'argus-table';
import 'argus-table';
import { headerMenu } from '@argus-table/header-menu';
import { orderColumns, orders, type Order } from './data.js';

const data = orders(1_000);
// One plugin instance, kept: a new one would reconnect and close an open menu.
const plugins = [headerMenu<Order>()];

const meta = {
  title: 'Add-ons/Header menu',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

async function tableIn(canvasElement: HTMLElement): Promise<ArgusTable<Order>> {
  const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
  if (!table) throw new Error('no <argus-table>');
  await table.updateComplete;
  return table;
}

function headerOf(table: ArgusTable<Order>, id: string): HTMLElement {
  const header = table.shadowRoot?.querySelector<HTMLElement>(
    `[role="columnheader"][data-col="${id}"]`,
  );
  if (!header) throw new Error(`no header ${id}`);
  return header;
}

function buttonOf(table: ArgusTable<Order>, id: string): HTMLElement {
  const content = headerOf(table, id).querySelector('slot')?.assignedElements()[0];
  const button = content?.querySelector<HTMLElement>('.argus-header-menu-button');
  if (!button) throw new Error(`no menu button in ${id}`);
  return button;
}

async function openMenu(table: ArgusTable<Order>): Promise<HTMLElement> {
  return waitFor(() => {
    const menu = table.querySelector<HTMLElement>('.argus-header-menu:popover-open');
    if (!menu) throw new Error('menu not open');
    return menu;
  });
}

const item = (menu: HTMLElement, label: string) => {
  const found = [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find(
    (i) => i.textContent.trim() === label,
  );
  if (!found) throw new Error(`no item ${label}`);
  return found;
};

/**
 * `@argus-table/header-menu` is a plugin: `table.plugins = [headerMenu()]`. Each
 * column gets a button in its header, which opens a menu to sort the column,
 * clear its sort, pin it, fit its width to its content, or hide it. A
 * right-click on a header opens it too. `headerMenu({ sort: false, fitWidth: false })`
 * leaves out the sort and Fit width items.
 */
export const Default: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px"
      .columns=${orderColumns}
      .data=${data}
      .plugins=${plugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await userEvent.click(buttonOf(table, 'total'));
    const menu = await openMenu(table);
    // Opening the menu doesn't sort.
    await expect(table.sorting).toEqual([]);
    await userEvent.click(item(menu, 'Sort descending'));
    await waitFor(() => expect(table.sorting).toEqual([{ id: 'total', desc: true }]));
    await waitFor(() => expect(table.shadowRoot?.activeElement).toBe(headerOf(table, 'total')));
    await expect(table.querySelector('.argus-header-menu')).toBeNull();
  },
};

/**
 * On a focused header, Alt+ArrowDown opens the menu (as do the context menu key
 * and Shift+F10). Arrow keys, Home and End move through it, Enter or Space runs
 * an item, and Escape or Tab closes it. Focus goes back to the header.
 */
export const Keyboard: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    headerOf(table, 'customer').focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    const menu = await openMenu(table);
    await waitFor(() => expect(document.activeElement).toBe(item(menu, 'Unsorted')));
    await userEvent.keyboard('{Home}');
    await expect(document.activeElement).toBe(item(menu, 'Sort ascending'));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(table.sorting).toEqual([{ id: 'customer', desc: false }]));
    await waitFor(() => expect(table.shadowRoot?.activeElement).toBe(headerOf(table, 'customer')));
  },
};

/**
 * With `sorting` controlled, the menu only proposes the order through
 * `argus-sorting-change`, like a header click; the host decides.
 */
export const ControlledSorting: Story = {
  render: () => {
    const proposed: SortingChangeDetail[] = [];
    return html`<argus-table
        style="block-size: 360px"
        .columns=${orderColumns}
        .data=${data}
        .sorting=${[]}
        .plugins=${plugins}
        @argus-sorting-change=${(e: CustomEvent<SortingChangeDetail>) => {
          proposed.push(e.detail);
          const out = (e.currentTarget as HTMLElement).nextElementSibling;
          if (out) out.textContent = `Proposed: ${JSON.stringify(e.detail.sorting)}`;
        }}
      ></argus-table>
      <output>Proposed: nothing yet</output>`;
  },
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await userEvent.click(buttonOf(table, 'total'));
    await userEvent.click(item(await openMenu(table), 'Sort ascending'));
    const output = canvasElement.querySelector('output');
    await waitFor(() =>
      expect(output?.textContent).toBe('Proposed: [{"id":"total","desc":false}]'),
    );
    await expect(table.sorting).toEqual([]);
  },
};

/**
 * The menu is a native popover in the top layer, so even a short table or a
 * pinned column doesn't clip it. It follows the table's theme tokens and has
 * its own: `--argus-menu-bg`, `--argus-menu-fg`, `--argus-menu-shadow` and
 * `--argus-menu-item-active-bg`.
 */
export const Open: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 120px; --argus-menu-item-active-bg: #dbeafe"
      .columns=${orderColumns}
      .data=${data}
      .plugins=${plugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await userEvent.click(buttonOf(table, 'customer'));
    const menu = await openMenu(table);
    await expect(menu.getBoundingClientRect().bottom).toBeGreaterThan(
      table.getBoundingClientRect().bottom,
    );
  },
};

/** Header ids in visual order. */
const headerOrder = (table: ArgusTable<Order>) =>
  [...(table.shadowRoot?.querySelectorAll<HTMLElement>('[role="columnheader"]') ?? [])]
    .sort((a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex))
    .map((h) => h.dataset.col);

/**
 * Pin to start, Pin to end and Don't pin set `columnPinning`; Hide column sets
 * `columnVisibility`, and every menu lists the hidden columns to show them
 * again. With the properties controlled, the menu only fires `argus-column-pinning-change`
 * and `argus-column-visibility-change`. `pinnable: false` and `hideable: false` leave a column
 * out, and `headerMenu({ pin: false, hide: false })` turns the items off.
 */
export const PinAndHide: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px; inline-size: 720px"
      .columns=${orderColumns}
      .data=${data}
      .plugins=${plugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const start = headerOrder(table);
    await userEvent.click(buttonOf(table, 'customer'));
    await userEvent.click(item(await openMenu(table), 'Pin to start'));
    await waitFor(() => expect(table.columnPinning).toEqual({ customer: 'start' }));
    await userEvent.click(buttonOf(table, 'customer'));
    await userEvent.click(item(await openMenu(table), 'Hide column'));
    await waitFor(() => expect(headerOrder(table)).not.toContain('customer'));

    // Back to how the story started.
    const other = headerOrder(table).find((id) => id !== undefined) ?? '';
    await userEvent.click(buttonOf(table, other));
    await userEvent.click(item(await openMenu(table), 'Show Customer'));
    await userEvent.click(buttonOf(table, 'customer'));
    await userEvent.click(item(await openMenu(table), "Don't pin"));
    await waitFor(() => expect(headerOrder(table)).toEqual(start));
  },
};

const filterColumns = orderColumns.map((c) =>
  c.id === 'customer'
    ? { ...c, filter: 'text' as const }
    : c.id === 'city' || c.id === 'status'
      ? { ...c, filter: 'set' as const }
      : c.id === 'total'
        ? { ...c, filter: 'number' as const }
        : c,
);

/** Rendered body rows' text in a column. */
const columnTexts = (table: ArgusTable<Order>, id: string) =>
  [...(table.shadowRoot?.querySelectorAll(`[part~="row"] [data-col="${id}"]`) ?? [])].map((cell) =>
    cell.querySelector('slot')?.assignedElements()[0]?.textContent.trim(),
  );

/**
 * Columns with a `filter` kind get Filter… in their menu: a small form for a `text`
 * condition, a `number` or `date` comparison or range, or the values of a `set`
 * (searchable, listed from the rows the other filters leave). Typed values apply as
 * typing pauses, Enter or Done closes the form on its header, Escape closes it as
 * it is, and Clear (or Clear filter in the menu) removes the column's filter. The
 * form sets `columnFilters`; with it controlled, it only fires `argus-column-filters-change`.
 * `headerMenu({ filter: false })` turns the items off.
 */
export const Filter: Story = {
  render: () =>
    html`<argus-table
      style="block-size: 420px; inline-size: 720px"
      .columns=${filterColumns}
      .data=${data}
      .plugins=${plugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await userEvent.click(buttonOf(table, 'city'));
    await userEvent.click(item(await openMenu(table), 'Filter…'));
    const form = await waitFor(() => {
      const found = table.querySelector<HTMLElement>('.argus-header-filter:popover-open');
      if (!found) throw new Error('form not open');
      return found;
    });
    const oslo = [...form.querySelectorAll('.argus-header-filter-values label')].find(
      (l) => l.textContent.trim() === 'Oslo',
    );
    if (!oslo) throw new Error('no Oslo');
    // Only Oslo: uncheck all, then check it.
    await userEvent.click(form.querySelector('.argus-header-filter-all input') ?? form);
    await userEvent.click(oslo);
    await waitFor(() =>
      expect(table.columnFilters).toEqual({ city: { kind: 'set', values: ['Oslo'] } }),
    );
    await waitFor(() => expect(new Set(columnTexts(table, 'city'))).toEqual(new Set(['Oslo'])));
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(headerOf(table, 'city').part.contains('header-cell-filtered')).toBe(true),
    );

    // Back to how the story started.
    await userEvent.click(buttonOf(table, 'city'));
    await userEvent.click(item(await openMenu(table), 'Clear filter'));
    await waitFor(() => expect(table.columnFilters).toEqual({}));
  },
};
