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
  /** Index of the row in the current (sorted) row model; for a pinned row, its index in its list. */
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
  /** Pins the column to the start or end side. */
  pin?: ColumnPin;
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
  /** Text alignment. Default: `'start'`. */
  align?: ColumnAlign;
}

/** One sorted column. */
export interface SortItem {
  /** The column's id. */
  id: string;
  /** `true` for descending order. */
  desc: boolean;
}

/** The sort order: an empty array when unsorted. v0.1 sorts by one column at a time. */
export type SortState = SortItem[];

/** Column widths in px set by resizing, keyed by column id. */
export type ColumnSizingState = Record<string, number>;

/**
 * The column order: column ids as the table shows them (start-pinned, scrolling,
 * end-pinned). An empty array means the order of `columns`.
 */
export type ColumnOrderState = string[];

/**
 * How rows can be selected: `'none'` (the default), `'single'` (one row at a time)
 * or `'multi'` (any number, with Ctrl/Cmd and Shift).
 */
export type SelectionMode = 'none' | 'single' | 'multi';

/** The selected rows, as row ids (from `getRowId`, or the row's index as a string). */
export type SelectionState = string[];

/** `detail` of `argus-row-select`. */
export interface RowSelectDetail {
  /** The selected row ids: the new ones, or the proposed ones when `selection` is controlled. */
  selection: SelectionState;
}

/** `detail` of `argus-sort-change`. */
export interface SortChangeDetail {
  sorting: SortState;
}

/** `detail` of `argus-column-resize`. */
export interface ColumnResizeDetail {
  columnId: string;
  width: number;
  sizing: ColumnSizingState;
}

/** `detail` of `argus-column-reorder`. */
export interface ColumnReorderDetail {
  /** The column that moved. */
  columnId: string;
  /** The whole new order. */
  order: ColumnOrderState;
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
  columnId: string;
  value: unknown;
  /** Set when the row is from `pinnedRows`: the side it is pinned to. */
  pinned?: RowPin;
}

/** `detail` of `argus-range-change`: the first and last rendered row index (inclusive). */
export interface RangeChangeDetail {
  start: number;
  end: number;
}

/** What `getRows()` receives: a range of rows, the sort order and an abort signal. */
export interface RowsRequest {
  /** Index of the first row, inclusive. */
  start: number;
  /** Index after the last row: exclusive, like `Array.prototype.slice`. */
  end: number;
  /** The current sort order; sorting happens on the server. `[]` when unsorted. */
  sorting: SortState;
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
