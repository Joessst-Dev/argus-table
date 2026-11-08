import { describe, expect, test } from 'vitest';
import { dropTarget, type DropSlot } from './reorder-drag.js';

// Three scrolling columns at positions 2–4 of the whole order, 100 px each.
const ltr: DropSlot[] = [
  { id: 'a', index: 2, rect: { left: 0, right: 100 } },
  { id: 'b', index: 3, rect: { left: 100, right: 200 } },
  { id: 'c', index: 4, rect: { left: 200, right: 300 } },
];
// The same group in RTL: reading order runs right to left.
const rtl: DropSlot[] = ltr.map((s) => ({
  ...s,
  rect: { left: 300 - s.rect.right, right: 300 - s.rect.left },
}));

describe('dropTarget', () => {
  test('lands in the gap nearest the pointer, by header midpoints', () => {
    expect(dropTarget(ltr, 'a', 160, 1)).toEqual({ to: 3, columnId: 'c', edge: 'start' });
    expect(dropTarget(ltr, 'a', 260, 1)).toEqual({ to: 4, columnId: 'c', edge: 'end' });
    expect(dropTarget(ltr, 'c', 40, 1)).toEqual({ to: 2, columnId: 'a', edge: 'start' });
    expect(dropTarget(ltr, 'c', 140, 1)).toEqual({ to: 3, columnId: 'b', edge: 'start' });
  });

  test('is undefined where the column would stay put', () => {
    expect(dropTarget(ltr, 'b', 60, 1)).toBeUndefined();
    expect(dropTarget(ltr, 'b', 240, 1)).toBeUndefined();
    expect(dropTarget(ltr, 'zz', 240, 1)).toBeUndefined();
    expect(dropTarget([], 'a', 0, 1)).toBeUndefined();
  });

  test('mirrors in RTL', () => {
    // 'c' is the leftmost header in RTL; past its middle is the end of the group.
    expect(dropTarget(rtl, 'a', 40, -1)).toEqual({ to: 4, columnId: 'c', edge: 'end' });
    expect(dropTarget(rtl, 'a', 140, -1)).toEqual({ to: 3, columnId: 'c', edge: 'start' });
    expect(dropTarget(rtl, 'c', 260, -1)).toEqual({ to: 2, columnId: 'a', edge: 'start' });
  });
});
