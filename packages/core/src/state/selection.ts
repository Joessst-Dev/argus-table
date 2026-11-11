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
