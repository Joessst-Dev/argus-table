import type {
  CellClickDetail,
  ColumnFilterDetail,
  ColumnHideDetail,
  ColumnPinDetail,
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

/** Fired when a column was pinned or unpinned (uncontrolled), or with the proposed pins (controlled). */
export const COLUMN_PIN = 'argus-column-pin';

/** Fired when a column was hidden or shown (uncontrolled), or with the proposed visibility (controlled). */
export const COLUMN_HIDE = 'argus-column-hide';

/** Fired when a column's filter was set, changed or cleared (uncontrolled), or with the proposed filters (controlled). */
export const COLUMN_FILTER = 'argus-column-filter';

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
    'argus-column-pin': CustomEvent<ColumnPinDetail>;
    'argus-column-hide': CustomEvent<ColumnHideDetail>;
    'argus-column-filter': CustomEvent<ColumnFilterDetail>;
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
