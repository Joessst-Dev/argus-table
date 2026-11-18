import type { SelectionMode, SelectionState } from '../types.js';

/**
 * Row selection rules, DOM-free. The element owns the state (through
 * `controllable`) and the anchor; these functions only compute the next ones.
 *
 * The anchor is the row a range starts from: the last row clicked or toggled
 * without Shift. Ranges are by index in the current row order, so they follow
 * sorting; `idAt` returns `undefined` for a row that can't be selected (a
 * `dataSource` row not loaded), and such rows are left out.
 */

/** The selection after a step, and the row later ranges start from. */
export interface SelectionStep {
  selection: SelectionState;
  anchor: string | undefined;
}

/** The row a click or key acts on: its id and its index in the current row order. */
export interface SelectionTarget {
  id: string;
  index: number;
}

/** Modifier keys of a click: Ctrl or Cmd toggles, Shift selects a range. */
export interface SelectionModifiers {
  toggle: boolean;
  range: boolean;
}

/** Whether two selections hold the same ids, in any order. */
export function sameSelection(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a);
  return b.every((id) => ids.has(id));
}

/**
 * Selects or deselects one row and makes it the anchor. In `'single'` mode,
 * selecting a row replaces the selection.
 */
export function toggleRow(
  current: readonly string[],
  mode: SelectionMode,
  id: string,
): SelectionStep | undefined {
  if (mode === 'none') return undefined;
  if (current.includes(id)) return { selection: current.filter((s) => s !== id), anchor: id };
  return { selection: mode === 'single' ? [id] : [...current, id], anchor: id };
}

/**
 * The rows from index `from` to `to` (either order, both inclusive), in row
 * order. With `add`, they join the current selection instead of replacing it.
 * The anchor stays where it was.
 */
export function selectRange(
  current: readonly string[],
  from: number,
  to: number,
  idAt: (index: number) => string | undefined,
  add: boolean,
): SelectionState {
  const ids: string[] = add ? [...current] : [];
  const have = new Set(ids);
  const first = Math.min(from, to);
  const last = Math.max(from, to);
  for (let index = first; index <= last; index++) {
    const id = idAt(index);
    if (id === undefined || have.has(id)) continue;
    have.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Every row of `ids` selected, keeping the rows already selected (with a
 * `dataSource`, `ids` are only the loaded rows: selected rows elsewhere stay).
 */
export function selectAll(current: readonly string[], ids: readonly string[]): SelectionState {
  const have = new Set(current);
  return [...current, ...ids.filter((id) => !have.has(id))];
}

/**
 * A click on a row, desktop style. A plain click selects only that row; Ctrl or
 * Cmd toggles it. In `'multi'` mode, Shift selects the range from the anchor
 * (at `anchorIndex`) to the row, and Ctrl+Shift adds that range. Without an
 * anchor in the current rows, Shift acts like a plain click. `undefined` in
 * `'none'` mode. The selection may come back unchanged (a click on the one
 * selected row): check with `sameSelection` before reporting a change.
 */
export function clickSelection(
  current: readonly string[],
  mode: SelectionMode,
  target: SelectionTarget,
  anchor: SelectionTarget | undefined,
  modifiers: SelectionModifiers,
  idAt: (index: number) => string | undefined,
): SelectionStep | undefined {
  if (mode === 'none') return undefined;
  if (mode === 'multi' && modifiers.range && anchor) {
    return {
      selection: selectRange(current, anchor.index, target.index, idAt, modifiers.toggle),
      anchor: anchor.id,
    };
  }
  if (modifiers.toggle) return toggleRow(current, mode, target.id);
  return { selection: [target.id], anchor: target.id };
}

/**
 * The rows the filters keep, as a tree of ids, for selecting whole branches.
 * Rows outside it (unknown, or dropped by a filter) have no children and no
 * parent.
 */
export interface BranchTree {
  /** A row's kept children, in row order. */
  children(id: string): readonly string[];
  /** A row's parent; `undefined` for a top-level row or one outside the tree. */
  parent(id: string): string | undefined;
}

/**
 * A row's checkbox with branches: `'all'` when the row and every kept
 * descendant are selected, `'some'` when any of them is, else `'none'`.
 */
export type BranchCheck = 'all' | 'some' | 'none';

const SELECTED = 1;
const WALKED = 2;

/**
 * `current` plus each of `ids` with all its kept descendants; then, from each
 * of `ids` up, each ancestor whose kept children are now all selected, up to
 * the first that has one left unselected. That one and every ancestor above it
 * aren't whole branches, so those that are selected (a value set against the
 * rules) lose their ids: what the user changes comes back normalized. Keeps
 * `current`'s order and appends the new ids. Iterative, so a deep tree can't
 * overflow the stack; linear in the rows added and the children of the
 * ancestors reached, whose unselected children are counted once per call.
 */
export function withBranches(
  current: readonly string[],
  ids: readonly string[],
  tree: BranchTree,
): SelectionState {
  const selection = [...current];
  // Selected rows: `SELECTED`, or `WALKED` once their descendants are added.
  const have = new Map<string, number>();
  for (const id of current) have.set(id, SELECTED);
  const add = (id: string): boolean => {
    if (have.has(id)) return false;
    have.set(id, SELECTED);
    selection.push(id);
    return true;
  };

  // Down: each id and its descendants, each row walked once.
  const stack: string[] = [];
  for (const id of ids) {
    stack.push(id);
    while (stack.length > 0) {
      const row = stack.pop() ?? '';
      const state = have.get(row);
      if (state === WALKED) continue;
      have.set(row, WALKED);
      if (state === undefined) selection.push(row);
      for (const child of tree.children(row)) stack.push(child);
    }
  }

  // Up: a row's unselected children are counted when first reached, and the
  // count drops as its children join, so no row is counted twice.
  const missing = new Map<string, number>();
  const complete = new Set<string>();
  for (const id of ids) {
    for (let up = tree.parent(id); up !== undefined; up = tree.parent(up)) {
      // Reached from another child before: everything above it is done.
      if (complete.has(up)) break;
      let left = missing.get(up);
      if (left === undefined) {
        left = 0;
        for (const child of tree.children(up)) if (!have.has(child)) left++;
        missing.set(up, left);
      }
      if (left > 0) break;
      complete.add(up);
      if (!add(up)) continue;
      const above = tree.parent(up);
      const count = above === undefined ? undefined : missing.get(above);
      if (above !== undefined && count !== undefined) missing.set(above, count - 1);
    }
  }

  // Up again, dropping selected ancestors above the first incomplete one. Each
  // row is passed once while complete and once above an incomplete one.
  const drop = new Set<string>();
  const passed = new Set<string>();
  const broken = new Set<string>();
  for (const id of ids) {
    let whole = true;
    for (let up = tree.parent(id); up !== undefined; up = tree.parent(up)) {
      if (whole && complete.has(up)) {
        if (passed.has(up)) break;
        passed.add(up);
        continue;
      }
      whole = false;
      if (broken.has(up)) break;
      broken.add(up);
      if (have.has(up)) drop.add(up);
    }
  }
  return drop.size === 0 ? selection : selection.filter((s) => !drop.has(s));
}

/**
 * A click on a row's checkbox with branches. `checked` (the checkbox shows
 * `'all'`): deselects the row, its kept descendants and its ancestors, since a
 * parent stays selected only with its whole branch. Otherwise selects the
 * branch (`withBranches`). Descendants the filters drop are left as they are.
 */
export function toggleBranch(
  current: readonly string[],
  id: string,
  checked: boolean,
  tree: BranchTree,
): SelectionState {
  if (!checked) return withBranches(current, [id], tree);
  const drop = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const row = stack.pop() ?? '';
    if (drop.has(row)) continue;
    drop.add(row);
    for (const child of tree.children(row)) stack.push(child);
  }
  for (let up = tree.parent(id); up !== undefined && !drop.has(up); up = tree.parent(up)) {
    drop.add(up);
  }
  return current.filter((s) => !drop.has(s));
}
