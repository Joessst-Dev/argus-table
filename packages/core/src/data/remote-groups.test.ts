import { describe, expect, it } from 'vitest';
import type { GroupData } from '../types.js';
import { RemoteGroups, type GroupLevel } from './remote-groups.js';

interface Sale {
  id: string;
}

const EU = '\u0000g["region","EU"]';
const US = '\u0000g["region","US"]';
const EU_OPEN = '\u0000g["region","EU","status","Open"]';

const setup = (grouping = ['region', 'status'], pageSize = 2) =>
  new RemoteGroups<Sale>({ grouping, pageSize });

/** The level with a key (`''` for the top level). */
function levelOf(groups: RemoteGroups<Sale>, key: string): GroupLevel {
  const level = groups.levels().find((l) => l.key === key);
  if (!level) throw new Error(`no level ${key}`);
  return level;
}

/** Requests and answers a page of a level. */
function answer(
  groups: RemoteGroups<Sale>,
  key: string,
  page: number,
  response: { rows?: unknown; groups?: GroupData[]; total?: number },
) {
  const level = levelOf(groups, key);
  groups.cacheOf(level)?.begin(page);
  return groups.resolve(level, page, response);
}

const top = (g: RemoteGroups<Sale>) =>
  answer(g, '', 0, {
    rows: [],
    groups: [
      { value: 'EU', count: 3, totals: { amount: 30 } },
      { value: 'US', count: 2 },
    ],
    total: 2,
  });

/** Each shown row: a group's value in brackets, a data row's id, or its state. */
const shown = (g: RemoteGroups<Sale>) =>
  Array.from({ length: g.rowCount }, (_, i) => {
    const group = g.groupAt(i);
    if (group) return `[${String(group.value)}]`;
    return g.entryAt(i)?.row.id ?? g.stateAt(i);
  });

describe('RemoteGroups', () => {
  it('starts with one loading row for the top-level groups', () => {
    const g = setup();
    expect(g.rowCount).toBe(1);
    expect(g.stateAt(0)).toBe('loading');
    expect(g.ranges(0, 1)).toEqual([{ level: levelOf(g, ''), start: 0, end: 1 }]);
    expect(levelOf(g, '')).toMatchObject({ path: [], groups: true });
  });

  it('shows the top-level groups as group rows', () => {
    const g = setup();
    expect(top(g)).toBe('stored');
    expect(shown(g)).toEqual(['[EU]', '[US]']);
    expect(g.groupAt(0)).toEqual({
      id: EU,
      groupColumnId: 'region',
      value: 'EU',
      count: 3,
      depth: 0,
      totals: { amount: 30 },
    });
    // Group rows have no row object, but ids and places in the tree.
    expect(g.entryAt(0)).toBeUndefined();
    expect(g.idAt(1)).toBe(US);
    expect(g.treeRow(0)).toEqual({
      depth: 0,
      hasChildren: true,
      open: false,
      forced: false,
      parent: undefined,
      setSize: 2,
      posInSet: 1,
    });
  });

  it('an open group of groups shows one loading row until its first page', () => {
    const g = setup();
    top(g);
    g.setExpanded([EU]);
    expect(shown(g)).toEqual(['[EU]', 'loading', '[US]']);
    expect(levelOf(g, EU)).toMatchObject({
      path: [{ columnId: 'region', value: 'EU' }],
      groups: true,
    });
    expect(
      answer(g, EU, 0, {
        rows: [],
        groups: [
          { value: 'Open', count: 2 },
          { value: 'Done', count: 1 },
        ],
        total: 2,
      }),
    ).toBe('stored');
    expect(shown(g)).toEqual(['[EU]', '[Open]', '[Done]', '[US]']);
    expect(g.ranges(0, 4).map((r) => [r.level.key, r.start, r.end])).toEqual([
      ['', 0, 2],
      [EU, 0, 2],
    ]);
    expect(g.parentAt(1)).toBe(0);
    expect(g.depthAt(1)).toBe(1);
    expect(g.treeRow(1)).toMatchObject({ depth: 1, parent: 0, setSize: 2, posInSet: 1 });
  });

  it('an open group of rows shows its count as loading rows, then its rows', () => {
    const g = setup();
    top(g);
    g.setExpanded([EU, EU_OPEN]);
    answer(g, EU, 0, {
      rows: [],
      groups: [
        { value: 'Open', count: 2 },
        { value: 'Done', count: 1 },
      ],
      total: 2,
    });
    expect(shown(g)).toEqual(['[EU]', '[Open]', 'loading', 'loading', '[Done]', '[US]']);
    expect(levelOf(g, EU_OPEN)).toMatchObject({
      path: [
        { columnId: 'region', value: 'EU' },
        { columnId: 'status', value: 'Open' },
      ],
      groups: false,
    });
    expect(answer(g, EU_OPEN, 0, { rows: [{ id: 'r1' }, { id: 'r2' }] })).toBe('stored');
    expect(shown(g)).toEqual(['[EU]', '[Open]', 'r1', 'r2', '[Done]', '[US]']);
    expect(g.idAt(2)).toBe(`${EU_OPEN}.0`);
    expect(g.indexOf(`${EU_OPEN}.1`)).toBe(3);
    expect(g.depthAt(2)).toBe(2);
    expect(g.treeRow(2)).toMatchObject({ hasChildren: false, parent: 1 });
    expect(g.loadedIds()).toEqual([`${EU_OPEN}.0`, `${EU_OPEN}.1`]);
  });

  it('names data rows with getRowId, given their index in the group', () => {
    const g = new RemoteGroups<Sale>({
      grouping: ['region'],
      pageSize: 2,
      getRowId: (row, i) => `${row.id}@${String(i)}`,
      expanded: [EU],
    });
    top(g);
    answer(g, EU, 0, { rows: [{ id: 'a' }, { id: 'b' }] });
    expect(g.idAt(1)).toBe('a@0');
  });

  it('an answer of the wrong kind stores nothing', () => {
    const g = setup();
    expect(answer(g, '', 0, { rows: [{ id: 'x' }] })).toBe('wrong');
    expect(g.rowCount).toBe(1);
    const flat = setup(['region']);
    top(flat);
    flat.setExpanded([EU]);
    expect(answer(flat, EU, 0, { rows: [], groups: [{ value: 'x', count: 1 }] })).toBe('wrong');
  });

  it('a short page shrinks a group to the rows that came back', () => {
    const g = setup(['region']);
    top(g);
    g.setExpanded([EU]);
    expect(g.rowCount).toBe(5);
    answer(g, EU, 0, { rows: [{ id: 'r1' }] });
    expect(shown(g)).toEqual(['[EU]', 'r1', '[US]']);
  });

  it('closing a group drops its level; opening it again loads it again', () => {
    const g = setup(['region']);
    top(g);
    g.setExpanded([EU]);
    answer(g, EU, 0, { rows: [{ id: 'a' }, { id: 'b' }] });
    g.setExpanded([]);
    expect(g.rowCount).toBe(2);
    expect(g.levels().map((l) => l.key)).toEqual(['']);
    g.setExpanded([EU]);
    const level = levelOf(g, EU);
    expect(g.cacheOf(level)?.missingPages(0, 3)).toEqual([0, 1]);
  });

  it('an answer for a closed level is stale', () => {
    const g = setup(['region']);
    top(g);
    g.setExpanded([EU]);
    const level = levelOf(g, EU);
    g.cacheOf(level)?.begin(0);
    g.setExpanded([]);
    expect(g.resolve(level, 0, { rows: [{ id: 'a' }] })).toBe('stale');
  });

  it('evicts far pages in every level; an open group keeps its place when its row is evicted', () => {
    const g = new RemoteGroups<Sale>({ grouping: ['region'], pageSize: 1, expanded: [EU] });
    // 40 top-level groups, EU first with 30 rows.
    const level = levelOf(g, '');
    g.cacheOf(level)?.begin(0);
    g.resolve(level, 0, { rows: [], groups: [{ value: 'EU', count: 30 }], total: 40 });
    for (let i = 0; i < 30; i++) answer(g, EU, i, { rows: [{ id: `r${String(i)}` }] });
    expect(g.rowCount).toBe(70);
    // Far below EU: its pages and the first top-level page go.
    g.evict(60, 70);
    const eu = levelOf(g, EU);
    expect(g.cacheOf(eu)?.missingPages(0, 30).length).toBeGreaterThanOrEqual(19);
    expect(g.stateAt(0)).toBe('loading');
    // EU stays open where it was: its rows still follow its row.
    expect(g.rowCount).toBe(70);
    expect(g.depthAt(1)).toBe(1);
    expect(g.parentAt(1)).toBe(0);
  });

  it('pageSpan and retry: a failed page of a level, by shown index', () => {
    const g = setup(['region']);
    top(g);
    g.setExpanded([EU]);
    const level = levelOf(g, EU);
    g.cacheOf(level)?.begin(1);
    g.cacheOf(level)?.fail(1);
    expect(g.stateAt(3)).toBe('error');
    expect(g.pageSpan(3)).toEqual({ key: `${EU}\u00011`, start: 3, end: 4 });
    expect(g.retry(3)).toBe(true);
    expect(g.cacheOf(level)?.missingPages(0, 3)).toEqual([0, 1]);
    expect(g.retry(3)).toBe(false);
  });

  it('stand-in ids hold a row not loaded while rows above load', () => {
    const g = setup();
    top(g);
    g.setExpanded([EU]);
    // US's row, below EU's loading row.
    const id = g.idAt(2);
    expect(id).toBe(US);
    const loading = g.standInId(1);
    expect(g.standIn(loading)).toEqual({ index: 1, same: true, moves: true });
    answer(g, EU, 0, {
      rows: [],
      groups: [
        { value: 'Open', count: 2 },
        { value: 'Done', count: 1 },
      ],
      total: 2,
    });
    expect(g.indexOf(US)).toBe(3);
    expect(g.standIn(loading)).toEqual({ index: 1, same: true, moves: true });
    // A closed level's stand-in gives its group row.
    g.setExpanded([]);
    expect(g.standIn(loading)).toEqual({ index: 0, same: false, moves: true });
    expect(g.standIn('other')).toBeUndefined();
  });

  it('shownAncestor finds a closed group’s rows’ nearest shown group', () => {
    const g = setup();
    top(g);
    expect(g.shownAncestor(EU_OPEN)).toBe(0);
    expect(g.shownAncestor(US)).toBe(1);
  });

  it('the forest: loaded rows, every group with a hidden child', () => {
    const g = setup(['region']);
    top(g);
    g.setExpanded([EU]);
    answer(g, EU, 0, { rows: [{ id: 'a' }, { id: 'b' }] });
    const { tree, layout } = g.forest();
    expect(tree.ids.slice(0, 4)).toEqual([EU, `${EU}.0`, `${EU}.1`, US]);
    expect(tree.childCount[0]).toBe(3);
    expect(tree.childCount[3]).toBe(1);
    expect(layout.order.length).toBe(4);
    expect(g.forestRow(2)).toBe(2);
  });

  it('mayToggle: any group id may open; anything may close', () => {
    const g = setup();
    expect(g.mayToggle(EU, true)).toBe(true);
    expect(g.mayToggle('row', true)).toBe(false);
    expect(g.mayToggle('row', false)).toBe(true);
  });

  it('groups the server sent twice (null and empty text) open once', () => {
    const g = setup(['region']);
    const NONE = '\u0000g["region",null]';
    g.setExpanded([NONE]);
    answer(g, '', 0, {
      rows: [],
      groups: [
        { value: null, count: 2 },
        { value: '', count: 3 },
      ],
      total: 2,
    });
    // One level (under the last of them, where the id points), counted once.
    expect(g.levels().filter((l) => l.key === NONE)).toHaveLength(1);
    expect(g.rowCount).toBe(2 + 3);
  });

  it('an open group whose row loads elsewhere moves with it; another group in its place doesn’t take its rows', () => {
    const g = new RemoteGroups<Sale>({ grouping: ['region'], pageSize: 1, expanded: [EU] });
    const root = levelOf(g, '');
    g.cacheOf(root)?.begin(0);
    g.resolve(root, 0, { rows: [], groups: [{ value: 'EU', count: 1 }], total: 2 });
    answer(g, EU, 0, { rows: [{ id: 'a' }] });
    expect(shown(g)).toEqual(['[EU]', 'a', 'loading']);
    // The page reloads with a new group in front: EU is now second.
    g.evict(10_000, 10_001);
    g.cacheOf(root)?.begin(0);
    g.resolve(root, 0, { rows: [], groups: [{ value: 'AA', count: 1 }], total: 2 });
    expect(shown(g)).toEqual(['[AA]', 'loading']);
    g.cacheOf(root)?.begin(1);
    g.resolve(root, 1, { rows: [], groups: [{ value: 'EU', count: 1 }], total: 2 });
    expect(shown(g)).toEqual(['[AA]', '[EU]', 'a']);
  });

  it('a row of a group just closed finds its group row (an active cell moves there)', () => {
    const g = setup(['region']);
    top(g);
    g.setExpanded([EU]);
    answer(g, EU, 0, { rows: [{ id: 'a' }, { id: 'b' }] });
    g.setExpanded([]);
    expect(g.shownAncestor(`${EU}.1`)).toBe(0);
  });

  it('empty groups at the deepest level are fine; groups without a count are wrong', () => {
    const g = setup(['region']);
    top(g);
    g.setExpanded([EU]);
    expect(answer(g, EU, 0, { rows: [{ id: 'a' }], groups: [] })).toBe('stored');
    const h = setup(['region']);
    expect(answer(h, '', 0, { rows: [], groups: [null as unknown as GroupData] })).toBe('wrong');
  });
});
