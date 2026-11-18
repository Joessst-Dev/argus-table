import {
  cellOver,
  headerGroupRows,
  resolveColumnGroups,
  type GroupTree,
  type HeaderGroupCell,
} from '../columns/column-groups.js';
import {
  moveUnit,
  normalizeOrder,
  siblingUnits,
  type OrderUnit,
  type SiblingUnit,
} from '../columns/column-order.js';
import { resolveColumns, type ResolvedColumn } from '../columns/resolve-columns.js';
import { distinctValues, rowPredicate } from '../filters/filter.js';
import { DisplayRows } from './display-rows.js';
import { sortRows } from './sorted-row-model.js';
import type {
  CellContext,
  ColumnAlign,
  ColumnDef,
  ColumnGroup,
  ColumnFilter,
  ColumnFilterState,
  ColumnOrderState,
  ColumnPin,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  ExpandedState,
  FilterKind,
  FilterValue,
  PinnedRows,
  RowPin,
  SortState,
} from '../types.js';

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

/**
 * Id of the toggle column, the column of chevrons that open rows' detail panels,
 * which the model adds after the selection column when `detail` is set. Not a
 * column of `columns`, like the selection column.
 */
export const EXPAND_COLUMN_ID = '--argus-expand';

/** Width of the toggle column in px. */
export const EXPAND_COLUMN_WIDTH = 40;

/** A column as the renderer sees it, in visual order: start-pinned, scrolling, end-pinned. */
export interface ColumnView<TData, TContent> {
  id: string;
  /**
   * `'data'` for a column of `columns`; `'selection'` for the checkbox column,
   * `'expand'` for the toggle column of detail panels.
   */
  kind: 'data' | 'selection' | 'expand';
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
  /** The definition's `meta`, for plugins. */
  meta: ColumnDef<TData, TContent>['meta'];
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
  /**
   * Changes whenever the loaded rows or the row count change, so what the model
   * builds from them can be kept until then. Without it, it's built on each read.
   */
  readonly version?: number;
}

export interface TableModelOptions<TData, TContent> {
  columns: readonly ColumnDef<TData, TContent>[];
  /**
   * Headers over several columns, nested to any depth. Their columns stay next to
   * each other in the order, and each level adds a header row.
   */
  columnGroups?: readonly ColumnGroup<TContent>[] | undefined;
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
  /**
   * Rows can open a detail panel (the table's `rowDetail` is set): adds the toggle
   * column (`EXPAND_COLUMN_ID`) after the selection column, and a panel row after
   * each expanded row in `display`.
   */
  detail?: boolean | undefined;
  /** The ids of the rows whose panel is open; its owner is the caller. */
  expanded?: ExpandedState | undefined;
  /** Rows that can open a panel; default: every row. */
  rowExpandable?: ((row: TData) => boolean) | undefined;
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
  /**
   * The group header rows over `columns`, top row first; empty without column groups.
   * Keeps its identity while `columns` does.
   */
  readonly headerGroups: readonly (readonly HeaderGroupCell<TContent>[])[];
  /** Number of header rows: the group rows and the row of column headers. */
  readonly headerRows: number;
  /** The cell of group header row `level` over a column, or `undefined`. */
  headerCell(level: number, columnId: string): HeaderGroupCell<TContent> | undefined;
  /**
   * The rows the body shows: every row of the current row model, and a panel row
   * after each expanded row that can show one (loaded, allowed by `rowExpandable`).
   * The identity without `detail`. Keeps its identity while the row order,
   * `expanded`, `rowExpandable` and `detail` stay the same (for remote rows, also
   * while no more rows have loaded).
   */
  readonly display: DisplayRows;
  /** Whether the row at a data index can open a panel: `detail` is set, it's loaded and `rowExpandable` allows it. */
  expandable(index: number): boolean;
  /**
   * The expanded ids after opening or closing a row's panel, starting from `base`
   * (default: the current `expanded`). `undefined` when nothing changes or the row
   * can't expand (unknown, not loaded, refused by `rowExpandable`, no `detail`).
   */
  nextExpanded(rowId: string, open: boolean, base?: ExpandedState): ExpandedState | undefined;
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
  /** The value a column reads from any row object, as its accessor gets it at `index`. */
  readValue(row: TData, columnId: string, index: number): unknown;
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
   * The units a column or group moves among: the shown columns and groups with the
   * same parent group on the same pin side, in visual order, starting from `base`
   * (default: the current order). Empty if the unit isn't shown.
   */
  siblingUnits(unit: OrderUnit, base?: readonly string[]): SiblingUnit[];
  /**
   * The order after moving a column or group to position `to` among its sibling
   * units (0-based, counted after the move; hidden columns keep their place),
   * starting from `base` (default: the current order). `undefined` if it can't
   * move or is hidden, `to` is out of range, or nothing changes.
   */
  nextMove(unit: OrderUnit, to: number, base?: readonly string[]): ColumnOrderState | undefined;
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
  /**
   * The indexes in `data` of the rows the column filters and the quick filter keep,
   * ascending (not sorted), leaving out the filters on the `except` columns and their
   * text in the quick filter. `undefined` for remote rows. Reads only the core rows
   * and the other columns' accessors, so an accessor of an `except` column can call it
   * while the model filters or sorts.
   */
  indexesPassing(except?: Iterable<string>): readonly number[] | undefined;
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
    flex: undefined,
    auto: false,
    minWidth: width,
    maxWidth: width,
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
    meta: undefined,
    hasAccessor: false,
  };
}

/**
 * Creates the table model. It owns no state: sorting, sizing, order, pinning and
 * visibility come in through `update()`, and the `next*()` methods only propose
 * changes, so the caller decides (controlled or uncontrolled) whether to apply them.
 *
 * Hidden columns stay in the model, so their values still sort and read; only the
 * views leave them out.
 */
export function createTableModel<TData, TContent>(
  initial: TableModelOptions<TData, TContent>,
): TableModel<TData, TContent> {
  let options = initial;
  let resolved = resolveColumns(options.columns);
  let byId = new Map(resolved.map((c) => [c.id, c]));
  let views: ColumnView<TData, TContent>[] | undefined;
  const treeOf = () =>
    resolveColumnGroups(options.columnGroups, new Set(resolved.map((c) => c.id)));
  let tree: GroupTree<TContent> = treeOf();
  // The group header rows, kept while the tree and what they read of the views stay.
  let groupRows:
    | {
        views: readonly ColumnView<TData, TContent>[];
        tree: GroupTree<TContent>;
        key: string;
        rows: HeaderGroupCell<TContent>[][];
      }
    | undefined;
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
  // The sizing state in effect: measured auto widths and the widths of pinned flex columns
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
    (order ??= normalizeOrder(options.columnOrder ?? [], orderable(), tree));
  // Built lazily per row order (a sort, a filter or new data gives a new array).
  let indexById: { rows: readonly number[]; map: Map<string, number> } | undefined;

  // The row test of the filters, the quick filter and the shown columns (which the quick
  // filter reads). Remote rows are filtered by their source.
  // `except`: columns whose filter is left out; with `quick`, their text is left out
  // of the quick filter too.
  const predicateFor = (except?: ReadonlySet<string>, quick = false) =>
    options.remote
      ? undefined
      : rowPredicate(
          byId,
          options.columnFilters,
          options.quickFilter,
          resolved.filter((c) => c.hasAccessor && !hiddenOf(c) && !(quick && except?.has(c.id))),
          except,
        );
  let predicate = predicateFor();
  // Bumped when a column keeps its id but reads its values differently (a new
  // accessor): the rows, filters and sorting are the same, but which rows pass and
  // their order may not be.
  let valueVersion = 0;

  // The rows are indexes into `data`: no object per row (ADR 0010). Each step keeps
  // its array while what it reads is the same, so `rowOrder` keeps its identity.
  // A new `getRowId` gives a new array too: the ids at each index changed.
  let all: { data: readonly TData[]; getRowId: unknown; rows: number[] } | undefined;
  const allRows = (): readonly number[] => {
    const { data, getRowId } = options;
    if (all?.data !== data || all.getRowId !== getRowId) {
      const rows = new Array<number>(data.length);
      for (let i = 0; i < rows.length; i++) rows[i] = i;
      all = { data, getRowId, rows };
    }
    return all.rows;
  };
  let filtered:
    | { source: readonly number[]; test: unknown; version: number; rows: readonly number[] }
    | undefined;
  const filteredRows = (): readonly number[] => {
    const source = allRows();
    const test = predicate;
    if (!test) return source;
    const prev = filtered;
    if (prev?.source === source && prev.test === test && prev.version === valueVersion) {
      return prev.rows;
    }
    const { data } = options;
    const rows = source.filter((i) => test(data[i] as TData, i));
    filtered = { source, test, version: valueVersion, rows };
    return rows;
  };
  let sorted:
    | { source: readonly number[]; sorting: SortState; version: number; rows: readonly number[] }
    | undefined;
  // The body rows in the current order. Remote rows aren't here: the model reads them
  // from `options.remote`.
  const rows = (): readonly number[] => {
    if (options.remote) return [];
    const source = filteredRows();
    const { sorting } = options;
    const prev = sorted;
    if (prev?.source === source && prev.sorting === sorting && prev.version === valueVersion) {
      return prev.rows;
    }
    const result = sortRows(options.data, source, sorting, (id) => byId.get(id));
    sorted = { source, sorting, version: valueVersion, rows: result };
    return result;
  };
  const rowIdOf = (dataIndex: number): string =>
    options.getRowId
      ? options.getRowId(options.data[dataIndex] as TData, dataIndex)
      : String(dataIndex);
  const pinned = (side: RowPin): readonly TData[] => options.pinnedRows?.[side] ?? [];

  /** The row object at an index of the current order; `undefined` for a remote row not loaded. */
  const rowObjectAt = (index: number): TData | undefined => {
    if (options.remote) return options.remote.entryAt(index)?.row;
    const row = rows()[index];
    return row === undefined ? undefined : options.data[row];
  };
  const expandableAt = (index: number): boolean => {
    if (!options.detail) return false;
    const row = rowObjectAt(index);
    return row !== undefined && (options.rowExpandable?.(row) ?? true);
  };
  const indexOfId = (rowId: string): number | undefined => {
    if (options.remote) return options.remote.indexOf(rowId);
    const current = rows();
    if (indexById?.rows !== current) {
      indexById = { rows: current, map: new Map(current.map((r, i) => [rowIdOf(r), i])) };
    }
    return indexById.map.get(rowId);
  };
  // The displayed rows, kept while what they read is the same: with remote rows,
  // their `version` (rows load without a new order). A remote without one is built
  // again on each read, keeping the previous object when nothing differs.
  let display: { key: readonly unknown[] | undefined; rows: DisplayRows } | undefined;
  const displayRows = (): DisplayRows => {
    const count = options.remote?.rowCount ?? rows().length;
    const { remote } = options;
    const key = remote
      ? remote.version === undefined
        ? undefined
        : [remote, remote.version, options.expanded, options.rowExpandable, options.detail]
      : [rows(), options.expanded, options.rowExpandable, options.detail];
    const prev = display;
    if (key && prev?.key?.every((part, i) => part === key[i])) return prev.rows;
    const open: number[] = [];
    if (options.detail) {
      for (const id of options.expanded ?? []) {
        const index = indexOfId(id);
        if (index !== undefined && expandableAt(index)) open.push(index);
      }
    }
    const next = new DisplayRows(count, open);
    const same =
      prev?.rows.count === next.count &&
      prev.rows.dataCount === next.dataCount &&
      prev.rows.open.every((index, i) => index === next.open[i]);
    display = { key, rows: same ? prev.rows : next };
    return display.rows;
  };

  // The width in effect: the sizing state's (resized, measured, pinned flex), else
  // the column's own, within its bounds.
  const widthOf = (id: string) => {
    const column = byId.get(id);
    if (!column) return 0;
    const state = sizingState();
    const px = Object.hasOwn(state, id) ? state[id] : undefined;
    return Math.min(Math.max(column.minWidth, px ?? column.width), column.maxWidth);
  };
  const view = (
    def: ResolvedColumn<TData, TContent>,
    colIndex: number,
    offset: number,
    pinEdge: boolean,
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
      width: widthOf(def.id),
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
      meta: def.meta,
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
      const v = view(def, lead + i + 1, x, i === start.length - 1);
      x += v.width;
      return v;
    });
    x = 0;
    for (const [i, def] of center.entries()) {
      const v = view(def, lead + start.length + i + 1, x, false);
      list.push(v);
      x += v.width;
    }
    const ends: ColumnView<TData, TContent>[] = [];
    x = 0;
    for (const [i, def] of [...end.entries()].reverse()) {
      const v = view(def, lead + start.length + center.length + i + 1, x, i === 0);
      ends.unshift(v);
      x += v.width;
    }
    list.push(...ends);
    list.unshift(...systemViews);
    return list;
  };

  let allViews: ColumnView<TData, TContent>[] | undefined;
  const buildAllViews = (shownViews: readonly ColumnView<TData, TContent>[]) => {
    const byShownId = new Map(shownViews.map((v) => [v.id, v]));
    return orderState().flatMap((id) => {
      const shownView = byShownId.get(id);
      if (shownView) return [shownView];
      const def = byId.get(id);
      return def ? [view(def, 0, 0, false)] : [];
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
      }
      const columnsChanged = merged.columns !== options.columns;
      const pinningChanged = merged.columnPinning !== options.columnPinning;
      const groupsChanged = merged.columnGroups !== options.columnGroups;
      if (
        columnsChanged ||
        merged.columnSizing !== options.columnSizing ||
        merged.autoWidths !== options.autoWidths ||
        pinningChanged
      ) {
        sizing = undefined;
      }
      if (
        columnsChanged ||
        groupsChanged ||
        merged.columnOrder !== options.columnOrder ||
        pinningChanged
      ) {
        order = undefined;
      }
      const refilter =
        columnsChanged ||
        merged.columnFilters !== options.columnFilters ||
        merged.quickFilter !== options.quickFilter ||
        merged.columnVisibility !== options.columnVisibility ||
        merged.remote !== options.remote;
      options = merged;
      if (columnsChanged || groupsChanged) tree = treeOf();
      views = undefined;
      allViews = undefined;
      if (refilter) predicate = predicateFor();
      // Columns that now read differently: filter and sort again.
      if (reread.length && !options.remote) valueVersion++;
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

    get headerGroups() {
      const current = this.columns;
      if (groupRows?.views === current && groupRows.tree === tree) return groupRows.rows;
      // Views are rebuilt on every update; the rows only change with what they read.
      const key = tree.groups.size
        ? current
            .map(
              (c) =>
                `${c.id}\u0000${String(c.pin)}\u0000${String(c.offset)}\u0000${String(c.pinEdge)}\u0000${String(c.reorderable)}\u0000${String(c.resizable)}`,
            )
            .join('\u0001')
        : '';
      if (groupRows?.tree !== tree || groupRows.key !== key) {
        groupRows = { views: current, tree, key, rows: headerGroupRows(tree, current) };
      } else {
        groupRows.views = current;
      }
      return groupRows.rows;
    },

    get headerRows() {
      return this.headerGroups.length + 1;
    },

    headerCell(level, columnId) {
      return cellOver(this.headerGroups, level, columnId);
    },

    rowAt(index) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        return entry && { id: entry.id, index, original: entry.row };
      }
      const row = rows()[index];
      if (row === undefined) return undefined;
      return { id: rowIdOf(row), index, original: options.data[row] as TData };
    },

    indexOf(rowId) {
      return indexOfId(rowId);
    },

    get display() {
      return displayRows();
    },

    expandable(index) {
      return expandableAt(index);
    },

    nextExpanded(rowId, open, base = options.expanded ?? []) {
      const index = indexOfId(rowId);
      if (index === undefined || !expandableAt(index)) return undefined;
      const has = base.includes(rowId);
      if (has === open) return undefined;
      return open ? [...base, rowId] : base.filter((id) => id !== rowId);
    },

    selectableIds() {
      if (options.remote) return options.remote.loadedIds();
      return rows().map(rowIdOf);
    },

    valueAt(index, columnId) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        return entry && byId.get(columnId)?.getValue(entry.row, index);
      }
      const row = rows()[index];
      return row === undefined
        ? undefined
        : byId.get(columnId)?.getValue(options.data[row] as TData, row);
    },

    readValue(row, columnId, index) {
      return byId.get(columnId)?.getValue(row, index);
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
      const column = byId.get(columnId);
      if (row === undefined || !column) return undefined;
      const original = options.data[row] as TData;
      return {
        row: original,
        rowId: rowIdOf(row),
        index,
        columnId,
        value: column.getValue(original, row),
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
      return base === undefined ? orderState() : normalizeOrder(base, orderable(), tree);
    },

    siblingUnits(unit, base) {
      return siblingUnits(base ?? orderState(), orderable(), tree, unit, shown);
    },

    nextMove(unit, to, base) {
      return moveUnit(base ?? orderState(), orderable(), tree, unit, to, shown);
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
      return distinctValues(options.data, column, predicateFor(new Set([columnId])), limit);
    },

    indexesPassing(except) {
      if (options.remote) return undefined;
      const keep = predicateFor(new Set(except), true);
      const kept: number[] = [];
      const { data } = options;
      for (let i = 0; i < data.length; i++) {
        if (!keep || keep(data[i] as TData, i)) kept.push(i);
      }
      return kept;
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
