import { describe, expect, it } from 'vitest';
import { COARSE_BODY, MeasuredSizes, type MeasuredLayout } from './measured-sizes.js';
import { RowSizes } from './row-sizes.js';

/** A layout of rows `ids` in that order, every row measured, no cap. */
function layout(ids: string[], patch: Partial<MeasuredLayout> = {}): MeasuredLayout {
  return {
    count: ids.length,
    rowHeight: 40,
    order: {},
    indexOf: (id) => {
      const index = ids.indexOf(id);
      return index === -1 ? undefined : index;
    },
    all: true,
    cap: () => Infinity,
    ...patch,
  };
}

const heights = (sizes: RowSizes) => Array.from({ length: sizes.count }, (_, i) => sizes.sizeOf(i));

describe('MeasuredSizes', () => {
  it('lays out unmeasured rows at the row height, measured ones at least that, in whole px', () => {
    const sizes = new RowSizes();
    const measured = new MeasuredSizes();
    measured.layout(sizes, layout(['a', 'b', 'c']));
    expect(heights(sizes)).toEqual([40, 40, 40]);
    expect(measured.set(sizes, 1, 'b', 61.3)).toBe(true);
    expect(measured.set(sizes, 2, 'c', 12)).toBe(false);
    expect(heights(sizes)).toEqual([40, 62, 40]);
    // The same height again changes nothing.
    expect(measured.set(sizes, 1, 'b', 61.3)).toBe(false);
  });

  it('follows rows by id to their positions in a new order', () => {
    const sizes = new RowSizes();
    const measured = new MeasuredSizes();
    measured.layout(sizes, layout(['a', 'b', 'c']));
    measured.set(sizes, 0, 'a', 100);
    measured.layout(sizes, layout(['c', 'b', 'a']));
    expect(heights(sizes)).toEqual([40, 40, 100]);
    // Filtered out, then back: still known.
    measured.layout(sizes, layout(['b', 'c']));
    expect(heights(sizes)).toEqual([40, 40]);
    measured.layout(sizes, layout(['a', 'b']));
    expect(heights(sizes)).toEqual([100, 40]);
  });

  it('keeps positions when only the count grows (a data source counting more)', () => {
    const sizes = new RowSizes();
    const measured = new MeasuredSizes();
    const order = {};
    measured.layout(sizes, layout(['a', 'b'], { order }));
    measured.set(sizes, 1, 'b', 80);
    measured.layout(sizes, layout(['a', 'b', 'c', 'd'], { order }));
    expect(heights(sizes)).toEqual([40, 80, 40, 40]);
  });

  it('measures every row again for a new row height or a switch between all rows and some', () => {
    const sizes = new RowSizes();
    const measured = new MeasuredSizes();
    const order = {};
    measured.layout(sizes, layout(['a', 'b'], { order }));
    measured.set(sizes, 0, 'a', 90);
    measured.layout(sizes, layout(['a', 'b'], { order, rowHeight: 30 }));
    expect(heights(sizes)).toEqual([30, 30]);
    measured.set(sizes, 0, 'a', 90);
    measured.layout(sizes, layout(['a', 'b'], { order, rowHeight: 30, all: false }));
    expect(heights(sizes)).toEqual([30, 30]);
  });

  it('rounds rows up to even px once every row is measured and the body renders past COARSE_BODY', () => {
    const count = COARSE_BODY / 40 + 10;
    const ids = Array.from({ length: count }, (_, i) => String(i));
    const sizes = new RowSizes();
    const measured = new MeasuredSizes();
    measured.layout(sizes, layout(ids, { rowHeight: 41, indexOf: (id) => Number(id) }));
    measured.set(sizes, 0, '0', 51);
    // On the 2 px grid: the row height and the measured row rounded up.
    measured.layout(sizes, layout(ids, { rowHeight: 41, indexOf: (id) => Number(id), order: {} }));
    expect(sizes.sizeOf(0)).toBe(52);
    expect(sizes.sizeOf(1)).toBe(42);
    // Capped under it: whole px again.
    const capped = layout(ids, {
      rowHeight: 41,
      indexOf: (id) => Number(id),
      cap: () => 1_000_000,
    });
    measured.layout(sizes, capped);
    expect(sizes.sizeOf(0)).toBe(51);
    // Panels only (`all: false`): never on the grid.
    measured.layout(sizes, { ...capped, cap: () => Infinity, all: false });
    measured.set(sizes, 0, '0', 51);
    expect(sizes.sizeOf(0)).toBe(51);
  });

  it('forgets every height on clear()', () => {
    const sizes = new RowSizes();
    const measured = new MeasuredSizes();
    const order = {};
    measured.layout(sizes, layout(['a'], { order }));
    measured.set(sizes, 0, 'a', 70);
    measured.clear();
    measured.layout(sizes, layout(['a'], { order }));
    expect(heights(sizes)).toEqual([40]);
  });
});
