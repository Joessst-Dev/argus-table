import type { ColumnResizeDetail, RangeChangeDetail, SortChangeDetail } from '@argus-table/core';

/** Fired after an update when the visible row range changed. */
export const RANGE_CHANGE = 'argus-range-change';

/** Fired after the sort order changed (uncontrolled), or with the proposed order (controlled). */
export const SORT_CHANGE = 'argus-sort-change';

/** Fired when a column was resized (uncontrolled), or with the proposed widths (controlled). */
export const COLUMN_RESIZE = 'argus-column-resize';

declare global {
  interface HTMLElementEventMap {
    'argus-range-change': CustomEvent<RangeChangeDetail>;
    'argus-sort-change': CustomEvent<SortChangeDetail>;
    'argus-column-resize': CustomEvent<ColumnResizeDetail>;
  }
}

/** Dispatches a bubbling, composed `CustomEvent`, the shape of every public event. */
export function fire(host: HTMLElement, name: string, detail: unknown): boolean {
  return host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}
