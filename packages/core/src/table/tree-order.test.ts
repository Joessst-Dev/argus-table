import { describe, expect, it, vi } from 'vitest';
import { buildRowTree, type RowTree } from './row-tree.js';
import { keepWithAncestors, layoutTree, showOpen } from './tree-order.js';

interface Row {
  name: string;
  kids?: Row[];
}

const getSubRows = (row: Row) => row.kids;

// A{A1{A1a}, A2}, B{B1}: source indexes A 0, B 1, A1 2, A1a 3, A2 4, B1 5.
const fixture = () =>
  buildRowTree<Row>(
    [
      { name: 'A', kids: [{ name: 'A1', kids: [{ name: 'A1a' }] }, { name: 'A2' }] },
      { name: 'B', kids: [{ name: 'B1' }] },
    ],
    { getSubRows },
    undefined,
  );

const [A, B, A1, A1a, A2, B1] = [0, 1, 2, 3, 4, 5];

const named =
  (...names: string[]) =>
  (row: Row) =>
    names.includes(row.name);

/**
 * Rows of `order` that don't come right under their parent: each row's parent
 * must be the last row before it one level up, so parents come first and
 * depths go down by at most one step at a time.
 */
const depthFirstErrors = (tree: RowTree<Row>, order: Iterable<number>): number => {
  // The last row seen at each depth: the path from the top to the current row.
  const path: number[] = [];
  let errors = 0;
  for (const row of order) {
    const depth = tree.depth[row] ?? 0;
    const parent = tree.parent[row] ?? -1;
    if (depth > path.length || parent !== (depth === 0 ? -1 : path[depth - 1])) errors++;
    path.length = depth;
    path.push(row);
  }
  return errors;
};

describe('keepWithAncestors', () => {
  it("keeps a match's ancestors but not its descendants", () => {
    const kept = keepWithAncestors(fixture(), named('A1'));
    expect(kept.rows).toEqual([A, A1]);
    expect(kept.holdsMatch?.[A]).toBe(1);
    expect(kept.holdsMatch?.[A1]).toBe(0);
  });

  it('keeps every ancestor of a deep match, and the rows in ascending order', () => {
    const kept = keepWithAncestors(fixture(), named('A1a', 'B'));
    expect(kept.rows).toEqual([A, B, A1, A1a]);
    expect([...(kept.holdsMatch ?? [])]).toEqual([1, 0, 1, 0, 0, 0]);
  });

  it('passes the source index to the test', () => {
    const test = vi.fn((_row: Row, index: number) => index === B1);
    const kept = keepWithAncestors(fixture(), test);
    expect(kept.rows).toEqual([B, B1]);
    expect(test.mock.calls.map(([row, index]) => [row.name, index])).toEqual([
      ['A', 0],
      ['B', 1],
      ['A1', 2],
      ['A1a', 3],
      ['A2', 4],
      ['B1', 5],
    ]);
  });

  it('keeps flat rows ascending when parents come after their children', () => {
    const tree = buildRowTree(
      [
        { id: 'c', parent: 'p' },
        { id: 'x', parent: null },
        { id: 'p', parent: null },
      ],
      { getParentId: (row) => row.parent },
      (row) => row.id,
    );
    const kept = keepWithAncestors(tree, (row) => row.id === 'c');
    expect(kept.rows).toEqual([0, 2]);
    expect([...(kept.holdsMatch ?? [])]).toEqual([0, 0, 1]);
  });

  it('without a test every row is kept and holdsMatch is undefined', () => {
    const kept = keepWithAncestors(fixture(), undefined);
    expect(kept.rows).toEqual([0, 1, 2, 3, 4, 5]);
    expect(kept.holdsMatch).toBeUndefined();
  });

  it('keeps nothing when nothing matches', () => {
    const kept = keepWithAncestors(fixture(), () => false);
    expect(kept.rows).toEqual([]);
    expect([...(kept.holdsMatch ?? [])]).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('layoutTree', () => {
  it('lays out siblings in sorted order, children under their parent', () => {
    const tree = fixture();
    const layout = layoutTree(tree, [B1, A2, B, A1a, A1, A]);
    expect([...layout.order]).toEqual([B, B1, A, A2, A1, A1a]);
    expect(depthFirstErrors(tree, layout.order)).toBe(0);
    // The check catches a child before its parent and one under the wrong parent.
    expect(depthFirstErrors(tree, [A1, A])).toBe(1);
    expect(depthFirstErrors(tree, [A, B, B1, A1])).toBe(1);
    expect(layout.posInSet[A2]).toBe(1);
    expect(layout.posInSet[A1]).toBe(2);
    expect(layout.posInSet[B]).toBe(1);
    expect(layout.posInSet[A]).toBe(2);
    expect(layout.keptChildren[A]).toBe(2);
    expect(layout.keptChildren[A1]).toBe(1);
    expect(layout.keptChildren[A2]).toBe(0);
    expect([...layout.children(-1)]).toEqual([B, A]);
    expect([...layout.children(A)]).toEqual([A2, A1]);
    expect([...layout.children(A1a)]).toEqual([]);
  });

  it('lays out in source order when nothing sorts', () => {
    const tree = fixture();
    const layout = layoutTree(tree, keepWithAncestors(tree, undefined).rows);
    expect([...layout.order]).toEqual([A, A1, A1a, A2, B, B1]);
  });

  it('a row with no kept children is a leaf', () => {
    const tree = fixture();
    // Matching A1 keeps A and A1; A1a and A2 are filtered out.
    const layout = layoutTree(tree, keepWithAncestors(tree, named('A1')).rows);
    expect([...layout.order]).toEqual([A, A1]);
    expect(layout.keptChildren[A]).toBe(1);
    expect(layout.keptChildren[A1]).toBe(0);
    expect(layout.keptChildren[A2]).toBe(0);
    expect([...layout.children(A1)]).toEqual([]);
    expect([...layout.children(A2)]).toEqual([]);

    // A1 has children in the tree, but none kept: nobody asks whether it's open.
    const isOpen = vi.fn(() => false);
    expect(showOpen(tree, layout, isOpen)).toEqual([A]);
    expect(isOpen.mock.calls).toEqual([[A]]);
  });

  it('empty getSubRows results are leaves', () => {
    const tree = buildRowTree<Row>(
      [{ name: 'x' }, { name: 'y' }],
      { getSubRows: () => [] },
      undefined,
    );
    const layout = layoutTree(tree, [1, 0]);
    expect([...tree.childCount]).toEqual([0, 0]);
    expect([...layout.keptChildren]).toEqual([0, 0]);
    expect([...layout.posInSet]).toEqual([2, 1]);
    const isOpen = vi.fn(() => false);
    expect(showOpen(tree, layout, isOpen)).toEqual([1, 0]);
    expect(isOpen).not.toHaveBeenCalled();
  });

  it('lays out an empty tree', () => {
    const tree = buildRowTree<Row>([], { getSubRows }, undefined);
    const layout = layoutTree(tree, []);
    expect([...layout.order]).toEqual([]);
    expect([...layout.children(-1)]).toEqual([]);
    expect(showOpen(tree, layout, () => true)).toEqual([]);
  });
});

describe('showOpen', () => {
  it('drops rows under collapsed parents', () => {
    const tree = fixture();
    const layout = layoutTree(tree, [B1, A2, B, A1a, A1, A]);
    // A1 closed hides A1a; B closed hides B1.
    expect(showOpen(tree, layout, (index) => index === A)).toEqual([B, A, A2, A1]);
    expect(showOpen(tree, layout, () => true)).toEqual([B, B1, A, A2, A1, A1a]);
    expect(showOpen(tree, layout, () => false)).toEqual([B, A]);
  });

  it('hides a whole branch under a closed row, whatever is open below it', () => {
    const tree = fixture();
    const layout = layoutTree(tree, keepWithAncestors(tree, undefined).rows);
    expect(showOpen(tree, layout, (index) => index === A1 || index === B)).toEqual([A, B, B1]);
  });

  it('stays linear at a million rows', () => {
    // 100k parents with 9 children each: a million rows.
    const data: Row[] = [];
    for (let p = 0; p < 100_000; p++) {
      const kids: Row[] = [];
      for (let k = 0; k < 9; k++) kids.push({ name: `${String(p)}.${String(k)}` });
      data.push({ name: String(p), kids });
    }
    const tree = buildRowTree(data, { getSubRows }, undefined);
    expect(tree.rows).toHaveLength(1_000_000);

    const started = performance.now();
    const kept = keepWithAncestors(tree, (_row, index) => index % 3 === 0);
    // Reversed: a valid order of kept rows that differs from the source order.
    const layout = layoutTree(tree, kept.rows.slice().reverse());
    const shown = showOpen(tree, layout, (index) => index % 2 === 0);
    const elapsed = performance.now() - started;

    // A guard against quadratic code, not the performance target, with room for slow CI runners.
    expect(elapsed).toBeLessThan(10_000);

    expect(layout.order).toHaveLength(kept.rows.length);
    expect(shown.length).toBeGreaterThan(0);
    expect(depthFirstErrors(tree, layout.order)).toBe(0);
    expect(depthFirstErrors(tree, shown)).toBe(0);
  }, 30_000);
});
