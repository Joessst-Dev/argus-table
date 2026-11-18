import type { HeaderGroupCell } from '../columns/column-groups.js';
import type { OrderUnit, SiblingUnit } from '../columns/column-order.js';
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
import type { DisplayRows } from './display-rows.js';

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
  /**
   * Width in px as rendered: the own width, plus a share of the free space when
   * the table stretches its columns (`stretch`).
   */
  width: number;
  /** The column's own width in px (a resized width wins over its definition's), unstretched. */
  ownWidth: number;
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
  /**
   * Stretches the scrolling columns to fill `width` px (the table's inner width)
   * when they are narrower: the columns without a `columnSizing` entry share the
   * space in proportion to their own widths, up to their `maxWidth`; what they
   * can't take goes to the last scrolling columns that can, except those in
   * `keep` (the columns the last resize changed). Nothing stretches while an
   * unresized flex column is shown.
   */
  stretch?: { width: number; keep?: readonly string[] | undefined } | undefined;
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
