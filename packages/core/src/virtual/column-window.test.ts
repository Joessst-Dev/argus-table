import { describe, expect, it } from 'vitest';
import {
  columnWindow,
  maxVisibleColumns,
  visibleColumns,
  type ColumnExtent,
} from './column-window.js';

/** Columns of the given widths, laid end to end. */
function columns(...widths: number[]): ColumnExtent[] {
  let offset = 0;
  return widths.map((width) => {
    const c = { offset, width };
    offset += width;
    return c;
  });
}

const even = (count: number, width = 100) => columns(...Array.from({ length: count }, () => width));
const span = (indexes: number[]) => [indexes[0], indexes.at(-1), indexes.length];

describe('visibleColumns', () => {
  it('finds the columns in view, partly visible ones included', () => {
    expect(visibleColumns(even(50), 0, 300)).toEqual({ startIndex: 0, endIndex: 2 });
    expect(visibleColumns(even(50), 150, 300)).toEqual({ startIndex: 1, endIndex: 4 });
    expect(visibleColumns(even(50), 200, 300)).toEqual({ startIndex: 2, endIndex: 4 });
  });

  it('works with columns of different widths', () => {
    const cols = columns(50, 300, 80, 80, 200, 60);
    expect(visibleColumns(cols, 0, 100)).toEqual({ startIndex: 0, endIndex: 1 });
    expect(visibleColumns(cols, 360, 200)).toEqual({ startIndex: 2, endIndex: 4 });
  });

  it('stops at the last column', () => {
    expect(visibleColumns(even(5), 300, 1000)).toEqual({ startIndex: 3, endIndex: 4 });
    expect(visibleColumns(even(5), 5000, 300)).toEqual({ startIndex: 4, endIndex: 4 });
  });

  it('is undefined without columns or before the view has a width', () => {
    expect(visibleColumns([], 0, 300)).toBeUndefined();
    expect(visibleColumns(even(5), 0, 0)).toBeUndefined();
  });
});

describe('maxVisibleColumns', () => {
  it('counts one more column than fits, for a view that starts inside a column', () => {
    expect(maxVisibleColumns(even(50), 300)).toBe(4);
    expect(maxVisibleColumns(even(50), 310)).toBe(5);
  });

  it('takes the narrowest stretch of columns', () => {
    // Four 50 px columns among wide ones: a 120 px view shows up to four of them.
    expect(maxVisibleColumns(columns(400, 50, 50, 50, 50, 400), 120)).toBe(4);
  });

  it('is never more than the column count', () => {
    expect(maxVisibleColumns(even(3), 10_000)).toBe(3);
  });

  it('is 0 before the view has a width', () => {
    expect(maxVisibleColumns(even(5), 0)).toBe(0);
  });
});

describe('columnWindow', () => {
  const cols = even(200);
  const max = maxVisibleColumns(cols, 300);

  it('renders the visible columns with overscan on both sides', () => {
    expect(span(columnWindow(cols, 5000, 300, 2, max))).toEqual([48, 55, 8]);
  });

  it('keeps one size from the start to the end', () => {
    const sizes = new Set<number>();
    for (let x = 0; x <= 200 * 100 - 300; x += 37) {
      sizes.add(columnWindow(cols, x, 300, 2, max).length);
    }
    expect([...sizes]).toEqual([8]);
  });

  it('moves the overscan that has no room to the other side', () => {
    expect(span(columnWindow(cols, 0, 300, 2, max))).toEqual([0, 7, 8]);
    expect(span(columnWindow(cols, 200 * 100 - 300, 300, 2, max))).toEqual([192, 199, 8]);
  });

  it('renders every column when they all fit', () => {
    const few = even(3);
    expect(columnWindow(few, 0, 1000, 2, maxVisibleColumns(few, 1000))).toEqual([0, 1, 2]);
  });

  it('renders none while the view has no width', () => {
    expect(columnWindow(cols, 0, 0, 2, 0)).toEqual([]);
  });
});
