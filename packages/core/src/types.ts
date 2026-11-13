/**
 * Public types shared by `@argus-table/core` and `argus-table`. `argus-table`
 * re-exports them with `TContent` fixed to its own `CellContent`.
 *
 * No TanStack type appears here: TanStack stays an implementation detail.
 */

/** Logical side of a pinned column: `'start'` is the left in LTR and the right in RTL. */
export type ColumnPin = 'start' | 'end';

/** Side of a pinned row: `'top'` (below the header) or `'bottom'`. */
export type RowPin = 'top' | 'bottom';

/**
 * Rows fixed above or below the scrolling body, such as a totals row. They are
 * separate objects, not rows of `data`: never sorted, and not counted as data rows.
 */
export interface PinnedRows<TData> {
  /** Rows pinned below the header, in order. */
  top?: readonly TData[];
  /** Rows pinned to the bottom, in order. */
  bottom?: readonly TData[];
}

/** Text alignment inside a cell, in logical terms. */
export type ColumnAlign = 'start' | 'center' | 'end';

/**
 * Column width: a fixed pixel width, `'auto'` to fit the content, or a share of
 * the free space (`{ flex: 1 }`).
 */
export type ColumnWidth = number | 'auto' | { flex: number };

/** What a `cell` function receives besides the row itself. */
export interface CellContext<TData> {
  /** The row object from `data` (or from `pinnedRows`). */
  row: TData;
  /**
   * The id from `getRowId`, or the row's index as a string. A pinned row without
   * `getRowId` gets `'top-0'`, `'bottom-0'` and so on.
   */
  rowId: string;
  /** Index of the row in the current (filtered and sorted) row model; for a pinned row, its index in its list. */
  index: number;
  /** The column's id. */
  columnId: string;
  /** The value read by the column's `accessor`, or `undefined` without one. */
  value: unknown;
  /** Set for a row from `pinnedRows`: the side it is pinned to. */
  pinned?: RowPin;
}

/**
 * One column of the table.
 *
 * @typeParam TData - the row type.
 * @typeParam TContent - what `header` and `cell` may return. `argus-table`
 *   fixes it to `CellContent` (a Lit template, a DOM node, a string or a number).
 */
export interface ColumnDef<TData, TContent = unknown> {
  /** Stable key, used in state objects, events and persistence. Must be unique. */
  id: string;
  /** Header content, or a function that returns it. */
  header?: TContent | (() => TContent);
  /**
   * How to read the cell value: a property path such as `'customer.name'`, or a
   * function of the row. Without an accessor the value is `undefined`; the column
   * then needs a `cell` function to show anything.
   */
  accessor?: string | ((row: TData, index: number) => unknown);
  /**
   * A spreadsheet formula computed per row from other columns, such as
   * `'[price] * [quantity]'`. The `formulas()` plugin from `@argus-table/formulas`
   * reads it and replaces `accessor`; without that plugin the table ignores it.
   */
  formula?: string;
  /** Custom cell content. Without it, the cell shows the accessor's value as text. */
  cell?: (row: TData, context: CellContext<TData>) => TContent;
  /**
   * Fixed width in px, `'auto'` to fit the content, or `{ flex }` for a share of the
   * free space (at least `minWidth`). Pinned columns ignore `flex`. Default: 150 px.
   *
   * `'auto'` fits the header, the pinned rows and the rendered body rows, within
   * `minWidth` and `maxWidth`. It measures once the first loaded rows render, then keeps
   * that width; `autosizeColumns()` fits it again.
   */
  width?: ColumnWidth;
  /** Lower bound for resizing and for flex columns, in px. Default: 40. */
  minWidth?: number;
  /** Upper bound for resizing, in px. Default: no limit. */
  maxWidth?: number;
  /**
   * Pins the column to the start or end side. `columnPinning` overrides it for a
   * column it lists.
   */
  pin?: ColumnPin;
  /**
   * Hides the column: it isn't rendered, but its values still sort and its formulas
   * still read it. `columnVisibility` overrides it for a column it lists. Default: `false`.
   */
  hidden?: boolean;
  /** Whether the header can be clicked to sort. Default: `false`. */
  sortable?: boolean;
  /** Whether the column can be resized. Default: `true`. */
  resizable?: boolean;
  /**
   * Whether the column can be moved by dragging its header or with Alt+Shift+Arrow.
   * Default: `true`. Columns move within their own group (start-pinned, scrolling or
   * end-pinned). Other columns can still move past one that sets `false`.
   */
  reorderable?: boolean;
  /**
   * Whether the user can pin or unpin the column, for example from the column menu.
   * Default: `true`. `pin` and `columnPinning` still apply.
   */
  pinnable?: boolean;
  /**
   * Whether the user can hide the column, for example from the column menu.
   * Default: `true`. `hidden` and `columnVisibility` still apply.
   */
  hideable?: boolean;
  /**
   * The kind of filter users can set on the column, for example from the column menu:
   * `'text'`, `'number'`, `'date'` or `'set'` (pick from a list of values). Without it
   * users can't filter the column; `columnFilters` still applies.
   */
  filter?: FilterKind;
  /**
   * Replaces the built-in matching for this column: return `true` to keep the row.
   * Receives the value read by `accessor`, the column's filter and the row.
   */
  filterFn?: (value: unknown, filter: ColumnFilter, row: TData) => boolean;
  /**
   * The values a `'set'` filter offers. Needed with a `dataSource`; with `data` the
   * table lists the distinct values of the column when this isn't set.
   */
  filterOptions?: readonly FilterValue[];
  /** Text alignment. Default: `'start'`. */
  align?: ColumnAlign;
  /**
   * Wraps the cell text onto more lines instead of cutting it off. Default:
   * `false`. With a fixed row height the row doesn't grow: one or two lines stay
   * centred, longer text starts at the top and what doesn't fit is clipped. The
   * header doesn't wrap. With `width: 'auto'` the column fits its unwrapped
   * text, up to `maxWidth`.
   */
  wrap?: boolean;
}

/** A sort direction: ascending or descending. */
export type SortDirection = 'asc' | 'desc';

/** One sorted column. */
export interface SortItem {
  /** The column's id. */
  id: string;
  /** `true` for descending order. */
  desc: boolean;
}

/**
 * The sort order: an empty array when unsorted. Several items sort by each in turn
 * (the first decides, the next breaks ties). A header click replaces the order with
 * that one column; sorting by several columns is set by the host or a plugin.
 */
export type SortState = readonly SortItem[];

/**
 * A header over several columns (`columnGroups`). Groups nest: a group lists column
 * ids and other groups, and each level of nesting adds a header row above the
 * column headers. The columns of a group stay next to each other in the column
 * order; a group whose columns are pinned to different sides shows once per side.
 */
export interface ColumnGroup<TContent = unknown> {
  /** Stable key. Unique among groups; it may equal a column id. */
  id: string;
  /** Header content, or a function returning it. Default: the id. */
  header?: TContent | (() => TContent);
  /**
   * Whether the group can be moved as a whole (a drag on its header, Alt+Shift+Arrow
   * on it). Default: `true`. Its columns can still move within it.
   */
  reorderable?: boolean;
  /**
   * The group's columns (by id) and groups, in order. Unknown ids are ignored, and
   * a column listed twice belongs to the first group that lists it.
   */
  columns: readonly (string | ColumnGroup<TContent>)[];
}

/** Column widths in px set by resizing, keyed by column id. */
export type ColumnSizingState = Record<string, number>;

/**
 * The column order: column ids as the table shows them (start-pinned, scrolling,
 * end-pinned). An empty array means the order of `columns`.
 */
export type ColumnOrderState = readonly string[];

/**
 * Pins set at runtime, keyed by column id: `'start'` or `'end'` pins a column, `false`
 * unpins a column whose definition pins it. A column not listed keeps its `pin`.
 */
export type ColumnPinningState = Record<string, ColumnPin | false>;

/**
 * Visibility set at runtime, keyed by column id: `false` hides a column, `true` shows
 * a column whose definition is `hidden`. A column not listed keeps its `hidden`.
 */
export type ColumnVisibilityState = Record<string, boolean>;

/** The kinds of filter a column can offer. */
export type FilterKind = 'text' | 'number' | 'date' | 'set';

/** A value a `'set'` filter can pick. */
export type FilterValue = string | number | boolean | null;

/** Comparisons of a `'text'` filter. `'empty'` and `'notEmpty'` ignore `value`. */
export type TextFilterOp = 'contains' | 'equals' | 'startsWith' | 'empty' | 'notEmpty';

/**
 * Comparisons of a `'number'` or `'date'` filter. `'between'` is inclusive and needs
 * `to`; `'empty'` and `'notEmpty'` ignore `value`.
 */
export type RangeFilterOp =
  'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge' | 'between' | 'empty' | 'notEmpty';

/** Keeps rows whose value as text matches, ignoring case. */
export interface TextFilter {
  kind: 'text';
  op: TextFilterOp;
  value?: string;
}

/** Keeps rows whose number compares as `op` says. */
export interface NumberFilter {
  kind: 'number';
  op: RangeFilterOp;
  value?: number;
  /** The upper bound of `'between'`. */
  to?: number;
}

/**
 * Keeps rows whose date compares as `op` says, by local day. `value` and `to` are
 * ISO dates (`'2026-11-10'`); cell values can be `Date`s, timestamps or ISO strings.
 */
export interface DateFilter {
  kind: 'date';
  op: RangeFilterOp;
  value?: string;
  /** The last day of `'between'`. */
  to?: string;
}

/** Keeps rows whose value is one of `values` (`null` stands for an empty value). */
export interface SetFilter {
  kind: 'set';
  values: readonly FilterValue[];
}

/** One column's filter. */
export type ColumnFilter = TextFilter | NumberFilter | DateFilter | SetFilter;

/**
 * Filters set at runtime, keyed by column id. A row shows when it passes every filter
 * (and `quickFilter`). Filters on hidden columns still apply; unknown ids are ignored.
 */
export type ColumnFilterState = Record<string, ColumnFilter>;

/**
 * How rows can be selected: `'none'` (the default), `'single'` (one row at a time)
 * or `'multi'` (any number, with Ctrl/Cmd and Shift).
 */
export type SelectionMode = 'none' | 'single' | 'multi';

/** The selected rows, as row ids (from `getRowId`, or the row's index as a string). */
export type SelectionState = readonly string[];

/**
 * Where the body is scrolled: the row at the top, as an index in the current row
 * order, and the inline offset in px from the start edge (positive in RTL too).
 */
export interface ScrollState {
  /** The row at the top, as an index in the current row order. */
  row: number;
  /** The inline offset in px from the start edge, positive in RTL too. */
  inline: number;
}

/**
 * Where `scrollToRow()` and `scrollToColumn()` put their target in the view:
 * `'start'` at the start (just past the header and pinned rows, or the
 * start-pinned columns), `'end'` at the end, `'center'` in the middle, and
 * `'nearest'` only as far as needed to show it in full (not at all when it is).
 */
export type ScrollAlign = 'start' | 'center' | 'end' | 'nearest';

/** Options of `scrollToRow()`. */
export interface ScrollToRowOptions {
  /** Where the row goes in the view. Default `'start'`. */
  align?: ScrollAlign;
}

/** Options of `scrollToColumn()`. */
export interface ScrollToColumnOptions {
  /** Where the column goes in the scrolling area. Default `'nearest'`. */
  align?: ScrollAlign;
}

/**
 * A row for `scrollToRow()`: its index in the current row order (after sorting
 * and filtering), or its id (`getRowId`'s).
 */
export type RowTarget = number | { id: string };

/**
 * The state users change, as one object of plain JSON, for saving a user's layout:
 * `getState()` returns every key, and `setState()` applies the keys it is given.
 */
export interface TableState {
  /**
   * The format of the object: `1`. `getState()` sets it; `setState()` ignores an
   * object with another version, and takes one without it as version 1.
   */
  version?: 1;
  sorting?: SortState;
  columnSizing?: ColumnSizingState;
  columnOrder?: ColumnOrderState;
  columnPinning?: ColumnPinningState;
  columnVisibility?: ColumnVisibilityState;
  columnFilters?: ColumnFilterState;
  selection?: SelectionState;
  quickFilter?: string;
  scroll?: ScrollState;
}

/** `detail` of `argus-selection-change`. */
export interface SelectionChangeDetail {
  /** The selected row ids: the new ones, or the proposed ones when `selection` is controlled. */
  selection: SelectionState;
}

/** `detail` of `argus-sorting-change`. */
export interface SortingChangeDetail {
  /** The sort order: the new one, or the proposed one when `sorting` is controlled. */
  sorting: SortState;
}

/** `detail` of `argus-column-sizing-change`: fires once per column that changed width. */
export interface ColumnSizingChangeDetail {
  /** The whole new sizing state, or the proposed one when `columnSizing` is controlled. */
  columnSizing: ColumnSizingState;
  /** The column resized. */
  columnId: string;
  /** Its new width in px. */
  width: number;
}

/**
 * `detail` of `argus-column-resize-end`: fires once when a resize is done (a
 * drag released, an Alt+Arrow press, a fit to content), for persisting widths.
 */
export interface ColumnResizeEndDetail {
  /** The sizing state after the resize, or the last proposed one when `columnSizing` is controlled. */
  columnSizing: ColumnSizingState;
  /** The columns whose width the resize changed. */
  columnIds: string[];
}

/** `detail` of `argus-column-order-change`. */
export interface ColumnOrderChangeDetail {
  /** The whole new order, or the proposed one when `columnOrder` is controlled. */
  columnOrder: ColumnOrderState;
  /** The column that moved; for a group, its first column that moved. */
  columnId: string;
  /** The group that moved, when a group header was moved rather than a column. */
  groupId?: string;
}

/** `detail` of `argus-column-pinning-change`: fires when a column is pinned and when it is unpinned. */
export interface ColumnPinningChangeDetail {
  /** The whole new pinning state, or the proposed one when `columnPinning` is controlled. */
  columnPinning: ColumnPinningState;
  /** The column pinned or unpinned. */
  columnId: string;
  /** Its new pin, or `false` when it no longer is pinned. */
  pin: ColumnPin | false;
}

/** `detail` of `argus-column-visibility-change`: fires when a column is hidden and when it is shown. */
export interface ColumnVisibilityChangeDetail {
  /** The whole new visibility state, or the proposed one when `columnVisibility` is controlled. */
  columnVisibility: ColumnVisibilityState;
  /** The column hidden or shown. */
  columnId: string;
  /** `true` when the column was shown, `false` when it was hidden: as in `columnVisibility`. */
  visible: boolean;
}

/** `detail` of `argus-column-filters-change`: fires when a column's filter is set, changed or cleared. */
export interface ColumnFiltersChangeDetail {
  /** The whole new filter state, or the proposed one when `columnFilters` is controlled. */
  columnFilters: ColumnFilterState;
  /** The column filtered. */
  columnId: string;
  /** Its new filter, or `undefined` when it was cleared. */
  columnFilter: ColumnFilter | undefined;
}

/** `detail` of `argus-row-click`. */
export interface RowClickDetail<TData> {
  row: TData;
  rowId: string;
  /** Index in the current row order; for a pinned row, its index in its list. */
  index: number;
  /** Set when the row is from `pinnedRows`: the side it is pinned to. */
  pinned?: RowPin;
}

/** `detail` of `argus-cell-click`. */
export interface CellClickDetail<TData> {
  row: TData;
  rowId: string;
  /** Index of the row in the current row order; for a pinned row, its index in its list. */
  index: number;
  columnId: string;
  value: unknown;
  /** Set when the row is from `pinnedRows`: the side it is pinned to. */
  pinned?: RowPin;
}

/**
 * `detail` of `argus-range-change`: the first and last row in view, as indexes in the
 * current order (both inclusive). Rows rendered ahead of the scroll position don't count.
 */
export interface RangeChangeDetail {
  /** Index of the first row in view. */
  first: number;
  /** Index of the last row in view, inclusive. */
  last: number;
}

/** What `getRows()` receives: a range of rows, the sort order, the filters and an abort signal. */
export interface RowsRequest {
  /** Index of the first row, inclusive. */
  start: number;
  /** Index after the last row: exclusive, like `Array.prototype.slice`. */
  end: number;
  /** The current sort order; sorting happens on the server. `[]` when unsorted. */
  sorting: SortState;
  /** The column filters; filtering happens on the server. `{}` when nothing is filtered. */
  filters: ColumnFilterState;
  /** The `quickFilter` text to match in any column. `''` when unset. */
  quickFilter: string;
  /** Aborted when the rows are no longer needed: scrolled far away, or the source was reset. */
  signal: AbortSignal;
}

/** What `getRows()` resolves to. */
export interface RowsResponse<TData> {
  /** The rows from `start`, at most `end - start` of them. */
  rows: readonly TData[];
  /**
   * Total number of rows, if known. Without it, the table grows as pages arrive,
   * and a page with fewer rows than asked for marks the end.
   */
  total?: number;
}

/** A remote source of rows, loaded page by page as they scroll into view. */
export interface DataSource<TData> {
  /** Loads one page of rows. Reject (or throw) to show the page as failed, with a Retry button. */
  getRows(request: RowsRequest): Promise<RowsResponse<TData>>;
  /** Rows per request. Default: 100. */
  pageSize?: number;
}

/** `detail` of `argus-load-error`: what `getRows()` rejected with, and the rows it was asked for. */
export interface LoadErrorDetail {
  error: unknown;
  /** Index of the first row, inclusive. */
  start: number;
  /** Index after the last row, exclusive. */
  end: number;
}
