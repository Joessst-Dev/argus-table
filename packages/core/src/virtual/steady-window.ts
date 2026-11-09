/** The visible rows as the virtualizer reports them: indexes inclusive. */
export interface VisibleRange {
  startIndex: number;
  endIndex: number;
  overscan: number;
  count: number;
}

/**
 * The most rows of `rowHeight` px a view `viewHeight` px tall can show at once,
 * partly: one more than fit, when the view starts inside a row.
 */
export function maxVisibleRows(viewHeight: number, rowHeight: number): number {
  return viewHeight > 0 && rowHeight > 0 ? Math.ceil(viewHeight / rowHeight) + 1 : 0;
}

/**
 * The row indexes to render: the visible rows plus `overscan` on each side,
 * always the same number of rows (`maxVisible` plus twice the overscan, or all
 * rows when there are fewer). At either end the overscan that has no room goes to
 * the other side.
 *
 * The usual window is cut off at the ends instead: at the top it holds only the
 * overscan below, and the row pool grows by a row, its cells and their slots,
 * with every row scrolled until the overscan above is full. WebKit cancels a
 * wheel scroll's animation when slot assignment changes inside the scroller, so
 * from the top each wheel step moved a few px instead of a full step. A window of
 * one size fills the pool on the first render, and scrolling only reuses it.
 */
export function steadyWindow(
  { startIndex, endIndex, overscan, count }: VisibleRange,
  maxVisible: number,
): number[] {
  const visible = Math.max(maxVisible, endIndex - startIndex + 1);
  const size = Math.min(count, visible + 2 * overscan);
  const first = Math.max(0, Math.min(startIndex - overscan, count - size));
  return Array.from({ length: size }, (_, i) => first + i);
}
