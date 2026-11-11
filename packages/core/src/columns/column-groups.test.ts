import { describe, expect, it } from 'vitest';
import {
  cellOver,
  groupDepth,
  headerGroupRows,
  resolveColumnGroups,
  type GroupedColumn,
} from './column-groups.js';

const ids = new Set(['a', 'b', 'c', 'd', 'e']);

describe('resolveColumnGroups', () => {
  it('gives each column the path of groups around it', () => {
    const tree = resolveColumnGroups(
      [{ id: 'G', header: 'Group', columns: ['a', { id: 'H', columns: ['b', 'c'] }] }],
      ids,
    );
    expect(tree.pathOf('a')).toEqual(['G']);
    expect(tree.pathOf('c')).toEqual(['G', 'H']);
    expect(tree.pathOf('d')).toEqual([]);
    expect(tree.groups.get('H')).toMatchObject({ parent: 'G', depth: 1, ordinal: 1 });
    expect(tree.groups.get('G')).toMatchObject({ header: 'Group', depth: 0, ordinal: 0 });
  });

  it('ignores unknown ids, gives a column listed twice to the first group, drops empty groups', () => {
    const tree = resolveColumnGroups(
      [
        { id: 'G', columns: ['a', 'zz', { id: 'E', columns: ['zz'] }] },
        { id: 'H', columns: ['a', 'b'] },
        { id: 'K', columns: ['a'] },
      ],
      ids,
    );
    expect(tree.pathOf('a')).toEqual(['G']);
    expect(tree.pathOf('b')).toEqual(['H']);
    expect([...tree.groups.keys()]).toEqual(['G', 'H']);
  });

  it('throws on a group without an id or with an id used twice', () => {
    expect(() => resolveColumnGroups([{ id: '', columns: ['a'] }], ids)).toThrow(/non-empty/);
    expect(() =>
      resolveColumnGroups(
        [
          { id: 'G', columns: ['a'] },
          { id: 'X', columns: [{ id: 'G', columns: ['b'] }] },
        ],
        ids,
      ),
    ).toThrow(/'G' is used more than once/);
  });

  it('may share an id with a column', () => {
    expect(resolveColumnGroups([{ id: 'a', columns: ['a'] }], ids).pathOf('a')).toEqual(['a']);
  });
});

describe('headerGroupRows', () => {
  let offset = 0;
  const view = (id: string, colIndex: number, pin?: 'start' | 'end'): GroupedColumn => {
    const v = {
      id,
      kind: 'data' as const,
      colIndex,
      pin,
      offset,
      pinEdge: false,
      reorderable: true,
      resizable: true,
    };
    offset += 100;
    return v;
  };
  const tree = resolveColumnGroups(
    [{ id: 'G', header: 'G!', columns: ['a', 'b', { id: 'H', columns: ['c', 'd'] }] }],
    ids,
  );

  it('is empty without groups among the shown columns', () => {
    expect(headerGroupRows(tree, [view('e', 1)])).toEqual([]);
    expect(groupDepth(tree, [view('e', 1)])).toBe(0);
  });

  it('spans groups over their columns and fills the rest', () => {
    const views = [view('a', 1), view('b', 2), view('c', 3), view('d', 4), view('e', 5)];
    const rows = headerGroupRows(tree, views);
    expect(
      rows.map((r) => r.map((c) => [c.kind, c.groupId, c.columns, c.colIndex, c.span])),
    ).toEqual([
      [
        ['group', 'G', ['a', 'b', 'c', 'd'], 1, 4],
        ['filler', undefined, ['e'], 5, 1],
      ],
      [
        ['filler', undefined, ['a', 'b'], 1, 2],
        ['group', 'H', ['c', 'd'], 3, 2],
        ['filler', undefined, ['e'], 5, 1],
      ],
    ]);
    expect(rows[0]?.[0]).toMatchObject({ header: 'G!', level: 0, movable: true, slot: 1 });
    expect(rows[1]?.[1]).toMatchObject({ level: 1, slot: 4 });
    expect(cellOver(rows, 1, 'd')?.groupId).toBe('H');
  });

  it('splits a group by pin side, with sticky offsets from its edge', () => {
    const start = { ...view('a', 1, 'start'), offset: 0 };
    const b = { ...view('b', 2), offset: 0 };
    const c = { ...view('c', 3, 'end'), offset: 120, pinEdge: true };
    const d = { ...view('d', 4, 'end'), offset: 0 };
    const [top] = headerGroupRows(tree, [start, b, c, d]);
    expect(top?.map((cell) => [cell.key, cell.pin, cell.offset, cell.pinEdge, cell.slot])).toEqual([
      ['g:start:G', 'start', 0, false, 0],
      ['g:center:G', undefined, 0, false, 1],
      ['g:end:G', 'end', 0, true, 2],
    ]);
  });

  it('only moves a group whose shown columns can all move', () => {
    const fixed = { ...view('b', 2), reorderable: false };
    const [top] = headerGroupRows(tree, [view('a', 1), fixed]);
    expect(top?.[0]?.movable).toBe(false);
    const fixedGroup = resolveColumnGroups(
      [{ id: 'G', reorderable: false, columns: ['a', 'b'] }],
      ids,
    );
    expect(headerGroupRows(fixedGroup, [view('a', 1), view('b', 2)])[0]?.[0]?.movable).toBe(false);
    expect(fixedGroup.groups.get('G')?.reorderable).toBe(false);
  });

  it('leaves out hidden columns, which can lower the depth', () => {
    // Only a and b of G are shown: no row for H.
    expect(headerGroupRows(tree, [view('a', 1), view('b', 2)])).toHaveLength(1);
  });
});
