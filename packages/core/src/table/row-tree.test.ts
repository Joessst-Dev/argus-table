import { describe, expect, it, vi } from 'vitest';
import { buildRowTree } from './row-tree.js';

interface Nested {
  name: string;
  kids?: Nested[];
}

interface Flat {
  id: string;
  parent: string | null;
}

const getSubRows = (row: Nested) => row.kids;

// a{a0{a00}, a1}, b
const nested = (): Nested[] => [
  { name: 'a', kids: [{ name: 'a0', kids: [{ name: 'a00' }] }, { name: 'a1' }] },
  { name: 'b' },
];

const names = (rows: readonly Nested[]) => rows.map((row) => row.name);

describe('buildRowTree', () => {
  it('nested rows get source indexes after data, depth first', () => {
    const data = nested();
    const tree = buildRowTree(data, { getSubRows }, undefined);
    expect(names(tree.rows)).toEqual(['a', 'b', 'a0', 'a00', 'a1']);
    expect(tree.rows[0]).toBe(data[0]);
    expect(tree.rows[1]).toBe(data[1]);
    expect([...tree.parent]).toEqual([-1, -1, 0, 2, 0]);
    expect([...tree.depth]).toEqual([0, 0, 1, 2, 1]);
    expect([...tree.childCount]).toEqual([2, 0, 1, 0, 0]);
  });

  it("nested default ids are the parent's id and the index among siblings", () => {
    expect(buildRowTree(nested(), { getSubRows }, undefined).ids).toEqual([
      '0',
      '1',
      '0.0',
      '0.0.0',
      '0.1',
    ]);

    const calls: [string, number][] = [];
    const getRowId = (row: Nested, index: number) => {
      calls.push([row.name, index]);
      return row.name;
    };
    const tree = buildRowTree(nested(), { getSubRows }, getRowId);
    expect(tree.ids).toEqual(['a', 'b', 'a0', 'a00', 'a1']);
    // getRowId gets each row with its source index.
    expect(calls).toHaveLength(5);
    expect(calls).toEqual(
      expect.arrayContaining([
        ['a', 0],
        ['b', 1],
        ['a0', 2],
        ['a00', 3],
        ['a1', 4],
      ]),
    );
  });

  it('flat rows find their parent by id', () => {
    // Children come before their parents in data.
    const data: Flat[] = [
      { id: 'c2', parent: 'c' },
      { id: 'c', parent: 'r' },
      { id: 'r', parent: null },
      { id: 's', parent: null },
      { id: 's1', parent: 's' },
    ];
    const tree = buildRowTree(data, { getParentId: (row) => row.parent }, (row) => row.id);
    expect(tree.rows).toBe(data);
    expect(tree.ids).toEqual(['c2', 'c', 'r', 's', 's1']);
    expect([...tree.parent]).toEqual([1, 2, -1, -1, 3]);
    expect([...tree.depth]).toEqual([2, 1, 0, 0, 1]);
    expect([...tree.childCount]).toEqual([0, 1, 1, 1, 0]);
  });

  it('flat rows without getRowId use indexes as ids', () => {
    const data = [{ parent: undefined }, { parent: '0' }, { parent: '1' }];
    const tree = buildRowTree(data, { getParentId: (row) => row.parent }, undefined);
    expect(tree.ids).toEqual(['0', '1', '2']);
    expect([...tree.parent]).toEqual([-1, 0, 1]);
    expect([...tree.depth]).toEqual([0, 1, 2]);
  });

  it('a missing parent or a cycle makes the row top-level, with one warning', () => {
    const data: Flat[] = [
      { id: 'x', parent: 'nope' },
      { id: 'p', parent: 'q' },
      { id: 'q', parent: 'p' },
      // Leads into the cycle, so keeps its parent.
      { id: 'r', parent: 'p' },
      { id: 'self', parent: 'self' },
    ];
    const warn = vi.fn();
    const tree = buildRowTree(data, { getParentId: (row) => row.parent }, (row) => row.id, warn);
    expect([...tree.parent]).toEqual([-1, -1, -1, 1, -1]);
    expect([...tree.depth]).toEqual([0, 0, 0, 1, 0]);
    expect([...tree.childCount]).toEqual([0, 1, 0, 0, 0]);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toMatch(/^argus-table:/);
    expect(message).toContain('"x"');
    expect(message).toContain('"p"');
    expect(message).toContain('"q"');
    expect(message).toContain('"self"');
  });

  it('warns about nothing for a well-formed tree', () => {
    const warn = vi.fn();
    buildRowTree(nested(), { getSubRows }, undefined, warn);
    buildRowTree(
      [{ id: 'a', parent: null }],
      { getParentId: (row: Flat) => row.parent },
      (row) => row.id,
      warn,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('getSubRows wins over getParentId, with one warning', () => {
    const warn = vi.fn();
    const getParentId = vi.fn(() => '0');
    const tree = buildRowTree(nested(), { getSubRows, getParentId }, undefined, warn);
    expect(names(tree.rows)).toEqual(['a', 'b', 'a0', 'a00', 'a1']);
    expect(getParentId).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/^argus-table:.*getSubRows/);
  });

  it('empty or missing sub-rows are leaves', () => {
    const tree = buildRowTree([{ name: 'a', kids: [] }, { name: 'b' }], { getSubRows }, undefined);
    expect(names(tree.rows)).toEqual(['a', 'b']);
    expect([...tree.childCount]).toEqual([0, 0]);
  });

  it('indexOf finds ids', () => {
    const tree = buildRowTree(nested(), { getSubRows }, undefined);
    expect(tree.indexOf('0.0.0')).toBe(3);
    expect(tree.indexOf('1')).toBe(1);
    expect(tree.indexOf('nope')).toBeUndefined();

    const flat = buildRowTree(
      [
        { id: 'b', parent: 'a' },
        { id: 'a', parent: null },
      ],
      { getParentId: (row: Flat) => row.parent },
      (row) => row.id,
    );
    expect(flat.indexOf('a')).toBe(1);
    expect(flat.indexOf('c')).toBeUndefined();
  });

  it('nested rows that lead back to an ancestor end there, with one warning', () => {
    const a: Nested = { name: 'a' };
    const b: Nested = { name: 'b', kids: [a] };
    a.kids = [b];
    const warn = vi.fn();
    const tree = buildRowTree([a], { getSubRows }, undefined, warn);
    expect(names(tree.rows)).toEqual(['a', 'b', 'a']);
    expect([...tree.parent]).toEqual([-1, 0, 1]);
    expect([...tree.childCount]).toEqual([1, 1, 0]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/^argus-table:.*"0\.0\.0"/);
  });

  it('the same row under two branches is not a cycle', () => {
    const shared: Nested = { name: 's', kids: [{ name: 's0' }] };
    const warn = vi.fn();
    const tree = buildRowTree(
      [
        { name: 'a', kids: [shared] },
        { name: 'b', kids: [shared] },
      ],
      { getSubRows },
      undefined,
      warn,
    );
    expect(names(tree.rows)).toEqual(['a', 'b', 's', 's0', 's', 's0']);
    expect([...tree.childCount]).toEqual([1, 1, 1, 0, 1, 0]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('flat parent ids are compared as strings', () => {
    // Plain JavaScript can return a number where the types say string.
    const data = [
      { id: '1', parent: null },
      { id: '2', parent: 1 },
    ];
    const warn = vi.fn();
    const tree = buildRowTree(
      data,
      { getParentId: (row) => row.parent as unknown as string | null },
      (row) => row.id,
      warn,
    );
    expect([...tree.parent]).toEqual([-1, 0]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('deep trees are not limited', () => {
    const length = 200_000;
    const root: Nested = { name: '0' };
    let node = root;
    for (let i = 1; i < length; i++) {
      const child: Nested = { name: String(i) };
      node.kids = [child];
      node = child;
    }
    const tree = buildRowTree([root], { getSubRows }, (row) => row.name);
    expect(tree.rows).toHaveLength(length);
    expect(tree.depth[length - 1]).toBe(length - 1);
    expect(tree.parent[length - 1]).toBe(length - 2);

    // The same chain as flat data, children first.
    const flat: Flat[] = Array.from({ length }, (_, i) => ({
      id: String(length - 1 - i),
      parent: i === length - 1 ? null : String(length - 2 - i),
    }));
    const flatTree = buildRowTree(flat, { getParentId: (row) => row.parent }, (row) => row.id);
    expect(flatTree.depth[0]).toBe(length - 1);
    expect(flatTree.depth[length - 1]).toBe(0);
  });
});
