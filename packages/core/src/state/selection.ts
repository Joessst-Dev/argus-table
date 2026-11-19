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
 * The rows the filters keep, as a tree of ids, for selecting whole branches,
 * with each row's children in the whole tree for the rule that a parent's id
 * is selected only with its whole branch. Rows outside it (unknown, or dropped
 * by a filter) have no kept children and no parent.
 */
export interface BranchTree {
  /** A row's kept children, in row order. */
  children(id: string): readonly string[];
  /** A row's children in the whole tree, filters not applied, in any order. */
  allChildren(id: string): readonly string[];
  /** A row's parent; `undefined` for a top-level row or one outside the tree. */
  parent(id: string): string | undefined;
}

/**
 * A row's checkbox with branches: `'all'` when the row and every kept
 * descendant are selected, `'some'` when any of them is, else `'none'`;
 * `'blocked'` when ticking it could select nothing (its id is kept out by
 * descendants left unselected, and none of its kept descendants can be
 * ticked: a parent the filters keep without its children, for one).
 */
export type BranchCheck = 'all' | 'some' | 'none' | 'blocked';

/**
 * `current` plus each of `ids` with all its kept descendants, where a parent's
 * own id is added only when its whole branch is selected, filters not applied:
 * descendants the filters hide are never selected here, so a parent with one
 * of them unselected stays out (and its ancestors with it). Then, from each of
 * `ids` up, each ancestor whose children are now all selected, up to the
 * first that has one left unselected. That one and every ancestor above it
 * aren't whole branches, so those that are selected (a value set against the
 * rules) lose their ids, as do selected parents in the branches walked: what
 * the user changes comes back normalized. Keeps `current`'s order and appends
 * the new ids. Iterative, so a deep tree can't overflow the stack; linear in
 * the branches walked and the children of the parents reached.
 */
export function withBranches(
  current: readonly string[],
  ids: readonly string[],
  tree: BranchTree,
): SelectionState {
  const have = new Set(current);
  const added: string[] = [];
  const whole = (id: string): boolean => tree.allChildren(id).every((child) => have.has(child));

  // Down: each id's kept branch, each row walked once, then its ids from the
  // bottom up (children before parents), each parent's only if it's whole.
  const walked = new Set<string>();
  const roots: string[] = [];
  for (const id of ids) {
    if (walked.has(id)) continue;
    roots.push(id);
    const order: string[] = [];
    const stack = [id];
    while (stack.length > 0) {
      const row = stack.pop() ?? '';
      if (walked.has(row)) continue;
      walked.add(row);
      order.push(row);
      for (const child of tree.children(row)) stack.push(child);
    }
    const fresh: string[] = [];
    for (let k = order.length - 1; k >= 0; k--) {
      const row = order[k] ?? '';
      if (!whole(row)) have.delete(row);
      else if (!have.has(row)) {
        have.add(row);
        fresh.push(row);
      }
    }
    // Appended in walk order, parents first.
    for (let k = fresh.length - 1; k >= 0; k--) added.push(fresh[k] ?? '');
  }

  // Up from the roots of the walks (a root under another walk was counted
  // there): a row's unselected children are counted when first reached, and
  // the count drops as its children join, so no row is counted twice.
  const tops = roots.filter((id) => {
    const up = tree.parent(id);
    return up === undefined || !walked.has(up);
  });
  const missing = new Map<string, number>();
  const complete = new Set<string>();
  for (const id of tops) {
    for (let up = tree.parent(id); up !== undefined; up = tree.parent(up)) {
      // Reached from another child before: everything above it is done.
      if (complete.has(up)) break;
      let left = missing.get(up);
      if (left === undefined) {
        left = 0;
        for (const child of tree.allChildren(up)) if (!have.has(child)) left++;
        missing.set(up, left);
      }
      if (left > 0) break;
      complete.add(up);
      if (have.has(up)) continue;
      have.add(up);
      added.push(up);
      const above = tree.parent(up);
      const count = above === undefined ? undefined : missing.get(above);
      if (above !== undefined && count !== undefined) missing.set(above, count - 1);
    }
  }

  // Up again, dropping selected ancestors above the first incomplete one. Each
  // row is passed once while complete and once above an incomplete one.
  const passed = new Set<string>();
  const broken = new Set<string>();
  for (const id of tops) {
    let intact = true;
    for (let up = tree.parent(id); up !== undefined; up = tree.parent(up)) {
      if (intact && complete.has(up)) {
        if (passed.has(up)) break;
        passed.add(up);
        continue;
      }
      intact = false;
      if (broken.has(up)) break;
      broken.add(up);
      have.delete(up);
    }
  }
  return [...current, ...added].filter((id) => have.has(id));
}

/**
 * A click on a row's checkbox with branches. When the row counts as checked,
 * deselects it, its kept descendants and its ancestors, since a parent stays
 * selected only with its whole branch; otherwise selects the branch
 * (`withBranches`). Checked, from the bottom up: every kept descendant that
 * can be ticked (isn't blocked, see `BranchCheck`) is checked, and the row's
 * own id is selected, or is kept out by a descendant left unselected while
 * something below can be ticked (a parent whose shown rows are all selected
 * under a filter, at any depth: its checkbox is part-ticked, and a click
 * unticks it). A blocked row itself is never checked, and ticking it selects
 * nothing. Descendants the filters hide are left as they are. O(branch) beyond
 * `selected`, which is `current` as a set (made here when not given).
 */
export function toggleBranch(
  current: readonly string[],
  id: string,
  tree: BranchTree,
  selected: ReadonlySet<string> = new Set(current),
): SelectionState {
  const has = (row: string) => selected.has(row);
  // The kept branch, preorder.
  const order: string[] = [];
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const row = stack.pop() ?? '';
    if (seen.has(row)) continue;
    seen.add(row);
    order.push(row);
    for (const child of tree.children(row)) stack.push(child);
  }
  // From the bottom up: rows blocked, rows not checked, and rows with
  // something unselected in their branch (themselves included).
  const blocked = new Set<string>();
  const unmet = new Set<string>();
  const gap = new Set<string>();
  for (let k = order.length - 1; k >= 0; k--) {
    const row = order[k] ?? '';
    const own = has(row);
    const kids = tree.children(row);
    const live = kids.some((kid) => !blocked.has(kid));
    const below = kids.some((kid) => gap.has(kid));
    const out = below || !tree.allChildren(row).every(has);
    // At any depth, as `branchCheck`'s marks: a selected row over an
    // unselected one (a value set against the rules) has a gap too.
    if (!own || below) gap.add(row);
    if (!own && !live && out) blocked.add(row);
    else if (kids.some((kid) => unmet.has(kid)) || !(own || (live && out))) unmet.add(row);
  }
  if (blocked.has(id) || unmet.has(id)) return withBranches(current, [id], tree);
  const drop = new Set(order);
  for (let up = tree.parent(id); up !== undefined && !drop.has(up); up = tree.parent(up)) {
    drop.add(up);
  }
  return current.filter((s) => !drop.has(s));
}
