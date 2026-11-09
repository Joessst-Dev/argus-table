import type {
  CellClickDetail,
  ColumnReorderDetail,
  ColumnResizeDetail,
  LoadErrorDetail,
  RangeChangeDetail,
  RowClickDetail,
  RowSelectDetail,
  SortChangeDetail,
} from '@argus-table/core';

/** Fired after an update when the visible row range changed. */
export const RANGE_CHANGE = 'argus-range-change';

/** Fired after the sort order changed (uncontrolled), or with the proposed order (controlled). */
export const SORT_CHANGE = 'argus-sort-change';

/** Fired when a column was resized (uncontrolled), or with the proposed widths (controlled). */
export const COLUMN_RESIZE = 'argus-column-resize';

/** Fired when a column was moved (uncontrolled), or with the proposed order (controlled). */
export const COLUMN_REORDER = 'argus-column-reorder';

/** Fired when a body row was clicked, after `argus-cell-click`. */
export const ROW_CLICK = 'argus-row-click';

/** Fired when a body cell was clicked, before `argus-row-click`. */
export const CELL_CLICK = 'argus-cell-click';

/** Fired when the selected rows changed (uncontrolled), or with the proposed ids (controlled). */
export const ROW_SELECT = 'argus-row-select';

/** Fired after the update when a `dataSource` page failed to load. */
export const LOAD_ERROR = 'argus-load-error';

declare global {
  interface HTMLElementEventMap {
    'argus-range-change': CustomEvent<RangeChangeDetail>;
    'argus-sort-change': CustomEvent<SortChangeDetail>;
    'argus-column-resize': CustomEvent<ColumnResizeDetail>;
    'argus-column-reorder': CustomEvent<ColumnReorderDetail>;
    'argus-row-click': CustomEvent<RowClickDetail<unknown>>;
    'argus-cell-click': CustomEvent<CellClickDetail<unknown>>;
    'argus-load-error': CustomEvent<LoadErrorDetail>;
    'argus-row-select': CustomEvent<RowSelectDetail>;
  }
}

/** Dispatches a bubbling, composed `CustomEvent`, the shape of every public event. */
export function fire(host: HTMLElement, name: string, detail: unknown): boolean {
  return host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}
