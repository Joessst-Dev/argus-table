import { afterEach, describe, expect, test } from 'vitest';
import 'argus-table';
import type { ArgusTable, ColumnDef } from 'argus-table';
import { headerMenu } from './index.js';

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
  Object.assign(el, { columns, data, getRowId: (r: Row) => r.id, plugins: [headerMenu()] }, props);
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

describe('header menu plugin', () => {
  test('one plugin serves two tables, and removing it removes the buttons', async () => {
    const plugin = headerMenu<Row>();
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
