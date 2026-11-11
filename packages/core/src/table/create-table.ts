import {
  columnSizingFeature,
  constructTable,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type ColumnDef as TanStackColumnDef,
  type Row,
  type Table,
  type TableOptions,
} from '@tanstack/table-core';
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings';
import { moveColumn, normalizeOrder } from '../columns/column-order.js';
import { resolveColumns, type ResolvedColumn } from '../columns/resolve-columns.js';
import { distinctValues, rowPredicate } from '../filters/filter.js';
import { filteredRowModel, setRowPredicate } from './filtered-row-model.js';
import { sortedRowModel, valuesChanged } from './sorted-row-model.js';
import type {
  CellContext,
  ColumnAlign,
  ColumnDef,
  ColumnFilter,
  ColumnFilterState,
  ColumnOrderState,
  ColumnPin,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  FilterKind,
  FilterValue,
  PinnedRows,
  RowPin,
  SortState,
} from '../types.js';

// The TanStack adapter. Everything TanStack stays in this module: callers only see
// the view types below, so TanStack can be upgraded or replaced without touching
// `argus-table`'s public API.

const features = tableFeatures({
  // Vanilla (framework-free) reactivity; required by `constructTable`.
  coreReactivityFeature: storeReactivityBindings(),
  // No pinning, ordering or visibility feature: the model groups, orders and hides
  // columns itself (see `buildViews`), so they cost no bundle size.
  columnSizingFeature,
  rowSortingFeature,
  // Our own filtering, without TanStack's filtering feature (see filtered-row-model.ts).
  // TanStack's types tie this slot to that feature; at runtime the core row models read it.
  ...({ filteredRowModel: filteredRowModel() } as object),
  // Our own: TanStack's is very slow in Firefox at scale (see sorted-row-model.ts).
  sortedRowModel: sortedRowModel(),
  // Registered by name so `sortFn: 'auto'` can pick one by value type.
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});
type Features = typeof features;
type AnyRow = Record<string, unknown>;

/** Sort direction of a column, or `false` when it isn't sorted. */
export type SortDirection = 'asc' | 'desc' | false;

/**
 * Id of the selection column, the checkbox column the model adds first when
 * `selectionColumn` is set. Not a column of `columns`: it never appears in the
 * column order, sizing or events.
 */
export const SELECTION_COLUMN_ID = '--argus-selection';

/** Width of the selection column in px. */
export const SELECTION_COLUMN_WIDTH = 40;

/** A column as the renderer sees it, in visual order: start-pinned, scrolling, end-pinned. */
export interface ColumnView<TData, TContent> {
  id: string;
  /** `'data'` for a column of `columns`; `'selection'` for the checkbox column. */
  kind: 'data' | 'selection';
  /** 1-based position in visual order, for `aria-colindex`. `0` for a hidden column. */
  colIndex: number;
  /** The pin in effect: `columnPinning`'s, else the column's own. */
  pin: ColumnPin | undefined;
  /**
   * Sticky inset in px: from the start edge for `'start'` columns, from the end edge
   * for `'end'` columns. For scrolling columns, the start within the scrolling area.
   */
  offset: number;
  /** `true` on the pinned column next to the scrolling area (one per pinned side). */
  pinEdge: boolean;
  /**
   * `true` for a hidden column. Only `allColumns` lists hidden columns; `columns`
   * holds the ones the table shows.
   */
  hidden: boolean;
  /** Current width in px (a resized width wins over the column's own). */
  width: number;
  /** Share of free space, or `undefined` for a fixed width. A resized column stops flexing. */
  flex: number | undefined;
  /**
   * `true` for a `width: 'auto'` column that hasn't been resized: the table measures
   * its content and passes the width in as `autoWidths`.
   */
  auto: boolean;
  minWidth: number;
  maxWidth: number;
  sortable: boolean;
  resizable: boolean;
  reorderable: boolean;
  pinnable: boolean;
  hideable: boolean;
  /** The kind of filter users can set, or `undefined` when they can't filter the column. */
  filter: FilterKind | undefined;
  /** `true` when `columnFilters` has a filter for the column. */
  filtered: boolean;
  align: ColumnAlign;
  /** Whether the cell text wraps (`ColumnDef.wrap`). */
  wrap: boolean;
  sorted: SortDirection;
  header: ColumnDef<TData, TContent>['header'];
  cell: ColumnDef<TData, TContent>['cell'];
  hasAccessor: boolean;
}

/** A row of the current (filtered and sorted) row model. */
export interface RowView<TData> {
  id: string;
  /** Index in the current row model, 0-based. */
  index: number;
  original: TData;
}

/**
 * Rows that live outside the model, loaded page by page (`dataSource`). The
 * source sorts them, so the model reads them as they are. `PageCache` implements it.
 */
export interface RemoteRows<TData> {
  readonly rowCount: number;
  /** The loaded row at an index, with its id; `undefined` while it isn't loaded. */
  entryAt(index: number): { id: string; row: TData } | undefined;
  /** The index of a loaded row's id, or `undefined`. */
  indexOf(rowId: string): number | undefined;
  /** The ids of every loaded row, in row order. */
  loadedIds(): string[];
}

export interface TableModelOptions<TData, TContent> {
  columns: readonly ColumnDef<TData, TContent>[];
  data: readonly TData[];
  /**
   * Remote rows. When set, rows come from here instead of `data`, and the model
   * doesn't sort them (the source does).
   */
  remote?: RemoteRows<TData> | undefined;
  /** Row id function. Default: the row's index in `data`, as a string. */
  getRowId: ((row: TData, index: number) => string) | undefined;
  /** Current sort state; its owner is the caller (see `controllable`). */
  sorting: SortState;
  /** Current resized widths; its owner is the caller. */
  columnSizing: ColumnSizingState;
  /**
   * Current column order; its owner is the caller. Each pin group follows it; an
   * empty array (the default) keeps the order of `columns`.
   */
  columnOrder?: ColumnOrderState | undefined;
  /** Pins set at runtime, over the columns' own `pin`; its owner is the caller. */
  columnPinning?: ColumnPinningState | undefined;
  /** Visibility set at runtime, over the columns' own `hidden`; its owner is the caller. */
  columnVisibility?: ColumnVisibilityState | undefined;
  /**
   * Column filters; its owner is the caller. Rows that fail one leave the row model.
   * Remote rows aren't filtered: the source does it.
   */
  columnFilters?: ColumnFilterState | undefined;
  /**
   * Words to find in the shown columns' values as text, ignoring case: a row stays
   * when each word is in one of its values. Remote rows aren't filtered.
   */
  quickFilter?: string | undefined;
  /**
   * Measured widths of `width: 'auto'` columns, in px by id. Clamped to the column's
   * bounds; a resized width wins. Ids of other columns are ignored.
   */
  autoWidths?: ColumnSizingState | undefined;
  /** Rows fixed above or below the body. They stay out of the row model: never sorted, not counted. */
  pinnedRows?: PinnedRows<TData> | undefined;
  /**
   * Adds the selection (checkbox) column first among the start-pinned columns. It
   * has the id `SELECTION_COLUMN_ID`, a fixed width, and no part in sorting,
   * sizing or the column order.
   */
  selectionColumn?: boolean | undefined;
}

export interface TableModel<TData, TContent> {
  /** Updates any subset of the options. Unchanged references are ignored. */
  update(options: Partial<TableModelOptions<TData, TContent>>): void;
  /** The columns the table shows, in visual order. */
  readonly columns: readonly ColumnView<TData, TContent>[];
  /**
   * Every column of `columns`, hidden ones included (with `hidden: true` and
   * `colIndex: 0`), in the order of `orderOf()`. Not the selection column.
   */
  readonly allColumns: readonly ColumnView<TData, TContent>[];
  /** Number of rows in the current row model. */
  readonly rowCount: number;
  /**
   * Changes identity whenever the row at an index may have changed: new data, a
   * sort, a filter, a new remote source. Compare it by identity only.
   */
  readonly rowOrder: object;
  /** Sum of the shown columns' widths in px (flex columns count their minimum). */
  readonly totalWidth: number;
  /** The row at an index of the current row model; `undefined` for a remote row not loaded yet. */
  rowAt(index: number): RowView<TData> | undefined;
  /** The index of a row id in the current row model (after filtering and sorting), or `undefined`. */
  indexOf(rowId: string): number | undefined;
  /**
   * The ids of the rows that can be selected, in row order: every row of the row
   * model, or only the loaded ones for remote rows.
   */
  selectableIds(): string[];
  /** The value a column reads from the row at `index`. */
  valueAt(index: number, columnId: string): unknown;
  /** What a column's `cell` function receives for the row at `index`. */
  cellContext(index: number, columnId: string): CellContext<TData> | undefined;
  /**
   * The sort state that clicking this column's header would produce:
   * asc → desc → unsorted, one column at a time. `undefined` if it can't sort.
   */
  nextSorting(columnId: string): SortState | undefined;
  /**
   * The sizing state after setting a column to `width` px, clamped to its bounds.
   * `undefined` if the column can't be resized.
   */
  nextSizing(columnId: string, width: number): ColumnSizingState | undefined;
  /**
   * The full column order as the table shows it: start-pinned, scrolling and
   * end-pinned ids. `base` defaults to the current `columnOrder`.
   */
  orderOf(base?: readonly string[]): ColumnOrderState;
  /**
   * The order after moving a column to position `to` (0-based among the shown data
   * columns, in visual order, counted after the move; hidden columns keep their place),
   * starting from `base` (default: the current order). `undefined` if the column can't
   * move or is hidden, `to` is outside its pin group, or nothing changes.
   */
  nextOrder(columnId: string, to: number, base?: readonly string[]): ColumnOrderState | undefined;
  /**
   * The pinning state after pinning a column to a side, or unpinning it with `false`,
   * starting from `base` (default: the current `columnPinning`). `undefined` for an
   * unknown column, one with `pinnable: false`, or no change.
   */
  nextPinning(
    columnId: string,
    pin: ColumnPin | false,
    base?: ColumnPinningState,
  ): ColumnPinningState | undefined;
  /**
   * The visibility state after hiding or showing a column, starting from `base`
   * (default: the current `columnVisibility`). `undefined` for an unknown column,
   * hiding one with `hideable: false` or the last one shown, or no change.
   */
  nextVisibility(
    columnId: string,
    hidden: boolean,
    base?: ColumnVisibilityState,
  ): ColumnVisibilityState | undefined;
  /**
   * The filter state after setting a column's filter, or clearing it with `undefined`,
   * starting from `base` (default: the current `columnFilters`). `undefined` for an
   * unknown column, setting a filter on a column without `filter`, or no change.
   */
  nextFilters(
    columnId: string,
    filter: ColumnFilter | undefined,
    base?: ColumnFilterState,
  ): ColumnFilterState | undefined;
  /**
   * The values a `'set'` filter on the column offers: its `filterOptions`, else (not for
   * remote rows) the distinct values of the rows the other filters keep, sorted, at most
   * `limit` of them (`truncated` when there are more). `undefined` for an unknown column,
   * or remote rows without `filterOptions`.
   */
  filterValues(
    columnId: string,
    limit?: number,
  ): { values: FilterValue[]; truncated: boolean } | undefined;
  /** Number of rows pinned to a side. */
  pinnedCount(side: RowPin): number;
  /**
   * A pinned row, `index` counted within its side. Its id comes from `getRowId`,
   * else it is `'top-{index}'` or `'bottom-{index}'`, apart from the data rows' index ids.
   */
  pinnedRowAt(side: RowPin, index: number): RowView<TData> | undefined;
  /** The value a column reads from a pinned row. */
  pinnedValueAt(side: RowPin, index: number, columnId: string): unknown;
  /** What a column's `cell` function receives for a pinned row (with `pinned` set). */
  pinnedCellContext(side: RowPin, index: number, columnId: string): CellContext<TData> | undefined;
}

const defaultRowId = (_row: unknown, index: number) => String(index);

/**
 * Ids of the columns kept from `before` whose accessor changed: a new function,
 * or a different path. A new column has nothing cached and isn't listed.
 */
function changedAccessors<TData, TContent>(
  before: readonly ColumnDef<TData, TContent>[],
  after: readonly ColumnDef<TData, TContent>[],
): string[] {
  const old = new Map(before.map((c) => [c.id, c.accessor]));
  return after.filter((c) => old.has(c.id) && old.get(c.id) !== c.accessor).map((c) => c.id);
}

/** The selection column's view: first, pinned to the start, fixed, and inert to sorting, sizing and moves. */
function selectionView<TData, TContent>(pinEdge: boolean): ColumnView<TData, TContent> {
  return {
    id: SELECTION_COLUMN_ID,
    kind: 'selection',
    colIndex: 1,
    pin: 'start',
    offset: 0,
    pinEdge,
    hidden: false,
    width: SELECTION_COLUMN_WIDTH,
    flex: undefined,
    auto: false,
    minWidth: SELECTION_COLUMN_WIDTH,
    maxWidth: SELECTION_COLUMN_WIDTH,
    sortable: false,
    resizable: false,
    reorderable: false,
    pinnable: false,
    hideable: false,
    filter: undefined,
    filtered: false,
    align: 'center',
    wrap: false,
    sorted: false,
    header: undefined,
    cell: undefined,
    hasAccessor: false,
  };
}

function toTanStack<TData, TContent>(
  column: ResolvedColumn<TData, TContent>,
): TanStackColumnDef<Features, AnyRow> {
  return {
    id: column.id,
    accessorFn: column.getValue as (row: AnyRow, index: number) => unknown,
    size: column.width,
    minSize: column.minWidth,
    maxSize: column.maxWidth,
    enableSorting: column.sortable,
    sortUndefined: 'last',
  };
}

/**
 * Creates the table model over TanStack Table. It owns no state: sorting, sizing, order,
 * pinning and visibility come in through `update()`, and the `next*()` methods only propose
 * changes, so the caller decides (controlled or uncontrolled) whether to apply them.
 *
 * Hidden columns stay in TanStack, so their values still sort and read; only the
 * views leave them out. Pin groups, sticky offsets and the order are the model's own.
 */
export function createTableModel<TData, TContent>(
  initial: TableModelOptions<TData, TContent>,
): TableModel<TData, TContent> {
  let options = initial;
  let resolved = resolveColumns(options.columns);
  let byId = new Map(resolved.map((c) => [c.id, c]));
  // TanStack column defs by id, kept between updates that don't change `columns`.
  let tanStackById = new Map(resolved.map((c) => [c.id, toTanStack(c)]));
  let views: ColumnView<TData, TContent>[] | undefined;
  // The pin and visibility in effect: the state's, else the column's own.
  const pinOf = (
    column: ResolvedColumn<TData, TContent>,
    pinning = options.columnPinning,
  ): ColumnPin | undefined => {
    const state = pinning?.[column.id];
    if (state === 'start' || state === 'end') return state;
    return state === false ? undefined : column.pin;
  };
  const hiddenOf = (
    column: ResolvedColumn<TData, TContent>,
    visibility = options.columnVisibility,
  ): boolean => {
    const state = visibility?.[column.id];
    return typeof state === 'boolean' ? !state : column.hidden;
  };
  const shown = (id: string) => {
    const column = byId.get(id);
    return column !== undefined && !hiddenOf(column);
  };
  // TanStack's sizing state: measured auto widths and the widths of pinned flex columns
  // under the resized ones. Kept stable between updates that don't touch them.
  let sizing: ColumnSizingState | undefined;
  const sizingState = (): ColumnSizingState => {
    if (sizing) return sizing;
    const auto = options.autoWidths;
    const merged: ColumnSizingState = {};
    let any = false;
    for (const column of resolved) {
      // A pinned column can't flex: it takes a fixed width for its sticky offsets.
      if (column.flex !== undefined && pinOf(column) !== undefined) {
        merged[column.id] = column.pinnedWidth;
        any = true;
      }
      const px = auto?.[column.id];
      if (!column.auto || px === undefined || !Number.isFinite(px)) continue;
      merged[column.id] = Math.min(column.maxWidth, Math.max(column.minWidth, px));
      any = true;
    }
    return (sizing = any ? { ...merged, ...options.columnSizing } : options.columnSizing);
  };
  // What ordering needs, with the pin in effect.
  const orderable = () =>
    resolved.map((c) => ({ id: c.id, pin: pinOf(c), reorderable: c.reorderable }));
  // The normalized order, kept stable between updates that touch neither columns,
  // order nor pinning.
  let order: ColumnOrderState | undefined;
  const orderState = (): ColumnOrderState =>
    (order ??= normalizeOrder(options.columnOrder ?? [], orderable()));
  const rowViews = new WeakMap<Row<Features, AnyRow>, RowView<TData>>();
  // Built lazily per row model (sorting or new data gives a new array).
  let indexById: { rows: readonly Row<Features, AnyRow>[]; map: Map<string, number> } | undefined;

  // TanStack gets its column defs in the order, hidden ones included. Rebuilt only when
  // the order changes: a new columns array makes TanStack rebuild its columns, though
  // not its row models, which depend on data and sorting alone.
  let ordered:
    { order: ColumnOrderState; columns: TanStackColumnDef<Features, AnyRow>[] } | undefined;
  const orderedColumns = () => {
    const current = orderState();
    if (ordered?.order !== current) {
      ordered = { order: current, columns: current.flatMap((id) => tanStackById.get(id) ?? []) };
    }
    return ordered;
  };

  const tableOptions = (): TableOptions<Features, AnyRow> => ({
    features,
    columns: orderedColumns().columns,
    // Remote rows bypass TanStack's row models; it still handles columns and state.
    data: (options.remote ? [] : options.data) as AnyRow[],
    getRowId: (options.getRowId ?? defaultRowId) as (row: AnyRow, index: number) => string,
    state: {
      sorting: options.sorting,
      columnSizing: sizingState(),
    },
    // State is owned by the caller; TanStack's own setters must not change it.
    onSortingChange: () => undefined,
    onColumnSizingChange: () => undefined,
  });

  const table: Table<Features, AnyRow> = constructTable(tableOptions());

  // The row test of the filters, the quick filter and the shown columns (which the quick
  // filter reads). Remote rows are filtered by their source.
  const predicateFor = (except?: string) =>
    options.remote
      ? undefined
      : rowPredicate(
          byId,
          options.columnFilters,
          options.quickFilter,
          resolved.filter((c) => c.hasAccessor && !hiddenOf(c)),
          except,
        );
  setRowPredicate(table, predicateFor());

  const rows = () => table.getRowModel().rows;
  const pinned = (side: RowPin): readonly TData[] => options.pinnedRows?.[side] ?? [];

  const widthOf = (id: string) => table.getColumn(id)?.getSize() ?? 0;
  const view = (
    def: ResolvedColumn<TData, TContent>,
    colIndex: number,
    offset: number,
    pinEdge: boolean,
    width: number,
  ): ColumnView<TData, TContent> => {
    const sort = options.sorting.find((s) => s.id === def.id);
    const pin = pinOf(def);
    const resized = options.columnSizing[def.id] !== undefined;
    return {
      id: def.id,
      kind: 'data',
      colIndex,
      pin,
      offset,
      pinEdge,
      hidden: colIndex === 0,
      width,
      flex: pin === undefined && !resized ? def.flex : undefined,
      auto: def.auto && !resized,
      minWidth: def.minWidth,
      maxWidth: def.maxWidth,
      sortable: def.sortable,
      resizable: def.resizable,
      reorderable: def.reorderable,
      pinnable: def.pinnable,
      hideable: def.hideable,
      filter: def.filter,
      filtered: options.columnFilters?.[def.id] !== undefined,
      align: def.align,
      wrap: def.wrap,
      sorted: sort ? (sort.desc ? 'desc' : 'asc') : false,
      header: def.header,
      cell: def.cell,
      hasAccessor: def.hasAccessor,
    };
  };

  const buildViews = (): ColumnView<TData, TContent>[] => {
    const groups: Record<ColumnPin | 'center', ResolvedColumn<TData, TContent>[]> = {
      start: [],
      center: [],
      end: [],
    };
    for (const id of orderState()) {
      const def = byId.get(id);
      if (def && !hiddenOf(def)) groups[pinOf(def) ?? 'center'].push(def);
    }
    const { start, center, end } = groups;
    // The selection column comes first: it shifts every column one place on, and
    // the other start-pinned columns its width further from the start edge.
    const lead = options.selectionColumn ? 1 : 0;
    if (lead && byId.has(SELECTION_COLUMN_ID)) {
      throw new Error(`argus-table: the column id '${SELECTION_COLUMN_ID}' is reserved.`);
    }
    // Offsets: start columns from the start edge (after the selection column), the
    // scrolling ones within the scrolling area, end columns from the end edge.
    let x = lead * SELECTION_COLUMN_WIDTH;
    const list = start.map((def, i) => {
      const width = widthOf(def.id);
      const v = view(def, lead + i + 1, x, i === start.length - 1, width);
      x += width;
      return v;
    });
    x = 0;
    for (const [i, def] of center.entries()) {
      const width = widthOf(def.id);
      list.push(view(def, lead + start.length + i + 1, x, false, width));
      x += width;
    }
    const ends: ColumnView<TData, TContent>[] = [];
    x = 0;
    for (const [i, def] of [...end.entries()].reverse()) {
      const width = widthOf(def.id);
      ends.unshift(view(def, lead + start.length + center.length + i + 1, x, i === 0, width));
      x += width;
    }
    list.push(...ends);
    if (lead) list.unshift(selectionView(start.length === 0));
    return list;
  };

  let allViews: ColumnView<TData, TContent>[] | undefined;
  const buildAllViews = (shownViews: readonly ColumnView<TData, TContent>[]) => {
    const byShownId = new Map(shownViews.map((v) => [v.id, v]));
    return orderState().flatMap((id) => {
      const shownView = byShownId.get(id);
      if (shownView) return [shownView];
      const def = byId.get(id);
      return def ? [view(def, 0, 0, false, widthOf(id))] : [];
    });
  };

  return {
    update(next) {
      const merged = { ...options, ...next };
      const changed = (Object.keys(next) as (keyof typeof next)[]).some(
        (key) => next[key] !== options[key],
      );
      if (!changed) return;
      let reread: string[] = [];
      if (next.columns && next.columns !== options.columns) {
        reread = changedAccessors(options.columns, next.columns);
        resolved = resolveColumns(next.columns);
        byId = new Map(resolved.map((c) => [c.id, c]));
        tanStackById = new Map(resolved.map((c) => [c.id, toTanStack(c)]));
      }
      const pinningChanged = merged.columnPinning !== options.columnPinning;
      if (
        merged.columns !== options.columns ||
        merged.columnSizing !== options.columnSizing ||
        merged.autoWidths !== options.autoWidths ||
        pinningChanged
      ) {
        sizing = undefined;
      }
      if (
        merged.columns !== options.columns ||
        merged.columnOrder !== options.columnOrder ||
        pinningChanged
      ) {
        order = undefined;
      }
      const refilter =
        merged.columns !== options.columns ||
        merged.columnFilters !== options.columnFilters ||
        merged.quickFilter !== options.quickFilter ||
        merged.columnVisibility !== options.columnVisibility ||
        merged.remote !== options.remote;
      options = merged;
      views = undefined;
      allViews = undefined;
      if (refilter) setRowPredicate(table, predicateFor());
      table.setOptions((prev) => ({ ...prev, ...tableOptions() }));
      if (reread.length && !options.remote) {
        // TanStack caches each value on its row by column id, and keeps rows
        // while the data is the same: drop the values of the columns that now
        // read differently, and sort again.
        for (const row of table.getCoreRowModel().rows) {
          for (const id of reread) Reflect.deleteProperty(row._valuesCache, id);
        }
        valuesChanged(table);
      }
    },

    get columns() {
      return (views ??= buildViews());
    },

    get allColumns() {
      return (allViews ??= buildAllViews(this.columns));
    },

    get rowCount() {
      return options.remote?.rowCount ?? rows().length;
    },
    get rowOrder() {
      return options.remote ?? rows();
    },

    get totalWidth() {
      return this.columns.reduce((sum, column) => sum + column.width, 0);
    },

    rowAt(index) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        return entry && { id: entry.id, index, original: entry.row };
      }
      const row = rows()[index];
      if (!row) return undefined;
      let view = rowViews.get(row);
      if (view?.index !== index) {
        view = { id: row.id, index, original: row.original as TData };
        rowViews.set(row, view);
      }
      return view;
    },

    indexOf(rowId) {
      if (options.remote) return options.remote.indexOf(rowId);
      const current = rows();
      if (indexById?.rows !== current) {
        indexById = { rows: current, map: new Map(current.map((r, i) => [r.id, i])) };
      }
      return indexById.map.get(rowId);
    },

    selectableIds() {
      if (options.remote) return options.remote.loadedIds();
      return rows().map((r) => r.id);
    },

    valueAt(index, columnId) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        return entry && byId.get(columnId)?.getValue(entry.row, index);
      }
      return rows()[index]?.getValue(columnId);
    },

    cellContext(index, columnId) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        const column = byId.get(columnId);
        if (!entry || !column) return undefined;
        return {
          row: entry.row,
          rowId: entry.id,
          index,
          columnId,
          value: column.getValue(entry.row, index),
        };
      }
      const row = rows()[index];
      if (!row || !byId.has(columnId)) return undefined;
      return {
        row: row.original as TData,
        rowId: row.id,
        index,
        columnId,
        value: row.getValue(columnId),
      };
    },

    nextSorting(columnId) {
      if (byId.get(columnId)?.sortable !== true) return undefined;
      const current = options.sorting.find((s) => s.id === columnId);
      if (!current) return [{ id: columnId, desc: false }];
      return current.desc ? [] : [{ id: columnId, desc: true }];
    },

    nextSizing(columnId, width) {
      const column = byId.get(columnId);
      if (!column?.resizable || !Number.isFinite(width)) return undefined;
      const clamped = Math.round(Math.min(column.maxWidth, Math.max(column.minWidth, width)));
      return { ...options.columnSizing, [columnId]: clamped };
    },

    orderOf(base) {
      return base === undefined ? orderState() : normalizeOrder(base, orderable());
    },

    nextOrder(columnId, to, base) {
      return moveColumn(base ?? orderState(), orderable(), columnId, to, shown);
    },

    nextPinning(columnId, pin, base = options.columnPinning) {
      const column = byId.get(columnId);
      if (!column?.pinnable || (pinOf(column, base) ?? false) === pin) return undefined;
      return { ...base, [columnId]: pin };
    },

    nextVisibility(columnId, hidden, base = options.columnVisibility) {
      const column = byId.get(columnId);
      if (!column || hiddenOf(column, base) === hidden) return undefined;
      const othersShown = resolved.some((c) => c !== column && !hiddenOf(c, base));
      if (hidden && (!column.hideable || !othersShown)) return undefined;
      return { ...base, [columnId]: !hidden };
    },

    nextFilters(columnId, filter, base = options.columnFilters ?? {}) {
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
    },

    filterValues(columnId, limit = 1000) {
      const column = byId.get(columnId);
      if (!column) return undefined;
      if (column.filterOptions) return { values: [...column.filterOptions], truncated: false };
      if (options.remote) return undefined;
      const rows = table.getCoreRowModel().rows as unknown as Iterable<{
        original: TData;
        index: number;
      }>;
      return distinctValues(rows, column, predicateFor(columnId), limit);
    },

    pinnedCount(side) {
      return pinned(side).length;
    },

    pinnedRowAt(side, index) {
      if (index < 0 || index >= pinned(side).length) return undefined;
      const row = pinned(side)[index] as TData;
      const id = options.getRowId ? options.getRowId(row, index) : `${side}-${String(index)}`;
      return { id, index, original: row };
    },

    pinnedValueAt(side, index, columnId) {
      if (index < 0 || index >= pinned(side).length) return undefined;
      return byId.get(columnId)?.getValue(pinned(side)[index] as TData, index);
    },

    pinnedCellContext(side, index, columnId) {
      const row = this.pinnedRowAt(side, index);
      const column = byId.get(columnId);
      if (!row || !column) return undefined;
      return {
        row: row.original,
        rowId: row.id,
        index,
        columnId,
        value: column.getValue(row.original, index),
        pinned: side,
      };
    },
  };
}
