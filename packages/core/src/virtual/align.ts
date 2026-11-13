import type { ScrollAlign } from '../types.js';

/**
 * The scroll offset that puts an item `size` px long, starting at `start`, where
 * `align` says in a view `view` px long that is now scrolled to `offset`. All in
 * the same (logical) px. `'nearest'` keeps `offset` while the item is in view
 * in full, and shows the item's start when it is longer than the view. Never
 * negative; the caller clamps the far end.
 */
export function alignOffset(
  start: number,
  size: number,
  offset: number,
  view: number,
  align: ScrollAlign,
): number {
  const end = start + size - view;
  const target =
    align === 'start'
      ? start
      : align === 'end'
        ? end
        : align === 'center'
          ? (start + end) / 2
          : start < offset || size > view
            ? start
            : Math.max(end, offset);
  return Math.max(0, target);
}
