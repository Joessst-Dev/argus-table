/**
 * Public types shared by `@argus-table/core` and `argus-table`. `argus-table`
 * re-exports them with `TContent` fixed to its own `CellContent`.
 *
 * No TanStack type appears here: TanStack stays an implementation detail.
 */

/** Logical side of a pinned column: `'start'` is the left in LTR and the right in RTL. */
export type ColumnPin = 'start' | 'end';

/** Text alignment inside a cell, in logical terms. */
export type ColumnAlign = 'start' | 'center' | 'end';

/**
 * Column width: a fixed pixel width, or a share of the free space (`{ flex: 1 }`).
 * `'auto'` (fit to content) arrives in Phase 2.
 */
export type ColumnWidth = number | { flex: number };

/** What a `cell` function receives besides the row itself. */
export interface CellContext<TData> {
  /** The row object from `data`. */
  row: TData;
  /** The id from `getRowId`, or the row's index as a string. */
  rowId: string;
  /** Index of the row in the current (sorted) row model. */
  index: number;
  /** The column's id. */
  columnId: string;
  /** The value read by the column's `accessor`, or `undefined` without one. */
  value: unknown;
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
   * Fixed width in px, or `{ flex }` for a share of the free space (at least `minWidth`).
   * Pinned columns ignore `flex`. Default: 150 px.
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

/** `detail` of `argus-row-click`. */
export interface RowClickDetail<TData> {
  row: TData;
  rowId: string;
  index: number;
}

/** `detail` of `argus-cell-click`. */
export interface CellClickDetail<TData> {
  row: TData;
  columnId: string;
  value: unknown;
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
