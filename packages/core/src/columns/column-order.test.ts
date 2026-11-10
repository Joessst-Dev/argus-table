import { describe, expect, it } from 'vitest';
import { moveColumn, normalizeOrder, type OrderableColumn } from './column-order.js';

const col = (id: string, pin?: 'start' | 'end', reorderable = true): OrderableColumn => ({
  id,
  pin,
  reorderable,
});

// Definition order mixes groups on purpose: the visual order puts pinned columns first and last.
const columns = [
  col('a'),
  col('s1', 'start'),
  col('b'),
  col('e1', 'end'),
  col('c'),
  col('s2', 'start'),
  col('e2', 'end'),
];

describe('normalizeOrder', () => {
  it('puts each group in definition order when the order is empty', () => {
    expect(normalizeOrder([], columns)).toEqual(['s1', 's2', 'a', 'b', 'c', 'e1', 'e2']);
  });

  it('follows the order within each group, whatever the groups are interleaved with', () => {
    expect(normalizeOrder(['e2', 'c', 's2', 'b', 'a', 's1', 'e1'], columns)).toEqual([
      's2',
      's1',
      'c',
      'b',
      'a',
      'e2',
      'e1',
    ]);
  });

  it('drops unknown and repeated ids, and appends missing columns to their group', () => {
    expect(normalizeOrder(['x', 'c', 'c', 's2'], columns)).toEqual([
      's2',
      's1',
      'c',
      'a',
      'b',
      'e1',
      'e2',
    ]);
  });
});

describe('moveColumn', () => {
  it('moves a column within the scrolling group', () => {
    expect(moveColumn([], columns, 'a', 4)).toEqual(['s1', 's2', 'b', 'c', 'a', 'e1', 'e2']);
    expect(moveColumn([], columns, 'c', 2)).toEqual(['s1', 's2', 'c', 'a', 'b', 'e1', 'e2']);
  });

  it('moves pinned columns within their own group', () => {
    expect(moveColumn([], columns, 's1', 1)).toEqual(['s2', 's1', 'a', 'b', 'c', 'e1', 'e2']);
    expect(moveColumn([], columns, 'e2', 5)).toEqual(['s1', 's2', 'a', 'b', 'c', 'e2', 'e1']);
  });

  it('refuses a position outside the group', () => {
    expect(moveColumn([], columns, 'a', 1)).toBeUndefined();
    expect(moveColumn([], columns, 'c', 5)).toBeUndefined();
    expect(moveColumn([], columns, 's2', 2)).toBeUndefined();
    expect(moveColumn([], columns, 'e1', 4)).toBeUndefined();
    expect(moveColumn([], columns, 'a', -1)).toBeUndefined();
  });

  it('starts from the given order', () => {
    expect(moveColumn(['c', 'b', 'a'], columns, 'a', 2)).toEqual([
      's1',
      's2',
      'a',
      'c',
      'b',
      'e1',
      'e2',
    ]);
  });

  it('returns undefined when nothing changes, for unknown columns and for fixed ones', () => {
    expect(moveColumn([], columns, 'a', 2)).toBeUndefined();
    expect(moveColumn([], columns, 'zz', 2)).toBeUndefined();
    expect(moveColumn([], columns, 'a', 2.5)).toBeUndefined();
    const fixed = [col('a', undefined, false), col('b'), col('c')];
    expect(moveColumn([], fixed, 'a', 1)).toBeUndefined();
    // Others still move past it.
    expect(moveColumn([], fixed, 'c', 0)).toEqual(['c', 'a', 'b']);
  });

  describe('with hidden columns', () => {
    const plain = [col('a'), col('h'), col('b'), col('c'), col('e', 'end')];
    const shown = (id: string) => id !== 'h';

    it('counts shown columns only and steps over hidden ones', () => {
      // a is at 0 among the shown columns [a, b, c, e]: moving it to 1 passes b and h.
      expect(moveColumn([], plain, 'a', 1, shown)).toEqual(['h', 'b', 'a', 'c', 'e']);
      expect(moveColumn([], plain, 'b', 0, shown)).toEqual(['b', 'a', 'h', 'c', 'e']);
      expect(moveColumn([], plain, 'a', 2, shown)).toEqual(['h', 'b', 'c', 'a', 'e']);
    });

    it('keeps the group bounds of the shown columns', () => {
      expect(moveColumn([], plain, 'a', 3, shown)).toBeUndefined();
      expect(moveColumn([], plain, 'c', 2, shown)).toBeUndefined();
    });

    it('refuses to move a hidden column', () => {
      expect(moveColumn([], plain, 'h', 0, shown)).toBeUndefined();
    });
  });
});
