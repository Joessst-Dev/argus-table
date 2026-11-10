import { afterEach, describe, expect, test, vi } from 'vitest';
import 'argus-table';
import type { ArgusPlugin, ArgusTable, ColumnDef } from 'argus-table';
import {
  headerMenu,
  type HeaderMenuContributor,
  type HeaderMenuGroup,
  type HeaderMenuItem,
} from './index.js';

interface Row {
  id: string;
  name: string;
  age: number;
  note: string;
}

const data: Row[] = [
  { id: 'a', name: 'Ann', age: 30, note: 'x' },
  { id: 'b', name: 'Bob', age: 10, note: 'y' },
  { id: 'c', name: 'Cid', age: 20, note: 'z' },
];

const columns: ColumnDef<Row>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 160, sortable: true },
  { id: 'age', header: 'Age', accessor: 'age', width: 120, sortable: true },
  // Neither sortable nor resizable: no menu.
  { id: 'note', header: 'Note', accessor: 'note', width: 120, resizable: false },
];

/** The menu without the pin and hide items, which have their own tests. */
const basic = () => headerMenu<Row>({ pin: false, hide: false });

afterEach(() => {
  document.body.replaceChildren();
});

async function settle(el: ArgusTable<Row>) {
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await el.updateComplete;
}

async function fixture(
  props: Partial<ArgusTable<Row>> = {},
  size = { width: 600, height: 300 },
): Promise<ArgusTable<Row>> {
  const el = document.createElement('argus-table') as ArgusTable<Row>;
  Object.assign(el, { columns, data, getRowId: (r: Row) => r.id, plugins: [basic()] }, props);
  el.style.inlineSize = `${String(size.width)}px`;
  el.style.blockSize = `${String(size.height)}px`;
  document.body.append(el);
  await settle(el);
  return el;
}

const headerOf = (el: ArgusTable<Row>, id: string) => {
  const h = el.shadowRoot?.querySelector<HTMLElement>(`[role="columnheader"][data-col="${id}"]`);
  if (!h) throw new Error(`no header ${id}`);
  return h;
};

/** The menu button in a column's header content. */
const buttonOf = (el: ArgusTable<Row>, id: string) => {
  const slot = headerOf(el, id).querySelector('slot');
  return slot?.assignedElements()[0]?.querySelector<HTMLButtonElement>('.argus-header-menu-button');
};

const openMenu = (el: ArgusTable<Row>) =>
  el.querySelector<HTMLElement>('.argus-header-menu:popover-open');

const items = (menu: HTMLElement) => [
  ...menu.querySelectorAll<HTMLElement>('.argus-header-menu-item'),
];

const names = (el: ArgusTable<Row>) =>
  [...(el.shadowRoot?.querySelectorAll('[part~="row"]') ?? [])]
    .sort(
      (a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')),
    )
    .map((row) => row.querySelector('[data-col="name"] slot'))
    .map((slot) => (slot as HTMLSlotElement | null)?.assignedElements()[0]?.textContent);

const key = (target: Element, name: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

const focused = (): Element => {
  const active = document.activeElement;
  if (!active) throw new Error('nothing focused');
  return active;
};

/** Waits until the menu opened by a click or key has rendered, shown and taken focus. */
async function opened(el: ArgusTable<Row>): Promise<HTMLElement> {
  await settle(el);
  const menu = openMenu(el);
  if (!menu) throw new Error('menu not open');
  return menu;
}

describe('header menu button', () => {
  test('shows a button in sortable or resizable headers, after their content', async () => {
    const el = await fixture();
    expect(buttonOf(el, 'name')?.getAttribute('aria-label')).toBe('Column menu');
    expect(buttonOf(el, 'name')?.getAttribute('aria-expanded')).toBe('false');
    expect(buttonOf(el, 'note') ?? null).toBeNull();
    const label = el.querySelector('.argus-header-menu-label');
    expect(label?.textContent).toBe('Name');
    // The button isn't a tab stop: the grid keeps one.
    expect(buttonOf(el, 'name')?.tabIndex).toBe(-1);
  });

  test('a click on the button opens the menu without sorting', async () => {
    const el = await fixture();
    buttonOf(el, 'age')?.click();
    const menu = await opened(el);
    expect(menu.getAttribute('role')).toBe('menu');
    expect(items(menu).map((i) => i.textContent.trim())).toEqual([
      'Sort ascending',
      'Sort descending',
      'Unsorted',
      'Fit width',
    ]);
    expect(el.sorting).toEqual([]);
    expect(buttonOf(el, 'age')?.getAttribute('aria-expanded')).toBe('true');
    // Focus is on the checked item: unsorted.
    expect(document.activeElement).toBe(items(menu)[2]);
  });

  test('a second click on the button closes the menu', async () => {
    const el = await fixture();
    buttonOf(el, 'age')?.click();
    await opened(el);
    buttonOf(el, 'age')?.click();
    await settle(el);
    expect(openMenu(el)).toBeNull();
  });

  test('only offers what the column allows', async () => {
    const el = await fixture({
      columns: [{ id: 'name', header: 'Name', accessor: 'name', resizable: false, sortable: true }],
    });
    buttonOf(el, 'name')?.click();
    const menu = await opened(el);
    expect(items(menu).map((i) => i.textContent.trim())).toEqual([
      'Sort ascending',
      'Sort descending',
      'Unsorted',
    ]);
    expect(menu.querySelector('[role="separator"]')).toBeNull();
  });
});

describe('header menu actions', () => {
  test('Sort descending sorts, closes the menu and focuses the header', async () => {
    const el = await fixture();
    const events: unknown[] = [];
    el.addEventListener('argus-sort-change', (e) => events.push(e.detail.sorting));
    buttonOf(el, 'name')?.click();
    const menu = await opened(el);
    items(menu)[1]?.click();
    await settle(el);
    expect(names(el)).toEqual(['Cid', 'Bob', 'Ann']);
    expect(openMenu(el)).toBeNull();
    expect(el.shadowRoot?.activeElement).toBe(headerOf(el, 'name'));
    expect(events).toEqual([[{ id: 'name', desc: true }]]);

    // The checked item follows the sort.
    buttonOf(el, 'name')?.click();
    const again = await opened(el);
    expect(items(again)[1]?.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(items(again)[1]);
    items(again)[2]?.click();
    await settle(el);
    expect(el.sorting).toEqual([]);
  });

  test('with controlled sorting, only proposes the order', async () => {
    const el = await fixture({ sorting: [] });
    const events: unknown[] = [];
    el.addEventListener('argus-sort-change', (e) => events.push(e.detail.sorting));
    buttonOf(el, 'age')?.click();
    items(await opened(el))[0]?.click();
    await settle(el);
    expect(el.sorting).toEqual([]);
    expect(events).toEqual([[{ id: 'age', desc: false }]]);
  });

  test('Fit width fits the column to its content and says so', async () => {
    const el = await fixture();
    const resizes: unknown[] = [];
    el.addEventListener('argus-column-resize', (e) => resizes.push(e.detail.columnId));
    buttonOf(el, 'age')?.click();
    items(await opened(el))[3]?.click();
    await settle(el);
    expect(resizes).toEqual(['age']);
    expect(el.columnSizing.age).toBeLessThan(120);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const region = document.querySelector('[data-argus-announcer]');
    expect(region?.textContent).toMatch(/^Age fitted to \d+ px$/);
  });

  test('presses inside the menu neither sort nor start a column drag', async () => {
    const el = await fixture();
    buttonOf(el, 'age')?.click();
    const menu = await opened(el);
    menu.click();
    await settle(el);
    expect(el.sorting).toEqual([]);
    expect(openMenu(el)).toBe(menu);
  });
});

describe('header menu keyboard', () => {
  test('Alt+ArrowDown on a focused header opens it; arrows move; Escape returns to the header', async () => {
    const el = await fixture();
    const header = headerOf(el, 'name');
    header.focus();
    expect(key(header, 'ArrowDown', { altKey: true }).defaultPrevented).toBe(true);
    const menu = await opened(el);
    const list = items(menu);
    expect(document.activeElement).toBe(list[2]);
    key(focused(), 'ArrowDown');
    expect(document.activeElement).toBe(list[3]);
    key(focused(), 'ArrowDown');
    expect(document.activeElement).toBe(list[0]);
    key(focused(), 'ArrowUp');
    expect(document.activeElement).toBe(list[3]);
    key(focused(), 'Home');
    expect(document.activeElement).toBe(list[0]);
    key(focused(), 'Escape');
    await settle(el);
    expect(openMenu(el)).toBeNull();
    expect(el.shadowRoot?.activeElement).toBe(header);
  });

  test('Alt+ArrowDown on a header without a menu does nothing', async () => {
    const el = await fixture();
    const header = headerOf(el, 'note');
    header.focus();
    expect(key(header, 'ArrowDown', { altKey: true }).defaultPrevented).toBe(false);
    await settle(el);
    expect(openMenu(el)).toBeNull();
  });

  test('the context menu (right-click, the menu key) on a header opens it', async () => {
    const el = await fixture();
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    headerOf(el, 'age').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const menu = await opened(el);
    expect(menu.dataset.column).toBe('age');
  });
});

describe('header menu placement', () => {
  test('renders in the top layer, unclipped by a small table', async () => {
    const el = await fixture({}, { width: 300, height: 80 });
    buttonOf(el, 'age')?.click();
    const menu = await opened(el);
    const rect = menu.getBoundingClientRect();
    expect(rect.bottom).toBeGreaterThan(el.getBoundingClientRect().bottom);
    const last = items(menu).at(-1);
    const r = last?.getBoundingClientRect();
    if (!r) throw new Error('no item');
    expect(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)).toBe(last);
  });

  test('sits under its button, ends aligned; mirrored in RTL', async () => {
    // Narrow enough for the test runner's viewport, so the menu needn't be clamped.
    const el = await fixture({}, { width: 400, height: 300 });
    const button = () => {
      const b = buttonOf(el, 'age');
      if (!b) throw new Error('no button');
      return b.getBoundingClientRect();
    };
    // The button sits at the header's inline end, before the padding and the sort indicator.
    expect(headerOf(el, 'age').getBoundingClientRect().right - button().right).toBeLessThan(30);
    buttonOf(el, 'age')?.click();
    let menu = await opened(el);
    expect(Math.round(menu.getBoundingClientRect().right)).toBe(Math.round(button().right));
    expect(menu.getBoundingClientRect().top).toBeGreaterThanOrEqual(button().bottom);
    key(focused(), 'Escape');
    await settle(el);

    el.dir = 'rtl';
    await settle(el);
    expect(button().left - headerOf(el, 'age').getBoundingClientRect().left).toBeLessThan(30);
    buttonOf(el, 'age')?.click();
    menu = await opened(el);
    expect(Math.round(menu.getBoundingClientRect().left)).toBe(Math.round(button().left));
  });

  test('takes theme tokens set on the table', async () => {
    const el = await fixture();
    el.style.setProperty('--argus-menu-bg', 'rgb(1, 2, 3)');
    buttonOf(el, 'name')?.click();
    const menu = await opened(el);
    expect(getComputedStyle(menu).backgroundColor).toBe('rgb(1, 2, 3)');
  });

  test('stays open while the table scrolls sideways with virtualizeColumns', async () => {
    const wide: ColumnDef<Row>[] = Array.from({ length: 40 }, (_, i) => ({
      id: `c${String(i)}`,
      header: `Col ${String(i)}`,
      accessor: 'name',
      width: 100,
      sortable: true,
    }));
    const el = await fixture({ columns: wide, virtualizeColumns: true });
    buttonOf(el, 'c1')?.click();
    const menu = await opened(el);
    const scroller = el.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
    if (!scroller) throw new Error('no scroller');
    scroller.scrollLeft = 2000;
    await new Promise((resolve) => {
      scroller.addEventListener('scroll', resolve, { once: true });
    });
    await settle(el);
    expect(openMenu(el)).toBe(menu);
    expect(document.activeElement && menu.contains(document.activeElement)).toBe(true);
  });
});

describe('items from other plugins', () => {
  const ran: string[] = [];
  const contributor = (
    groups: (columnId: string) => HeaderMenuGroup[],
  ): ArgusPlugin<Row> & HeaderMenuContributor<Row> => ({
    name: 'contributor',
    headerMenuItems: (columnId) => groups(columnId),
  });
  const item = (label: string, extra: Partial<HeaderMenuItem> = {}): HeaderMenuItem => ({
    label,
    run: () => ran.push(label),
    ...extra,
  });

  afterEach(() => {
    ran.length = 0;
  });

  test('come after the built-in items, in groups with separators and headings', async () => {
    const el = await fixture({
      plugins: [
        basic(),
        contributor((id) => [
          {
            label: 'Formula',
            items: [item(`Edit ${id}`, { detail: '[a] * 2' }), item('Delete', { danger: true })],
          },
          { items: [item('Add…')] },
          { label: 'Empty', items: [] },
        ]),
      ],
    });
    buttonOf(el, 'age')?.click();
    const menu = await opened(el);
    expect(items(menu).map((i) => i.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'Sort ascending',
      'Sort descending',
      'Unsorted',
      'Fit width',
      'Edit age [a] * 2',
      'Delete',
      'Add…',
    ]);
    expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(3);
    const group = menu.querySelector('[role="group"]');
    const heading = group?.getAttribute('aria-labelledby') ?? '';
    expect(menu.querySelector(`[id="${heading}"]`)?.textContent).toBe('Formula');
    expect(items(menu)[5]?.classList.contains('argus-header-menu-item-danger')).toBe(true);
  });

  test('give a menu to columns that can neither sort nor resize', async () => {
    const el = await fixture({
      plugins: [
        basic(),
        contributor((id) => (id === 'note' ? [{ items: [item('Note it')] }] : [])),
      ],
    });
    buttonOf(el, 'note')?.click();
    const menu = await opened(el);
    expect(items(menu).map((i) => i.textContent.trim())).toEqual(['Note it']);
    expect(menu.querySelector('[role="separator"]')).toBeNull();
  });

  test('run after the menu closes, and leave focus to the item', async () => {
    const el = await fixture({
      plugins: [basic(), contributor(() => [{ items: [item('Go')] }])],
    });
    buttonOf(el, 'name')?.click();
    const menu = await opened(el);
    items(menu)[4]?.click();
    expect(ran).toEqual(['Go']);
    await settle(el);
    expect(openMenu(el)).toBeNull();
    expect(el.shadowRoot?.activeElement).not.toBe(headerOf(el, 'name'));
  });

  test('a contributor that throws is reported and skipped', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const el = await fixture({
      plugins: [
        basic(),
        contributor(() => {
          throw new Error('boom');
        }),
      ],
    });
    buttonOf(el, 'name')?.click();
    const menu = await opened(el);
    expect(items(menu)).toHaveLength(4);
    expect(error).toHaveBeenCalledWith(
      'argus-table: plugin "contributor" threw in headerMenuItems',
      expect.any(Error),
    );
  });
});

describe('header menu plugin', () => {
  test('one plugin serves two tables, and removing it removes the buttons', async () => {
    const plugin = basic();
    const a = await fixture({ plugins: [plugin] });
    const b = await fixture({ plugins: [plugin] });
    buttonOf(a, 'name')?.click();
    await opened(a);
    expect(openMenu(b)).toBeNull();
    expect(buttonOf(b, 'name')).toBeInstanceOf(HTMLButtonElement);

    b.plugins = [];
    await settle(b);
    expect(buttonOf(b, 'name') ?? null).toBeNull();
    const contextmenu = new MouseEvent('contextmenu', {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    headerOf(b, 'name').dispatchEvent(contextmenu);
    expect(contextmenu.defaultPrevented).toBe(false);
  });
});

describe('pin and hide items', () => {
  const full = () => headerMenu<Row>();
  const labels = (menu: HTMLElement) => items(menu).map((i) => i.textContent.trim());
  const item = (menu: HTMLElement, label: string) => {
    const found = items(menu).find((i) => i.textContent.trim() === label);
    if (!found) throw new Error(`no item ${label}`);
    return found;
  };
  /** Header ids in visual order. */
  const order = (el: ArgusTable<Row>) =>
    [...(el.shadowRoot?.querySelectorAll<HTMLElement>('[role="columnheader"]') ?? [])]
      .sort((a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex))
      .map((h) => h.dataset.col);
  const announced = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return document.querySelector('[data-argus-announcer]')?.textContent;
  };

  test('come after sorting and around Fit width, for every column', async () => {
    const el = await fixture({ plugins: [full()] });
    buttonOf(el, 'name')?.click();
    const menu = await opened(el);
    expect(labels(menu)).toEqual([
      'Sort ascending',
      'Sort descending',
      'Unsorted',
      'Pin to start',
      'Pin to end',
      "Don't pin",
      'Fit width',
      'Hide column',
    ]);
    expect(item(menu, "Don't pin").getAttribute('role')).toBe('menuitemradio');
    expect(item(menu, "Don't pin").getAttribute('aria-checked')).toBe('true');
    // Focus still starts on the sort the column has.
    expect(document.activeElement).toBe(item(menu, 'Unsorted'));
    key(focused(), 'Escape');
    await settle(el);
    // A column that can neither sort nor resize gets a menu to pin and hide it.
    expect(buttonOf(el, 'note')).toBeInstanceOf(HTMLButtonElement);
  });

  test('Pin to end pins the column, keeps focus on its header and says so', async () => {
    const el = await fixture({ plugins: [full()] });
    const pins: unknown[] = [];
    el.addEventListener('argus-column-pin', (e) => pins.push(e.detail));
    buttonOf(el, 'name')?.click();
    item(await opened(el), 'Pin to end').click();
    await settle(el);
    expect(order(el)).toEqual(['age', 'note', 'name']);
    expect(el.columnPinning).toEqual({ name: 'end' });
    expect(pins).toEqual([{ columnId: 'name', pin: 'end', pinning: { name: 'end' } }]);
    expect(el.shadowRoot?.activeElement).toBe(headerOf(el, 'name'));
    expect(await announced()).toBe('Name pinned to the end');

    buttonOf(el, 'name')?.click();
    const menu = await opened(el);
    expect(item(menu, 'Pin to end').getAttribute('aria-checked')).toBe('true');
    item(menu, "Don't pin").click();
    await settle(el);
    expect(order(el)).toEqual(['name', 'age', 'note']);
    expect(await announced()).toBe('Name unpinned');
  });

  test('with controlled columnPinning, only proposes the pins', async () => {
    const el = await fixture({ plugins: [full()], columnPinning: {} });
    const pins: unknown[] = [];
    el.addEventListener('argus-column-pin', (e) => pins.push(e.detail.pinning));
    buttonOf(el, 'age')?.click();
    item(await opened(el), 'Pin to start').click();
    await settle(el);
    expect(order(el)).toEqual(['name', 'age', 'note']);
    expect(pins).toEqual([{ age: 'start' }]);
  });

  test('Hide column hides it, focuses the next header, and the others offer to show it', async () => {
    const el = await fixture({ plugins: [full()] });
    const hides: unknown[] = [];
    el.addEventListener('argus-column-hide', (e) => hides.push(e.detail));
    buttonOf(el, 'name')?.click();
    item(await opened(el), 'Hide column').click();
    await settle(el);
    expect(order(el)).toEqual(['age', 'note']);
    expect(hides).toEqual([{ columnId: 'name', hidden: true, visibility: { name: false } }]);
    expect(el.shadowRoot?.activeElement).toBe(headerOf(el, 'age'));
    expect(await announced()).toBe('Name hidden');

    buttonOf(el, 'note')?.click();
    const menu = await opened(el);
    const group = menu.querySelector('[role="group"]');
    expect(group?.querySelector('.argus-header-menu-group-label')?.textContent).toBe(
      'Hidden columns',
    );
    expect(labels(menu).slice(-2)).toEqual(['Hide column', 'Show Name']);
    item(menu, 'Show Name').click();
    await settle(el);
    expect(order(el)).toEqual(['name', 'age', 'note']);
    expect(el.shadowRoot?.activeElement).toBe(headerOf(el, 'note'));
    expect(await announced()).toBe('Name shown');
  });

  test('Show all shows every hidden column; the last column shown has no Hide', async () => {
    const el = await fixture({ plugins: [full()], columnVisibility: { name: false, age: false } });
    buttonOf(el, 'note')?.click();
    let menu = await opened(el);
    expect(labels(menu)).toEqual([
      'Pin to start',
      'Pin to end',
      "Don't pin",
      'Show Name',
      'Show Age',
      'Show all',
    ]);
    item(menu, 'Show all').click();
    await settle(el);
    // Controlled: the proposals compose, and the table waits for the host.
    expect(order(el)).toEqual(['note']);
    el.columnVisibility = undefined;
    await settle(el);
    buttonOf(el, 'note')?.click();
    menu = await opened(el);
    item(menu, 'Show all').click();
    await settle(el);
    expect(order(el)).toEqual(['name', 'age', 'note']);
    expect(await announced()).toBe('2 columns shown');
  });

  test('leave out columns with pinnable or hideable false, and turn off with the options', async () => {
    const el = await fixture({
      plugins: [full()],
      columns: columns.map((c) =>
        c.id === 'note' ? { ...c, pinnable: false, hideable: false } : c,
      ),
    });
    expect(buttonOf(el, 'note') ?? null).toBeNull();
    buttonOf(el, 'age')?.click();
    item(await opened(el), 'Hide column').click();
    await settle(el);
    expect(order(el)).toEqual(['name', 'note']);
    // Hidden columns still get shown from any column's menu.
    expect(buttonOf(el, 'note')).toBeInstanceOf(HTMLButtonElement);

    el.plugins = [headerMenu<Row>({ pin: false, hide: false })];
    await settle(el);
    expect(buttonOf(el, 'note') ?? null).toBeNull();
    buttonOf(el, 'name')?.click();
    expect(labels(await opened(el))).toEqual([
      'Sort ascending',
      'Sort descending',
      'Unsorted',
      'Fit width',
    ]);
  });
});
