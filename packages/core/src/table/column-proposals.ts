import type { ResolvedColumn } from '../columns/resolve-columns.js';
import type {
  ColumnFilter,
  ColumnFilterState,
  ColumnPin,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  SortState,
} from '../types.js';
import { hiddenIn, pinIn } from './column-views.js';

/**
 * The model's `next*()` proposals for state the user changes through a
 * column: pure functions of the columns and the current state. `undefined`
 * when the change isn't allowed or changes nothing.
 */

type Columns<TData, TContent> = ReadonlyMap<string, ResolvedColumn<TData, TContent>>;

/** A sortable column's next sort: ascending, then descending, then none. */
export function nextSorting<TData, TContent>(
  byId: Columns<TData, TContent>,
  sorting: SortState,
  columnId: string,
): SortState | undefined {
  if (byId.get(columnId)?.sortable !== true) return undefined;
  const current = sorting.find((s) => s.id === columnId);
  if (!current) return [{ id: columnId, desc: false }];
  return current.desc ? [] : [{ id: columnId, desc: true }];
}

/** A resizable column's new width, clamped to its bounds and rounded. */
export function nextSizing<TData, TContent>(
  byId: Columns<TData, TContent>,
  sizing: ColumnSizingState | undefined,
  columnId: string,
  width: number,
): ColumnSizingState | undefined {
  const column = byId.get(columnId);
  if (!column?.resizable || !Number.isFinite(width)) return undefined;
  const clamped = Math.round(Math.min(column.maxWidth, Math.max(column.minWidth, width)));
  return { ...sizing, [columnId]: clamped };
}

export function nextPinning<TData, TContent>(
  byId: Columns<TData, TContent>,
  columnId: string,
  pin: ColumnPin | false,
  base: ColumnPinningState | undefined,
): ColumnPinningState | undefined {
  const column = byId.get(columnId);
  if (!column?.pinnable || (pinIn(column, base) ?? false) === pin) return undefined;
  return { ...base, [columnId]: pin };
}

/** Hides or shows a column; a column that can't be hidden, or the last shown one, stays. */
export function nextVisibility<TData, TContent>(
  resolved: readonly ResolvedColumn<TData, TContent>[],
  byId: Columns<TData, TContent>,
  columnId: string,
  hidden: boolean,
  base: ColumnVisibilityState | undefined,
): ColumnVisibilityState | undefined {
  const column = byId.get(columnId);
  if (!column || hiddenIn(column, base) === hidden) return undefined;
  const othersShown = resolved.some((c) => c !== column && !hiddenIn(c, base));
  if (hidden && (!column.hideable || !othersShown)) return undefined;
  return { ...base, [columnId]: !hidden };
}

/** Sets or (with `undefined`) clears a column's filter; only columns with a `filter` kind take one. */
export function nextFilters<TData, TContent>(
  byId: Columns<TData, TContent>,
  columnId: string,
  filter: ColumnFilter | undefined,
  base: ColumnFilterState,
): ColumnFilterState | undefined {
  const column = byId.get(columnId);
  if (!column) return undefined;
  const current = base[columnId];
  if (filter === undefined) {
    if (current === undefined) return undefined;
    const next = { ...base };
    Reflect.deleteProperty(next, columnId);
    return next;
  }
  if (column.filter === undefined) return undefined;
  if (current && JSON.stringify(current) === JSON.stringify(filter)) return undefined;
  return { ...base, [columnId]: filter };
}
