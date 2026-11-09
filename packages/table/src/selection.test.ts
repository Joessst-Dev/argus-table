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

/** Collects `argus-row-select` details. */
function changes(el: HTMLElement) {
  const seen: SelectionState[] = [];
  el.addEventListener('argus-row-select', (e) => seen.push(e.detail.selection));
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
    el.addEventListener('argus-row-select', () => {
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
    el.addEventListener('argus-row-select', () => order.push('selection'));
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
