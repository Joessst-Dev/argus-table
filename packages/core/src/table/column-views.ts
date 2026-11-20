import type { ResolvedColumn } from '../columns/resolve-columns.js';
import { spreadWidth } from '../columns/spread-width.js';
import type {
  ColumnOrderState,
  ColumnPin,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
} from '../types.js';
import {
  EXPAND_COLUMN_ID,
  EXPAND_COLUMN_WIDTH,
  SELECTION_COLUMN_ID,
  SELECTION_COLUMN_WIDTH,
  type ColumnView,
  type TableModelOptions,
} from './model-types.js';

type ById<TData, TContent> = ReadonlyMap<string, ResolvedColumn<TData, TContent>>;

/** The pin in effect: the state's, else the column's own. */
export function pinIn<TData, TContent>(
  column: ResolvedColumn<TData, TContent>,
  pinning: ColumnPinningState | undefined,
): ColumnPin | undefined {
  const state = pinning?.[column.id];
  if (state === 'start' || state === 'end') return state;
  return state === false ? undefined : column.pin;
}

/** Whether a column is hidden: the state's visibility, else the column's own. */
export function hiddenIn<TData, TContent>(
  column: ResolvedColumn<TData, TContent>,
  visibility: ColumnVisibilityState | undefined,
): boolean {
  const state = visibility?.[column.id];
  return typeof state === 'boolean' ? !state : column.hidden;
}

/**
 * The sizing state in effect: measured auto widths and the widths of pinned flex
 * columns under the resized ones.
 */
export function sizingOf<TData, TContent>(
  options: TableModelOptions<TData, TContent>,
  resolved: readonly ResolvedColumn<TData, TContent>[],
): ColumnSizingState {
  const auto = options.autoWidths;
  const merged: ColumnSizingState = {};
  let any = false;
  for (const column of resolved) {
    // A pinned column can't flex: it takes a fixed width for its sticky offsets.
    if (column.flex !== undefined && pinIn(column, options.columnPinning) !== undefined) {
      merged[column.id] = column.pinnedWidth;
      any = true;
    }
    const px = auto?.[column.id];
    if (!column.auto || px === undefined || !Number.isFinite(px)) continue;
    merged[column.id] = Math.min(column.maxWidth, Math.max(column.minWidth, px));
    any = true;
  }
  return any ? { ...merged, ...options.columnSizing } : options.columnSizing;
}

/**
 * The width in effect: the sizing state's (resized, measured, pinned flex), else
 * the column's own, within its bounds.
 */
function widthOf<TData, TContent>(
  byId: ById<TData, TContent>,
  sizing: ColumnSizingState,
  id: string,
): number {
  const column = byId.get(id);
  if (!column) return 0;
  const px = Object.hasOwn(sizing, id) ? sizing[id] : undefined;
  return Math.min(Math.max(column.minWidth, px ?? column.width), column.maxWidth);
}

/**
 * A system column's view (the selection or the toggle column): pinned to the start
 * ahead of the data columns, fixed, and inert to sorting, sizing and moves.
 */
function systemView<TData, TContent>(
  kind: 'selection' | 'expand',
  colIndex: number,
  offset: number,
  pinEdge: boolean,
): ColumnView<TData, TContent> {
  const width = kind === 'selection' ? SELECTION_COLUMN_WIDTH : EXPAND_COLUMN_WIDTH;
  return {
    id: kind === 'selection' ? SELECTION_COLUMN_ID : EXPAND_COLUMN_ID,
    kind,
    colIndex,
    pin: 'start',
    offset,
    pinEdge,
    hidden: false,
    width,
    ownWidth: width,
    flex: undefined,
    auto: false,
    minWidth: width,
    maxWidth: width,
    sortable: false,
    resizable: false,
    reorderable: false,
    pinnable: false,
    hideable: false,
    groupable: false,
    filter: undefined,
    filtered: false,
    align: 'center',
    wrap: false,
    sorted: false,
    header: undefined,
    cell: undefined,
    groupCell: undefined,
    meta: undefined,
    hasAccessor: false,
  };
}

/** A data column's view. */
function view<TData, TContent>(
  options: TableModelOptions<TData, TContent>,
  byId: ById<TData, TContent>,
  sizing: ColumnSizingState,
  def: ResolvedColumn<TData, TContent>,
  colIndex: number,
  offset: number,
  pinEdge: boolean,
  stretched?: number,
): ColumnView<TData, TContent> {
  const sort = options.sorting.find((s) => s.id === def.id);
  const pin = pinIn(def, options.columnPinning);
  const resized = options.columnSizing[def.id] !== undefined;
  return {
    id: def.id,
    kind: 'data',
    colIndex,
    pin,
    offset,
    pinEdge,
    hidden: colIndex === 0,
    width: stretched ?? widthOf(byId, sizing, def.id),
    ownWidth: widthOf(byId, sizing, def.id),
    flex: pin === undefined && !resized ? def.flex : undefined,
    auto: def.auto && !resized,
    minWidth: def.minWidth,
    maxWidth: def.maxWidth,
    sortable: def.sortable,
    resizable: def.resizable,
    reorderable: def.reorderable,
    pinnable: def.pinnable,
    hideable: def.hideable,
    groupable: def.groupable,
    filter: def.filter,
    filtered: options.columnFilters?.[def.id] !== undefined,
    align: def.align,
    wrap: def.wrap,
    sorted: sort ? (sort.desc ? 'desc' : 'asc') : false,
    header: def.header,
    cell: def.cell,
    groupCell: def.groupCell,
    meta: def.meta,
    hasAccessor: def.hasAccessor,
  };
}

/**
 * The scrolling columns' rendered widths when the table stretches them (`stretch`),
 * by id; columns not listed render at their own width.
 */
function stretchedWidths<TData, TContent>(
  options: TableModelOptions<TData, TContent>,
  byId: ById<TData, TContent>,
  sizing: ColumnSizingState,
  start: readonly ResolvedColumn<TData, TContent>[],
  center: readonly ResolvedColumn<TData, TContent>[],
  end: readonly ResolvedColumn<TData, TContent>[],
): Map<string, number> {
  const stretch = options.stretch;
  if (!stretch || center.length === 0) return new Map();
  const own = (id: string) => widthOf(byId, sizing, id);
  const resized = (def: ResolvedColumn<TData, TContent>) =>
    options.columnSizing[def.id] !== undefined;
  // An unresized flex column takes the free space through its grid track.
  if (center.some((def) => def.flex !== undefined && !resized(def))) return new Map();
  const systemPx =
    (options.selectionColumn ? SELECTION_COLUMN_WIDTH : 0) +
    (options.detail ? EXPAND_COLUMN_WIDTH : 0);
  const total = [...start, ...center, ...end].reduce((sum, def) => sum + own(def.id), 0);
  // Whole px, so fractional own widths never overflow the width.
  const free = Math.floor(stretch.width - systemPx - total);
  if (free <= 0) return new Map();
  // The unresized columns share the space in proportion, up to their maxWidth.
  const spread = center
    .filter((def) => !resized(def))
    .map((def) => {
      const width = own(def.id);
      return { id: def.id, width, minWidth: width, maxWidth: Math.max(width, def.maxWidth) };
    });
  const widths = spread.length
    ? spreadWidth(spread, spread.reduce((sum, c) => sum + c.width, 0) + free)
    : new Map<string, number>();
  let left = free - spread.reduce((sum, c) => sum + (widths.get(c.id) ?? c.width) - c.width, 0);
  // What they can't take goes to the last columns that can, skipping the ones
  // resized last (they keep the width they were given).
  const keep = new Set(stretch.keep);
  for (let i = center.length - 1; i >= 0 && left > 0; i--) {
    const def = center[i];
    if (!def || keep.has(def.id)) continue;
    const now = widths.get(def.id) ?? own(def.id);
    const add = Math.min(left, Math.max(0, def.maxWidth - now));
    if (add > 0) widths.set(def.id, now + add);
    left -= add;
  }
  return widths;
}

/**
 * The shown columns' views in visual order: the system columns, then the
 * start-pinned, scrolling and end-pinned columns, with their sticky offsets.
 */
export function buildViews<TData, TContent>(
  options: TableModelOptions<TData, TContent>,
  byId: ById<TData, TContent>,
  order: ColumnOrderState,
  sizing: ColumnSizingState,
): ColumnView<TData, TContent>[] {
  const groups: Record<ColumnPin | 'center', ResolvedColumn<TData, TContent>[]> = {
    start: [],
    center: [],
    end: [],
  };
  for (const id of order) {
    const def = byId.get(id);
    if (def && !hiddenIn(def, options.columnVisibility)) {
      groups[pinIn(def, options.columnPinning) ?? 'center'].push(def);
    }
  }
  const { start, center, end } = groups;
  // The system columns come first (the selection column, then the toggle column):
  // they shift every column on, and the start-pinned ones by their widths.
  const system: ('selection' | 'expand')[] = [];
  if (options.selectionColumn) system.push('selection');
  if (options.detail) system.push('expand');
  for (const id of [SELECTION_COLUMN_ID, EXPAND_COLUMN_ID]) {
    if (system.length && byId.has(id)) {
      throw new Error(`argus-table: the column id '${id}' is reserved.`);
    }
  }
  const lead = system.length;
  const stretched = stretchedWidths(options, byId, sizing, start, center, end);
  const systemViews: ColumnView<TData, TContent>[] = [];
  let x = 0;
  for (const [i, kind] of system.entries()) {
    const v = systemView<TData, TContent>(kind, i + 1, x, i === lead - 1 && start.length === 0);
    systemViews.push(v);
    x += v.width;
  }
  // Offsets: start columns from the start edge (after the system columns), the
  // scrolling ones within the scrolling area, end columns from the end edge.
  const list = start.map((def, i) => {
    const v = view(options, byId, sizing, def, lead + i + 1, x, i === start.length - 1);
    x += v.width;
    return v;
  });
  x = 0;
  for (const [i, def] of center.entries()) {
    const at = lead + start.length + i + 1;
    const v = view(options, byId, sizing, def, at, x, false, stretched.get(def.id));
    list.push(v);
    x += v.width;
  }
  const ends: ColumnView<TData, TContent>[] = [];
  x = 0;
  for (const [i, def] of [...end.entries()].reverse()) {
    const at = lead + start.length + center.length + i + 1;
    const v = view(options, byId, sizing, def, at, x, i === 0);
    ends.unshift(v);
    x += v.width;
  }
  list.push(...ends);
  list.unshift(...systemViews);
  return list;
}

/** Every column's view in the column order: the shown ones, and hidden ones with `hidden: true`. */
export function buildAllViews<TData, TContent>(
  options: TableModelOptions<TData, TContent>,
  byId: ById<TData, TContent>,
  order: ColumnOrderState,
  sizing: ColumnSizingState,
  shown: readonly ColumnView<TData, TContent>[],
): ColumnView<TData, TContent>[] {
  const byShownId = new Map(shown.map((v) => [v.id, v]));
  return order.flatMap((id) => {
    const shownView = byShownId.get(id);
    if (shownView) return [shownView];
    const def = byId.get(id);
    return def ? [view(options, byId, sizing, def, 0, 0, false)] : [];
  });
}
