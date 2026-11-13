import { describe, expect, test } from 'vitest';
import { alignOffset } from './align.js';

describe('alignOffset', () => {
  // An item 40 px long at 1000, in a view 400 px long.
  test('start puts the item at the start of the view', () => {
    expect(alignOffset(1000, 40, 0, 400, 'start')).toBe(1000);
  });

  test('end puts the item at the end of the view', () => {
    expect(alignOffset(1000, 40, 0, 400, 'end')).toBe(640);
  });

  test('center puts the item in the middle of the view', () => {
    expect(alignOffset(1000, 40, 0, 400, 'center')).toBe(820);
  });

  test('nearest keeps the offset while the item is in view in full', () => {
    expect(alignOffset(1000, 40, 800, 400, 'nearest')).toBe(800);
    expect(alignOffset(1000, 40, 1000, 400, 'nearest')).toBe(1000);
    expect(alignOffset(1000, 40, 640, 400, 'nearest')).toBe(640);
  });

  test('nearest scrolls the least distance to an item outside the view', () => {
    // Below the view: it ends at the end.
    expect(alignOffset(1000, 40, 0, 400, 'nearest')).toBe(640);
    // Partly below.
    expect(alignOffset(1000, 40, 620, 400, 'nearest')).toBe(640);
    // Above, or partly above: it starts at the start.
    expect(alignOffset(1000, 40, 2000, 400, 'nearest')).toBe(1000);
    expect(alignOffset(1000, 40, 1010, 400, 'nearest')).toBe(1000);
  });

  test('an item longer than the view shows its start', () => {
    expect(alignOffset(1000, 600, 0, 400, 'nearest')).toBe(1000);
    expect(alignOffset(1000, 600, 1100, 400, 'nearest')).toBe(1000);
    expect(alignOffset(1000, 600, 0, 400, 'center')).toBe(1100);
  });

  test('never goes below 0', () => {
    expect(alignOffset(100, 40, 0, 400, 'end')).toBe(0);
    expect(alignOffset(100, 40, 0, 400, 'center')).toBe(0);
  });
});
