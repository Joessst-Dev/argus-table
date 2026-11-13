import type {
  CellClickDetail,
  ColumnFiltersChangeDetail,
  ColumnOrderChangeDetail,
  ColumnPinningChangeDetail,
  ColumnResizeEndDetail,
  ColumnSizingChangeDetail,
  ColumnVisibilityChangeDetail,
  LoadErrorDetail,
  RangeChangeDetail,
  RowClickDetail,
  SelectionChangeDetail,
  SortingChangeDetail,
} from '@argus-table/core';

// A change of controllable state fires `argus-<property>-change`, with the value
// under the property's name in `detail` (ADR 0004): after the update when the table
// applied it (uncontrolled), right away with the proposed value when it is controlled.
// The wrappers derive two-way binding from that naming.

/** Fired after an update when the rows in view changed. */
export const RANGE_CHANGE = 'argus-range-change';

/** `sorting` changed (uncontrolled), or the proposed order (controlled). */
export const SORTING_CHANGE = 'argus-sorting-change';

/** `columnSizing` changed (uncontrolled), or the proposed widths (controlled). Once per column. */
export const COLUMN_SIZING_CHANGE = 'argus-column-sizing-change';

/** A user's resize is done: once per drag, key press or fit, after its sizing changes. */
export const COLUMN_RESIZE_END = 'argus-column-resize-end';

/** `columnOrder` changed (uncontrolled), or the proposed order (controlled). */
export const COLUMN_ORDER_CHANGE = 'argus-column-order-change';

/** `columnPinning` changed (uncontrolled), or the proposed pins (controlled). */
export const COLUMN_PINNING_CHANGE = 'argus-column-pinning-change';

/** `columnVisibility` changed (uncontrolled), or the proposed visibility (controlled). */
export const COLUMN_VISIBILITY_CHANGE = 'argus-column-visibility-change';

/** `columnFilters` changed (uncontrolled), or the proposed filters (controlled). */
export const COLUMN_FILTERS_CHANGE = 'argus-column-filters-change';

/** `selection` changed (uncontrolled), or the proposed ids (controlled). */
export const SELECTION_CHANGE = 'argus-selection-change';

/** Fired when a body row was clicked, after `argus-cell-click`. */
export const ROW_CLICK = 'argus-row-click';

/** Fired when a body cell was clicked, before `argus-row-click`. */
export const CELL_CLICK = 'argus-cell-click';

/** Fired after the update when a `dataSource` page failed to load. */
export const LOAD_ERROR = 'argus-load-error';

declare global {
  interface HTMLElementEventMap {
    'argus-range-change': CustomEvent<RangeChangeDetail>;
    'argus-sorting-change': CustomEvent<SortingChangeDetail>;
    'argus-column-sizing-change': CustomEvent<ColumnSizingChangeDetail>;
    'argus-column-resize-end': CustomEvent<ColumnResizeEndDetail>;
    'argus-column-order-change': CustomEvent<ColumnOrderChangeDetail>;
    'argus-column-pinning-change': CustomEvent<ColumnPinningChangeDetail>;
    'argus-column-visibility-change': CustomEvent<ColumnVisibilityChangeDetail>;
    'argus-column-filters-change': CustomEvent<ColumnFiltersChangeDetail>;
    'argus-selection-change': CustomEvent<SelectionChangeDetail>;
    'argus-row-click': CustomEvent<RowClickDetail<unknown>>;
    'argus-cell-click': CustomEvent<CellClickDetail<unknown>>;
    'argus-load-error': CustomEvent<LoadErrorDetail>;
  }
}

/** Dispatches a bubbling, composed `CustomEvent`, the shape of every public event. */
export function fire(host: HTMLElement, name: string, detail: unknown): boolean {
  return host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}
