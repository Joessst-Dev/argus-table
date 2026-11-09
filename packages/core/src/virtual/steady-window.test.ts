import { describe, expect, it } from 'vitest';
import { maxVisibleRows, steadyWindow } from './steady-window.js';

const span = (indexes: number[]) => [indexes[0], indexes.at(-1), indexes.length];

describe('maxVisibleRows', () => {
  it('counts one more row than fits, for a view that starts inside a row', () => {
    expect(maxVisibleRows(400, 40)).toBe(11);
    expect(maxVisibleRows(410, 40)).toBe(12);
  });

  it('is 0 before the view has a size', () => {
    expect(maxVisibleRows(0, 40)).toBe(0);
    expect(maxVisibleRows(400, 0)).toBe(0);
  });
});

describe('steadyWindow', () => {
  const count = 100_000;

  it('renders the visible rows with overscan on both sides', () => {
    expect(span(steadyWindow({ startIndex: 50, endIndex: 60, overscan: 6, count }, 11))).toEqual([
      44, 66, 23,
    ]);
  });

  it('moves the overscan that has no room above to below, at the top', () => {
    expect(span(steadyWindow({ startIndex: 0, endIndex: 9, overscan: 6, count }, 11))).toEqual([
      0, 22, 23,
    ]);
  });

  it('moves the overscan that has no room below to above, at the end', () => {
    expect(
      span(steadyWindow({ startIndex: 99_990, endIndex: 99_999, overscan: 6, count }, 11)),
    ).toEqual([99_977, 99_999, 23]);
  });

  it('keeps one size while scrolling from the top, whether or not the view starts inside a row', () => {
    const sizes = new Set<number>();
    for (let offset = 0; offset < 40 * 30; offset += 7) {
      const startIndex = Math.floor(offset / 40);
      const endIndex = Math.ceil((offset + 400) / 40) - 1;
      const indexes = steadyWindow({ startIndex, endIndex, overscan: 6, count }, 11);
      sizes.add(indexes.length);
      // Every visible row is rendered.
      expect(indexes[0]).toBeLessThanOrEqual(startIndex);
      expect(indexes.at(-1)).toBeGreaterThanOrEqual(endIndex);
    }
    expect([...sizes]).toEqual([23]);
  });

  it('renders every row when there are fewer than the window holds', () => {
    expect(steadyWindow({ startIndex: 0, endIndex: 4, overscan: 6, count: 5 }, 11)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(steadyWindow({ startIndex: 0, endIndex: -1, overscan: 6, count: 0 }, 11)).toEqual([]);
  });

  it('never renders fewer rows than are visible', () => {
    // Before the first layout, maxVisible is 0: the visible range decides.
    expect(span(steadyWindow({ startIndex: 0, endIndex: 9, overscan: 0, count }, 0))).toEqual([
      0, 9, 10,
    ]);
  });
});
