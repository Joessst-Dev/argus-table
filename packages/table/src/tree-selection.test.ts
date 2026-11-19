import { afterEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { ArgusTable } from './argus-table.js';
import type { ColumnDef, SelectionState } from './index.js';
import { fixture, rowText, rowsInOrder, settle, shadow } from './test-utils.js';

interface Item {
  name: string;
  kids?: Item[];
}

/** `count` parents with three children each: `P0` (id `0`) with `C0.0` (id `0.0`), `C0.1`, `C0.2`, and so on. */
function tree(count = 3): Item[] {
  return Array.from({ length: count }, (_, p) => ({
    name: `P${String(p)}`,
    kids: [0, 1, 2].map((c) => ({ name: `C${String(p)}.${String(c)}` })),
  }));
}

const columns: ColumnDef<Item>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 200 },
  { id: 'size', header: 'Size', accessor: (r) => r.name.length, width: 100 },
];

const SELECT = '--argus-selection';

/** A tree table in `multi` mode with checkboxes and branch selection. */
function treeTable(props: Partial<ArgusTable<Item>> = {}) {
  return fixture<Item>({
    columns,
    data: tree(),
    getSubRows: (r) => r.kids,
    selectionMode: 'multi',
    selectionCheckboxes: true,
    selectBranches: true,
    ...props,
  });
}

/** The body row showing `name` in a cell. */
function rowOf(el: HTMLElement, name: string): HTMLElement {
  const row = rowsInOrder(el).find((r) => rowText(r).includes(name));
  if (!row) throw new Error(`no row ${name}`);
  return row;
}

function cellOf(el: HTMLElement, name: string, col = 'name'): HTMLElement {
  const cell = rowOf(el, name).querySelector<HTMLElement>(`[data-col="${col}"]`);
  if (!cell) throw new Error(`no ${col} cell in ${name}`);
  return cell;
}

function checkbox(el: HTMLElement, name: string): HTMLInputElement {
  const box = cellOf(el, name, SELECT).querySelector<HTMLInputElement>('input');
  if (!box) throw new Error(`no checkbox in ${name}`);
  return box;
}

const checkAll = (el: HTMLElement) =>
  shadow(el).querySelector<HTMLInputElement>('[part~="header-cell-selection"] input');

/** Ticks a row's checkbox (with modifier keys) and waits for the update. */
async function tick(el: ArgusTable<Item>, name: string, init: MouseEventInit = {}) {
  checkbox(el, name).dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ...init }),
  );
  await settle(el);
}

/** Clicks a row's name cell (with modifier keys) and waits for the update. */
async function click(el: ArgusTable<Item>, name: string, init: MouseEventInit = {}) {
  cellOf(el, name).dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ...init }),
  );
  await settle(el);
}

/** Presses a key on a cell and waits for the update. */
async function press(el: ArgusTable<Item>, cell: HTMLElement, key: string, init = {}) {
  cell.focus();
  cell.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }),
  );
  await settle(el);
}

/** A selection as a sorted list, to compare without order. */
const sorted = (ids: readonly string[]) => [...ids].sort();

/** Collects `argus-selection-change` details. */
function changes(el: HTMLElement) {
  const seen: SelectionState[] = [];
  el.addEventListener('argus-selection-change', (e) => seen.push(e.detail.selection));
  return seen;
}

const ALL = ['0', '0.0', '0.1', '0.2', '1', '1.0', '1.1', '1.2', '2', '2.0', '2.1', '2.2'];

afterEach(() => {
  document.body.replaceChildren();
});

describe('tree rows: branch selection', () => {
  test('ticking a parent selects its branch', async () => {
    const el = await treeTable();
    const seen = changes(el);
    // P0 is collapsed: its children are selected all the same.
    await tick(el, 'P0');
    expect(sorted(el.selection)).toEqual(['0', '0.0', '0.1', '0.2']);
    expect(seen).toHaveLength(1);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: true, indeterminate: false });
    expect(rowOf(el, 'P0').getAttribute('aria-selected')).toBe('true');
    el.treeExpanded = ['0'];
    await settle(el);
    expect(checkbox(el, 'C0.1')).toMatchObject({ checked: true, indeterminate: false });
    // Unticking deselects the branch.
    await tick(el, 'P0');
    expect(el.selection).toEqual([]);
  });

  test('ticking the last child adds the parent; unticking a child removes it', async () => {
    const el = await treeTable({ treeExpanded: ['0'] });
    await tick(el, 'C0.0');
    await tick(el, 'C0.1');
    expect(sorted(el.selection)).toEqual(['0.0', '0.1']);
    await tick(el, 'C0.2');
    expect(sorted(el.selection)).toEqual(['0', '0.0', '0.1', '0.2']);
    await tick(el, 'C0.1');
    expect(sorted(el.selection)).toEqual(['0.0', '0.2']);
    expect(rowOf(el, 'P0').getAttribute('aria-selected')).toBe('false');
  });

  test('a partly selected branch shows a part-ticked checkbox', async () => {
    const el = await treeTable({ treeExpanded: ['0'] });
    await tick(el, 'C0.0');
    expect(checkbox(el, 'P0')).toMatchObject({ checked: false, indeterminate: true });
    expect(checkbox(el, 'C0.0')).toMatchObject({ checked: true, indeterminate: false });
    expect(checkbox(el, 'P1')).toMatchObject({ checked: false, indeterminate: false });
    // A part-ticked box selects the rest of the branch.
    await tick(el, 'P0');
    expect(sorted(el.selection)).toEqual(['0', '0.0', '0.1', '0.2']);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: true, indeterminate: false });
  });

  test('a controlled value against the rules shows as it is', async () => {
    const el = await treeTable({ selection: ['0'], treeExpanded: ['0'] });
    expect(checkbox(el, 'P0')).toMatchObject({ checked: false, indeterminate: true });
    expect(checkbox(el, 'C0.0')).toMatchObject({ checked: false, indeterminate: false });
    expect(rowOf(el, 'P0').getAttribute('aria-selected')).toBe('true');
  });

  test("under a filter, ticking a parent selects only kept children, not the parent's id", async () => {
    const el = await treeTable({ quickFilter: 'C0.1' });
    await tick(el, 'P0');
    expect(el.selection).toEqual(['0.1']);
    // C0.0 and C0.2 aren't selected, so P0 isn't whole: part-ticked.
    expect(checkbox(el, 'P0')).toMatchObject({ checked: false, indeterminate: true });
    expect(checkbox(el, 'C0.1')).toMatchObject({ checked: true, indeterminate: false });
    expect(rowOf(el, 'P0').getAttribute('aria-selected')).toBe('false');
    // Cleared, the filter leaves P0 part-ticked, its id out of the selection.
    el.quickFilter = '';
    await settle(el);
    expect(el.selection).toEqual(['0.1']);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: false, indeterminate: true });
  });

  test('under a filter, a part-ticked parent with its shown rows selected unticks, then ticks', async () => {
    const el = await treeTable({ quickFilter: 'C0.1' });
    const seen = changes(el);
    await tick(el, 'P0');
    await tick(el, 'P0');
    expect(el.selection).toEqual([]);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: false, indeterminate: false });
    await press(el, cellOf(el, 'P0'), ' ');
    expect(el.selection).toEqual(['0.1']);
    expect(seen).toEqual([['0.1'], [], ['0.1']]);
  });

  test('under a filter, the parent joins once the rows the filter hides are selected', async () => {
    // Controlled: the proposed selection is the event's.
    const el = await treeTable({ selection: ['0.0', '0.2'], quickFilter: 'C0.1' });
    const seen = changes(el);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: false, indeterminate: false });
    await tick(el, 'P0');
    expect(seen.map(sorted)).toEqual([['0', '0.0', '0.1', '0.2']]);
    el.selection = seen[0] ?? [];
    await settle(el);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: true, indeterminate: false });
  });

  test('under a filter, select-all and the header checkbox count whole branches only', async () => {
    const el = await treeTable({ quickFilter: 'C0.1' });
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: false });
    await press(el, cellOf(el, 'P0'), 'a', { ctrlKey: true });
    expect(el.selection).toEqual(['0.1']);
    // Every shown row counts as checked: P0's shown rows are all selected.
    expect(checkAll(el)).toMatchObject({ checked: true, indeterminate: false });
    expect(checkbox(el, 'P0')).toMatchObject({ checked: false, indeterminate: true });
    checkAll(el)?.click();
    await settle(el);
    expect(el.selection).toEqual([]);
    checkAll(el)?.click();
    await settle(el);
    expect(el.selection).toEqual(['0.1']);
    // Without the filter, it's part of the rows.
    el.quickFilter = '';
    await settle(el);
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: true });
  });

  test('unticking a parent under a filter leaves the rows it hides selected', async () => {
    const el = await treeTable();
    await tick(el, 'P0');
    el.quickFilter = 'C0.1';
    await settle(el);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: true, indeterminate: false });
    await tick(el, 'P0');
    expect(sorted(el.selection)).toEqual(['0.0', '0.2']);
  });

  test('select-all covers whole branches', async () => {
    const el = await treeTable();
    await press(el, cellOf(el, 'P1'), 'a', { ctrlKey: true });
    expect(sorted(el.selection)).toEqual(ALL);
    expect(checkAll(el)).toMatchObject({ checked: true, indeterminate: false });
    // The header checkbox clears, and selects all again.
    checkAll(el)?.click();
    await settle(el);
    expect(el.selection).toEqual([]);
    checkAll(el)?.click();
    await settle(el);
    expect(sorted(el.selection)).toEqual(ALL);
  });

  test('the header checkbox counts rows under collapsed parents', async () => {
    const el = await treeTable({ selection: ['1.2'] });
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: true });
    // Every shown row selected isn't all of them.
    el.selection = ['0', '1', '2'];
    await settle(el);
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: true });
  });

  test('a plain click and Shift ranges count each row as its branch', async () => {
    const el = await treeTable();
    await click(el, 'P1');
    expect(sorted(el.selection)).toEqual(['1', '1.0', '1.1', '1.2']);
    await click(el, 'P2', { shiftKey: true });
    expect(sorted(el.selection)).toEqual(['1', '1.0', '1.1', '1.2', '2', '2.0', '2.1', '2.2']);
    // A plain click on a child selects it alone.
    el.treeExpanded = ['0'];
    await settle(el);
    await click(el, 'C0.1');
    expect(el.selection).toEqual(['0.1']);
  });

  test('Ctrl/Cmd toggles a branch; Ctrl+Shift adds the range', async () => {
    const el = await treeTable({ treeExpanded: ['0'] });
    await click(el, 'C0.0');
    await click(el, 'P1', { ctrlKey: true });
    expect(sorted(el.selection)).toEqual(['0.0', '1', '1.0', '1.1', '1.2']);
    await click(el, 'P1', { metaKey: true });
    expect(el.selection).toEqual(['0.0']);
    // The anchor is P1 now: P1 and P2 with their branches join C0.0.
    await click(el, 'P2', { ctrlKey: true, shiftKey: true });
    expect(sorted(el.selection)).toEqual([
      '0.0',
      '1',
      '1.0',
      '1.1',
      '1.2',
      '2',
      '2.0',
      '2.1',
      '2.2',
    ]);
  });

  test('Space toggles a branch, Shift+Arrow selects branches', async () => {
    const el = await treeTable();
    await press(el, cellOf(el, 'P0'), ' ');
    expect(sorted(el.selection)).toEqual(['0', '0.0', '0.1', '0.2']);
    await press(el, cellOf(el, 'P0'), ' ');
    expect(el.selection).toEqual([]);
    // From the anchor, P0, to P1.
    await press(el, cellOf(el, 'P0'), 'ArrowDown', { shiftKey: true });
    expect(sorted(el.selection)).toEqual(['0', '0.0', '0.1', '0.2', '1', '1.0', '1.1', '1.2']);
  });

  test('controlled: the proposed ids are normalized, and nothing changes until set', async () => {
    const el = await treeTable({ selection: [], treeExpanded: ['0'] });
    const seen = changes(el);
    await tick(el, 'P0');
    expect(seen.map(sorted)).toEqual([['0', '0.0', '0.1', '0.2']]);
    expect(el.selection).toEqual([]);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: false, indeterminate: false });
    el.selection = ['0.0', '0.1'];
    await settle(el);
    await tick(el, 'C0.2');
    expect(seen.map(sorted)[1]).toEqual(['0', '0.0', '0.1', '0.2']);
    expect(el.selection).toEqual(['0.0', '0.1']);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: false, indeterminate: true });
  });

  test('controlled: a real click on a part-ticked box shows it part-ticked again', async () => {
    const el = await treeTable({ selection: ['0.0'], treeExpanded: ['0'] });
    const seen = changes(el);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: false, indeterminate: true });
    await userEvent.click(checkbox(el, 'P0'));
    await settle(el);
    expect(seen.map(sorted)).toEqual([['0', '0.0', '0.1', '0.2']]);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: false, indeterminate: true });
    expect(checkbox(el, 'C0.0')).toMatchObject({ checked: true, indeterminate: false });
  });

  test('turning selectBranches on and off updates the checkboxes', async () => {
    const el = await treeTable({ selection: ['1.2'] });
    expect(checkbox(el, 'P1')).toMatchObject({ checked: false, indeterminate: true });
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: true });
    el.selectBranches = false;
    await settle(el);
    // Rows count alone, and only the rows shown.
    expect(checkbox(el, 'P1')).toMatchObject({ checked: false, indeterminate: false });
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: false });
    el.selectBranches = true;
    await settle(el);
    expect(checkbox(el, 'P1')).toMatchObject({ checked: false, indeterminate: true });
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: true });
  });

  test('selects branches of flat data with getParentId', async () => {
    const flat = [
      { id: 'a', name: 'A', parent: null },
      { id: 'b', name: 'B', parent: 'a' },
      { id: 'c', name: 'C', parent: 'a' },
      { id: 'd', name: 'D', parent: null },
    ];
    const el = await fixture({
      columns: [{ id: 'name', header: 'Name', accessor: 'name' }],
      data: flat,
      getRowId: (r) => r.id,
      getParentId: (r) => r.parent,
      selectionMode: 'multi',
      selectionCheckboxes: true,
      selectBranches: true,
    });
    const box = (name: string) => {
      const input = cellOf(el, name, SELECT).querySelector<HTMLInputElement>('input');
      if (!input) throw new Error(`no checkbox in ${name}`);
      return input;
    };
    box('A').click();
    await settle(el);
    expect(sorted(el.selection)).toEqual(['a', 'b', 'c']);
    el.treeExpanded = ['a'];
    await settle(el);
    box('B').click();
    await settle(el);
    expect(el.selection).toEqual(['c']);
    expect(box('A')).toMatchObject({ checked: false, indeterminate: true });
    box('B').click();
    await settle(el);
    expect(sorted(el.selection)).toEqual(['a', 'b', 'c']);
  });

  test('without selectBranches nothing changes', async () => {
    const el = await treeTable({ selectBranches: false });
    await tick(el, 'P0');
    expect(el.selection).toEqual(['0']);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: true, indeterminate: false });
    await press(el, cellOf(el, 'P1'), 'a', { ctrlKey: true });
    expect(sorted(el.selection)).toEqual(['0', '1', '2']);
    expect(checkAll(el)).toMatchObject({ checked: true, indeterminate: false });
    el.treeExpanded = ['0'];
    await settle(el);
    expect(checkbox(el, 'P0')).toMatchObject({ checked: true, indeterminate: false });
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: true });
  });

  test('single mode ignores selectBranches', async () => {
    const el = await treeTable({ selectionMode: 'single' });
    await tick(el, 'P0');
    expect(el.selection).toEqual(['0']);
    await click(el, 'P1');
    expect(el.selection).toEqual(['1']);
  });
});
