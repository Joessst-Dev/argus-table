import { describe, expect, it } from 'vitest';
import { EMPTY_TREE, resolveColumnGroups } from './column-groups.js';
import { moveUnit, normalizeOrder, siblingUnits, type OrderableColumn } from './column-order.js';

/** Moves a column without groups; `to` counts the shown columns of its pin side. */
const moveColumn = (
  order: readonly string[],
  cols: readonly OrderableColumn[],
  id: string,
  to: number,
  shown?: (id: string) => boolean,
) => moveUnit(order, cols, EMPTY_TREE, { kind: 'column', id }, to, shown);

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

describe('moveUnit: columns', () => {
  it('moves a column within the scrolling group', () => {
    expect(moveColumn([], columns, 'a', 2)).toEqual(['s1', 's2', 'b', 'c', 'a', 'e1', 'e2']);
    expect(moveColumn([], columns, 'c', 0)).toEqual(['s1', 's2', 'c', 'a', 'b', 'e1', 'e2']);
  });

  it('moves pinned columns within their own group', () => {
    expect(moveColumn([], columns, 's1', 1)).toEqual(['s2', 's1', 'a', 'b', 'c', 'e1', 'e2']);
    expect(moveColumn([], columns, 'e2', 0)).toEqual(['s1', 's2', 'a', 'b', 'c', 'e2', 'e1']);
  });

  it('refuses a position outside the pin side', () => {
    expect(moveColumn([], columns, 'c', 3)).toBeUndefined();
    expect(moveColumn([], columns, 's2', 2)).toBeUndefined();
    expect(moveColumn([], columns, 'e1', 2)).toBeUndefined();
    expect(moveColumn([], columns, 'a', -1)).toBeUndefined();
  });

  it('starts from the given order', () => {
    expect(moveColumn(['c', 'b', 'a'], columns, 'a', 0)).toEqual([
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
    expect(moveColumn([], columns, 'a', 0)).toBeUndefined();
    expect(moveColumn([], columns, 'zz', 2)).toBeUndefined();
    expect(moveColumn([], columns, 'a', 1.5)).toBeUndefined();
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

    it('keeps the bounds of the shown columns of the side', () => {
      expect(moveColumn([], plain, 'a', 3, shown)).toBeUndefined();
      expect(moveColumn([], plain, 'c', 2, shown)).toBeUndefined();
    });

    it('refuses to move a hidden column', () => {
      expect(moveColumn([], plain, 'h', 0, shown)).toBeUndefined();
    });
  });
});

describe('with column groups', () => {
  // Visual order without groups: s1 | a b c d e | x1
  const cols = [
    col('s1', 'start'),
    col('a'),
    col('b'),
    col('c'),
    col('d'),
    col('e'),
    col('x1', 'end'),
  ];
  const ids = new Set(cols.map((c) => c.id));
  // G = [a, H = [c, d]], K = [e]; b is ungrouped.
  const tree = resolveColumnGroups(
    [
      { id: 'G', columns: ['a', { id: 'H', columns: ['c', 'd'] }] },
      { id: 'K', columns: ['e'] },
    ],
    ids,
  );
  const column = (id: string) => ({ kind: 'column' as const, id });
  const group = (id: string, pin?: 'start' | 'end') => ({ kind: 'group' as const, id, pin });

  it('keeps the columns of a group together, where its first column is', () => {
    expect(normalizeOrder([], cols, tree)).toEqual(['s1', 'a', 'c', 'd', 'b', 'e', 'x1']);
    expect(normalizeOrder(['d', 'b', 'a', 'e', 'c'], cols, tree)).toEqual([
      's1',
      'd',
      'c',
      'a',
      'b',
      'e',
      'x1',
    ]);
  });

  it('splits a group across pin sides and keeps each part together', () => {
    const pinned = cols.map((c) => (c.id === 'd' ? col('d', 'start') : c));
    expect(normalizeOrder([], pinned, tree)).toEqual(['s1', 'd', 'a', 'c', 'b', 'e', 'x1']);
  });

  it('lists the siblings of a column and of a group', () => {
    const units = (u: Parameters<typeof siblingUnits>[3]) =>
      siblingUnits([], cols, tree, u).map((s) => [s.unit.id, s.columns]);
    expect(units(column('b'))).toEqual([
      ['G', ['a', 'c', 'd']],
      ['b', ['b']],
      ['K', ['e']],
    ]);
    expect(units(group('G'))).toEqual(units(column('b')));
    expect(units(column('a'))).toEqual([
      ['a', ['a']],
      ['H', ['c', 'd']],
    ]);
    expect(units(column('c'))).toEqual([
      ['c', ['c']],
      ['d', ['d']],
    ]);
    expect(units(group('G', 'start'))).toEqual([]);
  });

  it('moves a group as a block among its siblings', () => {
    expect(moveUnit([], cols, tree, group('G'), 2)).toEqual(['s1', 'b', 'e', 'a', 'c', 'd', 'x1']);
    expect(moveUnit([], cols, tree, group('K'), 0)).toEqual(['s1', 'e', 'a', 'c', 'd', 'b', 'x1']);
    expect(moveUnit([], cols, tree, group('H'), 0)).toEqual(['s1', 'c', 'd', 'a', 'b', 'e', 'x1']);
  });

  it('moves a column only within its innermost group', () => {
    expect(moveUnit([], cols, tree, column('d'), 0)).toEqual(['s1', 'a', 'd', 'c', 'b', 'e', 'x1']);
    expect(moveUnit([], cols, tree, column('d'), 2)).toBeUndefined();
    expect(moveUnit([], cols, tree, column('b'), 0)).toEqual(['s1', 'b', 'a', 'c', 'd', 'e', 'x1']);
  });

  it('carries hidden columns of a group along and steps over hidden ones', () => {
    const shown = (id: string) => id !== 'c';
    expect(siblingUnits([], cols, tree, column('a'), shown).map((s) => s.columns)).toEqual([
      ['a'],
      ['d'],
    ]);
    expect(moveUnit([], cols, tree, group('G'), 2, shown)).toEqual([
      's1',
      'b',
      'e',
      'a',
      'c',
      'd',
      'x1',
    ]);
  });

  it("refuses a group with a column that can't move", () => {
    const fixed = cols.map((c) => (c.id === 'a' ? col('a', undefined, false) : c));
    expect(moveUnit([], fixed, tree, group('G'), 1)).toBeUndefined();
    expect(moveUnit([], fixed, tree, group('K'), 0)).toEqual(['s1', 'e', 'a', 'c', 'd', 'b', 'x1']);
  });
});
