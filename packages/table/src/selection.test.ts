import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { html } from 'lit';
import type { ArgusTable } from './index.js';
import { LOAD_DEBOUNCE_MS } from './controllers/data-controller.js';
import type { ColumnDef, DataSource, SelectionState } from './types.js';
import { fixture, people, rowsInOrder, settle, shadow, type Person } from './test-utils.js';

afterEach(() => {
  document.body.replaceChildren();
});

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', sortable: true },
  { id: 'age', header: 'Age', accessor: 'age', sortable: true },
  { id: 'city', header: 'City', accessor: 'address.city' },
];

const getRowId = (p: Person) => p.id;

/** A body cell by its row's position in the current order. */
function cellAt(el: HTMLElement, row: number, col = 'name'): HTMLElement {
  const cell = rowsInOrder(el)[row]?.querySelector<HTMLElement>(`[data-col="${col}"]`);
  if (!cell) throw new Error(`no cell at row ${String(row)}`);
  return cell;
}

/** Clicks a body cell with modifier keys, and waits for the update. */
async function click(el: ArgusTable<Person>, row: number, init: MouseEventInit = {}) {
  cellAt(el, row).dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ...init }),
  );
  await settle(el);
}

function press(target: Element, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

const focused = (el: HTMLElement) => shadow(el).activeElement as HTMLElement | null;

/** Presses a key on the focused cell and waits for the update. */
async function key(el: ArgusTable<Person>, name: string, init?: KeyboardEventInit) {
  const cell = focused(el);
  if (!cell) throw new Error('nothing focused');
  const event = press(cell, name, init);
  await settle(el);
  return event;
}

/** Indices (in the current order) of the rendered rows carrying `row-selected`. */
const selectedRows = (el: HTMLElement) =>
  rowsInOrder(el)
    .map((row, i) => (row.part.contains('row-selected') ? i : -1))
    .filter((i) => i >= 0);

/** Collects `argus-selection-change` details. */
function changes(el: HTMLElement) {
  const seen: SelectionState[] = [];
  el.addEventListener('argus-selection-change', (e) => seen.push(e.detail.selection));
  return seen;
}

describe('selection: off', () => {
  test('clicks and keys select nothing without a selectionMode', async () => {
    const el = await fixture({ columns, data: people(10), getRowId });
    const seen = changes(el);
    await click(el, 2);
    cellAt(el, 2).focus();
    expect(press(cellAt(el, 2), ' ').defaultPrevented).toBe(false);
    expect(press(cellAt(el, 2), 'a', { ctrlKey: true }).defaultPrevented).toBe(false);
    await settle(el);
    expect(seen).toEqual([]);
    expect(el.selection).toEqual([]);
    expect(rowsInOrder(el).some((r) => r.hasAttribute('aria-selected'))).toBe(false);
  });

  test('an unknown mode is read as none', async () => {
    const el = await fixture({ columns, data: people(5), getRowId });
    el.setAttribute('selection-mode', 'all');
    await settle(el);
    await click(el, 1);
    expect(el.selection).toEqual([]);
  });
});

describe('selection: multi, clicks', () => {
  async function table() {
    const el = await fixture({ columns, data: people(20), getRowId, selectionMode: 'multi' });
    return { el, seen: changes(el) };
  }

  test('a click selects only that row, then fires after the update', async () => {
    const { el, seen } = await table();
    expect(rowsInOrder(el)[0]?.getAttribute('aria-selected')).toBe('false');
    let partOnEvent: boolean | undefined;
    el.addEventListener('argus-selection-change', () => {
      partOnEvent = rowsInOrder(el)[3]?.part.contains('row-selected');
    });
    await click(el, 3);
    expect(el.selection).toEqual(['p3']);
    expect(seen).toEqual([['p3']]);
    expect(partOnEvent).toBe(true);
    expect(rowsInOrder(el)[3]?.getAttribute('aria-selected')).toBe('true');
    await click(el, 5);
    expect(el.selection).toEqual(['p5']);
    expect(selectedRows(el)).toEqual([5]);
  });

  test('a click on the one selected row changes nothing', async () => {
    const { el, seen } = await table();
    await click(el, 3);
    await click(el, 3);
    expect(seen).toEqual([['p3']]);
  });

  test('Ctrl or Cmd toggles a row', async () => {
    const { el, seen } = await table();
    await click(el, 1);
    await click(el, 4, { ctrlKey: true });
    await click(el, 6, { metaKey: true });
    await click(el, 1, { ctrlKey: true });
    expect(seen).toEqual([['p1'], ['p1', 'p4'], ['p1', 'p4', 'p6'], ['p4', 'p6']]);
    expect(selectedRows(el)).toEqual([4, 6]);
  });

  test('Shift selects the range from the anchor; Ctrl+Shift adds it', async () => {
    const { el } = await table();
    await click(el, 2);
    await click(el, 5, { shiftKey: true });
    expect(el.selection).toEqual(['p2', 'p3', 'p4', 'p5']);
    // The anchor stays on row 2: a range back up from it.
    await click(el, 0, { shiftKey: true });
    expect(el.selection).toEqual(['p0', 'p1', 'p2']);
    await click(el, 9, { ctrlKey: true });
    await click(el, 11, { ctrlKey: true, shiftKey: true });
    expect(el.selection).toEqual(['p0', 'p1', 'p2', 'p9', 'p10', 'p11']);
  });

  test('a range follows the current order, and ids survive sorting', async () => {
    const data = people(20).map((p, i) => ({ ...p, age: 100 - i }));
    const el = await fixture({ columns, data, getRowId, selectionMode: 'multi' });
    await click(el, 0);
    el.sorting = [{ id: 'age', desc: false }];
    await settle(el);
    // p0 (age 100) is now the last row, still selected.
    expect(selectedRows(el)).toEqual([19]);
    expect(el.selection).toEqual(['p0']);
    // A range from p19 (now first) to the third row.
    await click(el, 0);
    await click(el, 2, { shiftKey: true });
    expect(el.selection).toEqual(['p19', 'p18', 'p17']);
  });

  test('a Shift+press keeps the text unselected and focuses the cell', async () => {
    const { el } = await table();
    const down = new MouseEvent('mousedown', {
      bubbles: true,
      composed: true,
      cancelable: true,
      shiftKey: true,
    });
    cellAt(el, 4).dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(focused(el)).toBe(cellAt(el, 4));
    const plain = new MouseEvent('mousedown', { bubbles: true, composed: true, cancelable: true });
    cellAt(el, 4).dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
  });

  test('fires after argus-cell-click and argus-row-click', async () => {
    const { el } = await table();
    const order: string[] = [];
    el.addEventListener('argus-cell-click', () => order.push('cell'));
    el.addEventListener('argus-row-click', () => order.push('row'));
    el.addEventListener('argus-selection-change', () => order.push('selection'));
    await click(el, 2);
    expect(order).toEqual(['cell', 'row', 'selection']);
  });

  test('clicks on interactive content in a cell do not select', async () => {
    const withButton: ColumnDef<Person>[] = [
      ...columns,
      { id: 'act', header: '', cell: () => html`<button type="button">Edit</button>` },
    ];
    const el = await fixture({
      columns: withButton,
      data: people(5),
      getRowId,
      selectionMode: 'multi',
    });
    const rowClicks: unknown[] = [];
    el.addEventListener('argus-row-click', (e) => rowClicks.push(e.detail.rowId));
    const cell = cellAt(el, 1, 'act');
    const button = cell.querySelector('slot')?.assignedElements({ flatten: true })[0];
    const target = button?.querySelector('button') ?? button;
    if (!(target instanceof HTMLElement)) throw new Error('no button');
    target.click();
    await settle(el);
    expect(rowClicks).toEqual(['p1']);
    expect(el.selection).toEqual([]);
  });
});

describe('selection: single', () => {
  test('a click selects one row; Ctrl+click clears it; Shift is a plain click', async () => {
    const el = await fixture({ columns, data: people(10), getRowId, selectionMode: 'single' });
    const seen = changes(el);
    await click(el, 2);
    await click(el, 4);
    await click(el, 6, { shiftKey: true });
    await click(el, 6, { ctrlKey: true });
    expect(seen).toEqual([['p2'], ['p4'], ['p6'], []]);
  });

  test('Ctrl+A is left alone', async () => {
    const el = await fixture({ columns, data: people(10), getRowId, selectionMode: 'single' });
    cellAt(el, 0).focus();
    expect(press(cellAt(el, 0), 'a', { ctrlKey: true }).defaultPrevented).toBe(false);
    await settle(el);
    expect(el.selection).toEqual([]);
  });
});

describe('selection: controlled', () => {
  test('a click only proposes; setting the property applies it', async () => {
    const el = await fixture({
      columns,
      data: people(10),
      getRowId,
      selectionMode: 'multi',
      selection: ['p1'],
    });
    const seen = changes(el);
    expect(selectedRows(el)).toEqual([1]);
    await click(el, 3, { ctrlKey: true });
    expect(seen).toEqual([['p1', 'p3']]);
    expect(el.selection).toEqual(['p1']);
    expect(selectedRows(el)).toEqual([1]);
    el.selection = ['p1', 'p3'];
    await settle(el);
    expect(selectedRows(el)).toEqual([1, 3]);
  });

  test('undefined hands it back, keeping the last value', async () => {
    const el = await fixture({
      columns,
      data: people(10),
      getRowId,
      selectionMode: 'multi',
      selection: ['p2'],
    });
    el.selection = undefined;
    await settle(el);
    await click(el, 4, { ctrlKey: true });
    expect(el.selection).toEqual(['p2', 'p4']);
  });

  test('ids stay when the data changes, and show again when their rows return', async () => {
    const data = people(10);
    const el = await fixture({ columns, data, getRowId, selectionMode: 'multi' });
    await click(el, 4);
    el.data = data.slice(0, 3);
    await settle(el);
    expect(el.selection).toEqual(['p4']);
    el.data = data;
    await settle(el);
    expect(selectedRows(el)).toEqual([4]);
  });
});

describe('selection: keyboard', () => {
  async function table(count = 50) {
    const el = await fixture({ columns, data: people(count), getRowId, selectionMode: 'multi' });
    return { el, seen: changes(el) };
  }

  test('Space toggles the focused row, without scrolling', async () => {
    const { el, seen } = await table();
    cellAt(el, 2).focus();
    expect((await key(el, ' ')).defaultPrevented).toBe(true);
    expect((await key(el, ' ', { shiftKey: true })).defaultPrevented).toBe(true);
    expect(seen).toEqual([['p2'], []]);
  });

  test('Shift+Arrow moves focus and selects from the anchor', async () => {
    const { el } = await table();
    cellAt(el, 3, 'age').focus();
    await key(el, 'ArrowDown', { shiftKey: true });
    await key(el, 'ArrowDown', { shiftKey: true });
    expect(el.selection).toEqual(['p3', 'p4', 'p5']);
    expect(focused(el)).toBe(cellAt(el, 5, 'age'));
    await key(el, 'ArrowUp', { shiftKey: true });
    expect(el.selection).toEqual(['p3', 'p4']);
    // Back past the anchor: the range turns around.
    await key(el, 'ArrowUp', { shiftKey: true });
    await key(el, 'ArrowUp', { shiftKey: true });
    expect(el.selection).toEqual(['p2', 'p3']);
  });

  test('Shift+Arrow starts from the last toggled row', async () => {
    const { el } = await table();
    cellAt(el, 6).focus();
    await key(el, ' ');
    await key(el, 'ArrowDown');
    await key(el, 'ArrowDown');
    await key(el, 'ArrowDown', { shiftKey: true });
    expect(el.selection).toEqual(['p6', 'p7', 'p8', 'p9']);
  });

  test('Shift+ArrowUp stops at the first body row', async () => {
    const { el } = await table();
    cellAt(el, 0).focus();
    await key(el, 'ArrowUp', { shiftKey: true });
    expect(focused(el)).toBe(cellAt(el, 0));
    expect(el.selection).toEqual([]);
  });

  test('Shift+PageDown selects a page of rows', async () => {
    const { el } = await table(200);
    cellAt(el, 0).focus();
    await key(el, 'PageDown', { shiftKey: true });
    const at = Number(focused(el)?.parentElement?.getAttribute('aria-rowindex')) - 2;
    expect(at).toBeGreaterThan(3);
    expect(el.selection).toHaveLength(at + 1);
    expect(el.selection[at]).toBe(`p${String(at)}`);
  });

  test('Ctrl or Cmd+A selects every row, from a cell or the header', async () => {
    const { el } = await table(300);
    cellAt(el, 0).focus();
    expect((await key(el, 'a', { ctrlKey: true })).defaultPrevented).toBe(true);
    expect(el.selection).toHaveLength(300);
    el.selection = undefined;
    await click(el, 0);
    shadow(el).querySelector<HTMLElement>('[role="columnheader"]')?.focus();
    expect((await key(el, 'A', { metaKey: true })).defaultPrevented).toBe(true);
    expect(el.selection).toHaveLength(300);
  });

  test('keys in content inside a cell are left alone', async () => {
    const withInput: ColumnDef<Person>[] = [
      { id: 'name', header: 'Name', cell: () => html`<input aria-label="Name" />` },
    ];
    const el = await fixture({
      columns: withInput,
      data: people(5),
      getRowId,
      selectionMode: 'multi',
    });
    const input = cellAt(el, 1)
      .querySelector('slot')
      ?.assignedElements({ flatten: true })[0]
      ?.querySelector('input');
    if (!input) throw new Error('no input');
    input.focus();
    expect(press(input, ' ').defaultPrevented).toBe(false);
    expect(press(input, 'a', { ctrlKey: true }).defaultPrevented).toBe(false);
    await settle(el);
    expect(el.selection).toEqual([]);
  });
});

describe('selection: pinned rows and dataSource', () => {
  test('pinned rows are not selectable', async () => {
    const el = await fixture({
      columns,
      data: people(10),
      getRowId,
      selectionMode: 'multi',
      pinnedRows: { bottom: [{ id: 'total', name: 'Total', age: 0, address: { city: '' } }] },
    });
    const pinned = shadow(el).querySelector<HTMLElement>('[part~="row-pinned"]');
    const cell = pinned?.querySelector<HTMLElement>('[data-col="name"]');
    if (!pinned || !cell) throw new Error('no pinned row');
    expect(pinned.hasAttribute('aria-selected')).toBe(false);
    cell.click();
    cell.focus();
    press(cell, ' ');
    await settle(el);
    expect(el.selection).toEqual([]);
  });

  describe('with a dataSource', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    test('only loaded rows can be selected, and Ctrl+A selects the loaded ones', async () => {
      const all = people(1000);
      let answer: (() => void) | undefined;
      const source: DataSource<Person> = {
        pageSize: 20,
        getRows: ({ start, end }) =>
          new Promise((resolve) => {
            answer = () => {
              resolve({ rows: all.slice(start, end), total: all.length });
            };
          }),
      };
      const el = await fixture({ columns, dataSource: source, getRowId, selectionMode: 'multi' });
      await settle(el);
      vi.advanceTimersByTime(LOAD_DEBOUNCE_MS);
      await settle(el);
      // Still loading: skeleton rows, nothing to select.
      expect(rowsInOrder(el)[0]?.hasAttribute('aria-selected')).toBe(false);
      await click(el, 0);
      expect(el.selection).toEqual([]);
      answer?.();
      await Promise.resolve();
      await settle(el);
      vi.advanceTimersByTime(LOAD_DEBOUNCE_MS);
      await settle(el);
      expect(rowsInOrder(el)[0]?.getAttribute('aria-selected')).toBe('false');
      cellAt(el, 0).focus();
      await key(el, 'a', { ctrlKey: true });
      expect(el.selection).toEqual(all.slice(0, 20).map((p) => p.id));
    });
  });
});

describe('selection: checkbox column', () => {
  const SELECT = '--argus-selection';

  async function table(props: Partial<ArgusTable<Person>> = {}) {
    const el = await fixture({
      columns,
      data: people(20),
      getRowId,
      selectionMode: 'multi',
      selectionCheckboxes: true,
      ...props,
    });
    return { el, seen: changes(el) };
  }

  const headers = (el: HTMLElement) => [
    ...shadow(el).querySelectorAll<HTMLElement>('[role="columnheader"]'),
  ];
  const checkAll = (el: HTMLElement) =>
    shadow(el).querySelector<HTMLInputElement>('[part~="header-cell-selection"] input');
  const checkbox = (el: HTMLElement, row: number) =>
    cellAt(el, row, SELECT).querySelector<HTMLInputElement>('input');

  test('comes first, only with a selectionMode, and leaves the light DOM alone', async () => {
    const el = await fixture({ columns, data: people(5), getRowId, selectionCheckboxes: true });
    expect(headers(el).map((h) => h.dataset.col)).toEqual(['name', 'age', 'city']);
    const lightDom = el.children.length;
    el.selectionMode = 'single';
    await settle(el);
    expect(headers(el).map((h) => [h.dataset.col, h.getAttribute('aria-colindex')])).toEqual([
      [SELECT, '1'],
      ['name', '2'],
      ['age', '3'],
      ['city', '4'],
    ]);
    expect(el.children.length).toBe(lightDom);
    expect(cellAt(el, 0, SELECT).part.contains('cell-selection')).toBe(true);
    expect(cellAt(el, 0, SELECT).part.contains('cell-pinned')).toBe(true);
    // Single mode: no select-all.
    expect(checkAll(el)).toBeNull();
    expect(checkbox(el, 0)?.part.contains('selection-checkbox')).toBe(true);
  });

  test('a checkbox toggles its row, keeps the others, and fires no click events', async () => {
    const { el, seen } = await table();
    const clicks: string[] = [];
    el.addEventListener('argus-cell-click', () => clicks.push('cell'));
    el.addEventListener('argus-row-click', () => clicks.push('row'));
    checkbox(el, 1)?.click();
    await settle(el);
    checkbox(el, 4)?.click();
    await settle(el);
    expect(seen).toEqual([['p1'], ['p1', 'p4']]);
    expect(checkbox(el, 4)?.checked).toBe(true);
    expect(checkbox(el, 2)?.checked).toBe(false);
    checkbox(el, 1)?.click();
    await settle(el);
    expect(el.selection).toEqual(['p4']);
    expect(checkbox(el, 1)?.checked).toBe(false);
    expect(clicks).toEqual([]);
  });

  test('Shift on a checkbox adds the range from the anchor', async () => {
    const { el } = await table();
    checkbox(el, 2)?.click();
    await settle(el);
    await click(el, 9, { ctrlKey: true });
    checkbox(el, 5)?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, shiftKey: true }),
    );
    await settle(el);
    expect(el.selection).toEqual(['p2', 'p9', 'p5', 'p6', 'p7', 'p8']);
  });

  test('a click beside the checkbox toggles too', async () => {
    const { el } = await table();
    await click(el, 1);
    cellAt(el, 3, SELECT).click();
    await settle(el);
    expect(el.selection).toEqual(['p1', 'p3']);
  });

  test('the header checkbox selects all, shows some, and clears all', async () => {
    const { el } = await table();
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: false });
    checkbox(el, 3)?.click();
    await settle(el);
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: true });
    checkAll(el)?.click();
    await settle(el);
    expect(el.selection).toHaveLength(20);
    expect(el.selection[0]).toBe('p3');
    expect(checkAll(el)).toMatchObject({ checked: true, indeterminate: false });
    checkAll(el)?.click();
    await settle(el);
    expect(el.selection).toEqual([]);
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: false });
  });

  test('Space on the checkbox cells toggles the row, or all rows from the header', async () => {
    const { el } = await table();
    const header = headers(el)[0];
    header?.focus();
    await key(el, ' ');
    expect(el.selection).toHaveLength(20);
    await key(el, ' ');
    expect(el.selection).toEqual([]);
    cellAt(el, 2, SELECT).focus();
    await key(el, ' ');
    expect(el.selection).toEqual(['p2']);
  });

  test('a press on a checkbox keeps focus on its cell', async () => {
    const { el } = await table();
    const down = new MouseEvent('mousedown', { bubbles: true, composed: true, cancelable: true });
    checkbox(el, 2)?.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(focused(el)).toBe(cellAt(el, 2, SELECT));
  });

  test('a controlled host that turns a change down keeps the box unticked', async () => {
    const { el, seen } = await table({ selection: [] });
    checkbox(el, 1)?.click();
    await settle(el);
    expect(seen).toEqual([['p1']]);
    expect(checkbox(el, 1)?.checked).toBe(false);
    checkAll(el)?.click();
    await settle(el);
    expect(checkAll(el)?.checked).toBe(false);
  });

  test('stays out of columnOrder, columnSizing and moves', async () => {
    const pinned: ColumnDef<Person>[] = [
      { id: 'name', header: 'Name', accessor: 'name', pin: 'start', width: 120 },
      ...columns.slice(1),
    ];
    const { el } = await table({ columns: pinned });
    const name = headers(el)[1];
    name?.focus();
    await key(el, 'ArrowLeft', { altKey: true, shiftKey: true });
    expect(headers(el).map((h) => h.dataset.col)).toEqual([SELECT, 'name', 'age', 'city']);
    expect(el.columnOrder).toEqual([]);
    await key(el, 'ArrowRight', { altKey: true, shiftKey: true });
    await el.autosizeColumns();
    expect(el.columnOrder).not.toContain(SELECT);
    expect(Object.keys(el.columnSizing)).not.toContain(SELECT);
  });

  test('pins to the start edge before the other start-pinned columns, in LTR and RTL', async () => {
    // Wide enough to scroll sideways, so the pinned cells have to stick.
    const pinned: ColumnDef<Person>[] = [
      { id: 'name', header: 'Name', accessor: 'name', pin: 'start', width: 120 },
      { id: 'age', header: 'Age', accessor: 'age', width: 500 },
      { id: 'city', header: 'City', accessor: 'address.city', width: 500 },
    ];
    for (const dir of ['ltr', 'rtl']) {
      const { el } = await table({ columns: pinned, dir });
      const scroller = shadow(el).querySelector<HTMLElement>('[part~="table"]');
      if (!scroller) throw new Error('no scroller');
      scroller.scrollLeft = dir === 'rtl' ? -200 : 200;
      await settle(el);
      expect(Math.abs(scroller.scrollLeft)).toBe(200);
      // The content box: a vertical scrollbar sits on the left in RTL.
      const left = scroller.getBoundingClientRect().left + scroller.clientLeft;
      const right = left + scroller.clientWidth;
      const select = cellAt(el, 0, SELECT).getBoundingClientRect();
      const name = cellAt(el, 0, 'name').getBoundingClientRect();
      if (dir === 'ltr') {
        expect(select.left).toBeCloseTo(left, 0);
        expect(name.left).toBeCloseTo(select.right, 0);
      } else {
        expect(select.right).toBeCloseTo(right, 0);
        expect(name.right).toBeCloseTo(select.left, 0);
      }
      el.remove();
    }
  });
});

describe('selection: select all keeps what is selected', () => {
  test('Ctrl+A adds every row to ids already selected elsewhere', async () => {
    const el = await fixture({
      columns,
      data: people(5),
      getRowId,
      selectionMode: 'multi',
      selection: ['gone'],
    });
    // Hand it back: uncontrolled, keeping ['gone'].
    el.selection = undefined;
    await settle(el);
    cellAt(el, 0).focus();
    await key(el, 'a', { ctrlKey: true });
    expect(el.selection).toEqual(['gone', 'p0', 'p1', 'p2', 'p3', 'p4']);
  });
});

describe('selection: checkbox column with a dataSource', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('a failed page puts its Retry button in the first data column', async () => {
    const source: DataSource<Person> = {
      pageSize: 20,
      getRows: () => Promise.reject(new Error('down')),
    };
    const el = await fixture({
      columns,
      dataSource: source,
      getRowId,
      selectionMode: 'multi',
      selectionCheckboxes: true,
    });
    el.addEventListener('argus-load-error', () => undefined);
    await settle(el);
    vi.advanceTimersByTime(LOAD_DEBOUNCE_MS);
    await settle(el);
    await Promise.resolve();
    await settle(el);
    const retry = shadow(el).querySelector('[part~="retry"]');
    expect(retry?.parentElement?.dataset.col).toBe('name');
    // No checkbox for a row that can't be selected.
    expect(cellAt(el, 0, '--argus-selection').querySelector('input')).toBeNull();
  });
});
