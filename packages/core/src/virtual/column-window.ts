import { steadyWindow } from './steady-window.js';

/** Where a scrolling column sits: its start within the scrolling area and its width, in px. */
export interface ColumnExtent {
  offset: number;
  width: number;
}

/**
 * The scrolling columns a view `viewWidth` px wide shows when scrolled
 * `scrollOffset` px (always positive, RTL included), indexes inclusive.
 * `undefined` when there are no columns or the view has no width. `columns`
 * are in visual order, so their offsets ascend.
 */
export function visibleColumns(
  columns: readonly ColumnExtent[],
  scrollOffset: number,
  viewWidth: number,
): { startIndex: number; endIndex: number } | undefined {
  const count = columns.length;
  if (count === 0 || viewWidth <= 0) return undefined;
  // The first column that ends past the scroll offset.
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const c = columns[mid];
    if (c && c.offset + c.width > scrollOffset) hi = mid;
    else lo = mid + 1;
  }
  const startIndex = lo;
  // The last column that starts before the view's end.
  const end = scrollOffset + viewWidth;
  lo = startIndex;
  hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const c = columns[mid];
    if (c && c.offset < end) lo = mid;
    else hi = mid - 1;
  }
  return { startIndex, endIndex: lo };
}

/**
 * The most columns a view `viewWidth` px wide can show at once, partly ones
 * included, wherever it is scrolled. The view shows the most columns when it
 * starts just before some column's end, so that is the only place to try.
 */
export function maxVisibleColumns(columns: readonly ColumnExtent[], viewWidth: number): number {
  if (viewWidth <= 0) return 0;
  let most = 0;
  let j = 0;
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i];
    if (!c) continue;
    const limit = c.offset + c.width + viewWidth;
    j = Math.max(j, i);
    for (let next = columns[j + 1]; next && next.offset < limit; next = columns[j + 1]) j++;
    most = Math.max(most, j - i + 1);
  }
  return most;
}

/**
 * The scrolling columns to render, as indexes: the visible ones plus `overscan`
 * on each side, always the same number of them for one set of widths (like
 * rows, see `steadyWindow`: in WebKit, a column pool that grows while scrolling
 * cuts a wheel scroll short). Empty while the view has no width.
 * `maxVisible` is `maxVisibleColumns()` for these columns and this view.
 */
export function columnWindow(
  columns: readonly ColumnExtent[],
  scrollOffset: number,
  viewWidth: number,
  overscan: number,
  maxVisible: number,
): number[] {
  const visible = visibleColumns(columns, scrollOffset, viewWidth);
  if (!visible) return [];
  return steadyWindow({ ...visible, overscan, count: columns.length }, maxVisible);
}
