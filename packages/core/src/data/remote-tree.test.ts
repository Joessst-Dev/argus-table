import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageCache } from './page-cache.js';
import { RemoteTree, type KeptCount } from './remote-tree.js';

interface Row {
  id: string;
  kids: number;
}

const hasChildren = (row: Row) => row.kids > 0;

/** Top-level rows: every one has children. */
const rows = (start: number, count: number, kids = 2): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: `r${String(start + i)}`, kids }));

/** Child rows of a parent, without children of their own unless `kids` says so. */
const children = (parent: string, count: number, kids = 0): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${parent}/${String(i)}`, kids }));

/** Requests a page and resolves it with `count` rows. */
function load(cache: PageCache<Row>, page: number, count: number, total?: number) {
  const { start } = cache.begin(page);
  return cache.resolve(page, rows(start, count), total);
}

/** A tree over a cache with page size 4 and its first page loaded (total unknown: 8 rows). */
function setup(options: { keepCounts?: ReadonlyMap<string, KeptCount> } = {}) {
  const cache = new PageCache<Row>({ pageSize: 4 });
  load(cache, 0, 4);
  const tree = new RemoteTree(cache, { hasChildren, ...options });
  return { cache, tree };
}

/** Requests and answers a parent's children. */
function answer(tree: RemoteTree<Row>, parentId: string, list: readonly Row[]) {
  tree.beginChildren(parentId);
  return tree.resolveChildren(parentId, list);
}

const ids = (tree: RemoteTree<Row>) =>
  Array.from({ length: tree.rowCount }, (_, i) => tree.entryAt(i)?.id ?? tree.stateAt(i));

describe('RemoteTree', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('without open rows it is the page cache', () => {
    const { cache, tree } = setup();
    expect(tree.rowCount).toBe(cache.rowCount);
    expect(tree.entryAt(2)).toBe(cache.entryAt(2));
    expect(tree.entryAt(5)).toBeUndefined();
    expect(tree.indexOf('3')).toBe(3);
    expect(tree.loadedIds()).toEqual(cache.loadedIds());
    expect(tree.stateAt(1)).toBe('loaded');
    expect(tree.stateAt(6)).toBe('loading');
    expect(tree.topIndexOf(3)).toBe(3);
    expect(tree.parentIdAt(3)).toBeUndefined();
    expect(tree.wanted).toEqual([]);

    const order = tree.order;
    const version = tree.version;
    load(cache, 1, 4);
    expect(tree.rowCount).toBe(12);
    expect(tree.entryAt(5)?.id).toBe('5');
    expect(tree.order).toBe(order);
    expect(tree.version).not.toBe(version);
  });

  it('gives top-level rows their place in the tree', () => {
    const { cache, tree } = setup();
    expect(tree.treeRow(2)).toEqual({
      depth: 0,
      hasChildren: true,
      open: false,
      forced: false,
      parent: undefined,
      setSize: -1,
      posInSet: 3,
    });
    expect(tree.treeRow(6)).toBeUndefined();
    load(cache, 1, 4, 8);
    expect(tree.treeRow(2)?.setSize).toBe(8);
  });

  it('an open parent shows a loading row until its children arrive', () => {
    const { cache, tree } = setup();
    tree.setExpanded(['1']);
    expect(tree.wanted).toEqual(['1']);
    expect(tree.childRow('1')).toBe(cache.entryAt(1)?.row);
    // The loading row shows right away, before the request starts.
    expect(tree.rowCount).toBe(cache.rowCount + 1);
    expect(tree.stateAt(2)).toBe('loading');

    const before = tree.order;
    tree.beginChildren('1');
    expect(tree.order).toBe(before);
    expect(tree.rowCount).toBe(cache.rowCount + 1);
    expect(tree.stateAt(2)).toBe('loading');
    expect(tree.entryAt(2)).toBeUndefined();
    expect(tree.treeRow(2)).toBeUndefined();
    expect(tree.parentIdAt(2)).toBe('1');
    expect(tree.topIndexOf(2)).toBeUndefined();
    expect(tree.topIndexOf(3)).toBe(2);
    expect(tree.wanted).toEqual([]);
    expect(tree.treeRow(1)?.open).toBe(true);

    const order = tree.order;
    expect(tree.resolveChildren('1', children('1', 2))).toBe(true);
    expect(tree.rowCount).toBe(cache.rowCount + 2);
    expect(tree.entryAt(2)?.id).toBe('1.0');
    expect(tree.entryAt(3)?.id).toBe('1.1');
    expect(tree.entryAt(3)?.row.id).toBe('1/1');
    expect(tree.entryAt(4)?.id).toBe('2');
    expect(tree.stateAt(3)).toBe('loaded');
    expect(tree.indexOf('1.1')).toBe(3);
    expect(tree.indexOf('2')).toBe(4);
    expect(tree.parentIdAt(3)).toBe('1');
    expect(tree.treeRow(2)).toEqual({
      depth: 1,
      hasChildren: false,
      open: false,
      forced: false,
      parent: 1,
      setSize: 2,
      posInSet: 1,
    });
    expect(tree.treeRow(3)?.posInSet).toBe(2);
    expect(tree.loadedIds()).toEqual(['0', '1', '1.0', '1.1', '2', '3']);
    expect(tree.order).not.toBe(order);
    expect(tree.resolveChildren('1', children('1', 2))).toBe(false);
  });

  it('children of children', () => {
    const { tree } = setup();
    tree.setExpanded(['1', '1.0']);
    answer(tree, '1', children('1', 2, 1));
    expect(tree.wanted).toEqual(['1.0']);
    expect(tree.childRow('1.0')?.id).toBe('1/0');
    answer(tree, '1.0', children('1/0', 2));
    expect(ids(tree).slice(0, 7)).toEqual(['0', '1', '1.0', '1.0.0', '1.0.1', '1.1', '2']);
    expect(tree.treeRow(3)).toMatchObject({ depth: 2, parent: 2, setSize: 2, posInSet: 1 });
    expect(tree.treeRow(5)).toMatchObject({ depth: 1, parent: 1, hasChildren: true, open: false });
    expect(tree.treeRow(2)?.open).toBe(true);
    expect(tree.indexOf('1.0.1')).toBe(4);
    expect(tree.parentIdAt(4)).toBe('1.0');
    expect(tree.topRange(3, 5)).toEqual({ start: 1, end: 2 });
  });

  it('collapsing hides children and keeps them', () => {
    const { cache, tree } = setup();
    tree.setExpanded(['1']);
    answer(tree, '1', children('1', 2));
    const open = tree.order;
    tree.setExpanded([]);
    expect(tree.rowCount).toBe(cache.rowCount);
    expect(tree.indexOf('1.0')).toBeUndefined();
    expect(tree.order).not.toBe(open);
    expect(tree.treeRow(1)).toMatchObject({ hasChildren: true, open: false });

    tree.setExpanded(['1']);
    expect(tree.wanted).toEqual([]);
    expect(tree.entryAt(2)?.id).toBe('1.0');
  });

  it('keeps the order for the same expanded ids', () => {
    const { tree } = setup();
    tree.setExpanded(['1']);
    answer(tree, '1', children('1', 2));
    const order = tree.order;
    const version = tree.version;
    tree.setExpanded(['1']);
    expect(tree.order).toBe(order);
    expect(tree.version).toBe(version);
  });

  it('a failed child request shows one error row', () => {
    const { cache, tree } = setup({ keepCounts: new Map([['1', { count: 3 }]]) });
    tree.setExpanded(['1']);
    tree.beginChildren('1');
    expect(tree.rowCount).toBe(cache.rowCount + 3);
    tree.failChildren('1');
    expect(tree.rowCount).toBe(cache.rowCount + 1);
    expect(tree.stateAt(2)).toBe('error');
    expect(tree.parentIdAt(2)).toBe('1');
    expect(tree.wanted).toEqual([]);
    expect(tree.resolveChildren('1', children('1', 2))).toBe(false);

    // The kept count went with the failed request: one loading row on Retry.
    expect(tree.forget('1', 'error')).toBe(true);
    expect(tree.wanted).toEqual(['1']);
    expect(tree.stateAt(2)).toBe('loading');
    expect(tree.rowCount).toBe(cache.rowCount + 1);
    answer(tree, '1', children('1', 2));
    expect(tree.entryAt(3)?.id).toBe('1.1');
  });

  it('collapsing a failed parent lets it load again on the next expand', () => {
    const { cache, tree } = setup();
    tree.setExpanded(['1']);
    tree.beginChildren('1');
    tree.failChildren('1');
    tree.setExpanded([]);
    expect(tree.rowCount).toBe(cache.rowCount);
    tree.setExpanded(['1']);
    expect(tree.wanted).toEqual(['1']);
    expect(tree.stateAt(2)).toBe('loading');
  });

  it('gives every shown row a depth', () => {
    const { tree } = setup();
    tree.setExpanded(['1', '1.0']);
    answer(tree, '1', children('1', 2, 1));
    tree.beginChildren('1.0');
    // 0, 1, 1.0, (loading under 1.0), 1.1, 2, 3, then rows not loaded.
    expect(Array.from({ length: 9 }, (_, i) => tree.depthAt(i))).toEqual([
      0, 0, 1, 2, 1, 0, 0, 0, 0,
    ]);
    tree.failChildren('1.0');
    expect(tree.depthAt(3)).toBe(2);
    expect(tree.depthAt(-1)).toBeUndefined();
    expect(tree.depthAt(tree.rowCount)).toBeUndefined();
  });

  it('reports a child id already used through warn, each time (the caller warns once)', () => {
    const console_ = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const warn = vi.fn();
    const cache = new PageCache<Row>({ pageSize: 4, getRowId: (row) => row.id });
    load(cache, 0, 4);
    const tree = new RemoteTree(cache, { hasChildren, getRowId: (row) => row.id, warn });
    tree.setExpanded(['r0', 'r1']);
    answer(tree, 'r0', [{ id: 'r2', kids: 0 }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/^argus-table: row id "r2"/);
    answer(tree, 'r1', [{ id: 'r3', kids: 0 }]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(console_).not.toHaveBeenCalled();
  });

  it('without warn, reports nothing', () => {
    const console_ = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cache = new PageCache<Row>({ pageSize: 4, getRowId: (row) => row.id });
    load(cache, 0, 4);
    const tree = new RemoteTree(cache, { hasChildren, getRowId: (row) => row.id });
    tree.setExpanded(['r0']);
    answer(tree, 'r0', [{ id: 'r2', kids: 0 }]);
    expect(console_).not.toHaveBeenCalled();
  });

  it('warns when another parent’s child has the id', () => {
    const warn = vi.fn();
    const { tree } = setup();
    const getRowId = (row: Row) => row.id;
    const named = new RemoteTree(tree.cache, { hasChildren, getRowId, warn });
    named.setExpanded(['0', '1']);
    answer(named, '0', [{ id: 'same', kids: 0 }]);
    expect(warn).not.toHaveBeenCalled();
    answer(named, '1', [{ id: 'same', kids: 0 }]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('a cancelled child request is wanted again', () => {
    const { tree } = setup();
    tree.setExpanded(['1']);
    tree.beginChildren('1');
    expect(tree.forget('1', 'loading')).toBe(true);
    expect(tree.wanted).toEqual(['1']);
    expect(tree.resolveChildren('1', children('1', 2))).toBe(false);
  });

  it('collapsing while children load keeps the request', () => {
    const { tree } = setup();
    tree.setExpanded(['1']);
    tree.beginChildren('1');
    tree.setExpanded([]);
    expect(tree.resolveChildren('1', children('1', 2))).toBe(true);
    tree.setExpanded(['1']);
    expect(tree.wanted).toEqual([]);
    expect(tree.entryAt(2)?.id).toBe('1.0');
  });

  it('empty children close the row', () => {
    const { cache, tree } = setup();
    expect(tree.canExpand('1')).toBe(true);
    tree.setExpanded(['1']);
    answer(tree, '1', []);
    expect(tree.rowCount).toBe(cache.rowCount);
    expect(tree.canExpand('1')).toBe(false);
    expect(tree.treeRow(1)).toMatchObject({ hasChildren: false, open: false });
    expect(tree.wanted).toEqual([]);
  });

  it('only loaded rows with children can expand', () => {
    const cache = new PageCache<Row>({ pageSize: 4 });
    const { start } = cache.begin(0);
    cache.resolve(0, [...rows(start, 3), { id: 'leaf', kids: 0 }]);
    const tree = new RemoteTree(cache, { hasChildren });
    expect(tree.canExpand('3')).toBe(false);
    expect(tree.canExpand('6')).toBe(false);
    expect(tree.canExpand('nope')).toBe(false);
    tree.setExpanded(['3']);
    expect(tree.wanted).toEqual([]);
    expect(tree.rowCount).toBe(cache.rowCount);
    expect(tree.treeRow(3)).toMatchObject({ hasChildren: false, open: false });

    tree.setExpanded(['0']);
    answer(tree, '0', children('0', 2, 1));
    expect(tree.canExpand('0.0')).toBe(true);
    expect(tree.canExpand('0.1')).toBe(true);
    tree.setExpanded([]);
    // Loaded under a collapsed row: still known.
    expect(tree.canExpand('0.0')).toBe(true);
  });

  it('an open id whose row isn’t loaded yet waits', () => {
    const { cache, tree } = setup();
    tree.setExpanded(['5']);
    expect(tree.wanted).toEqual([]);
    expect(tree.rowCount).toBe(cache.rowCount);
    const order = tree.order;
    load(cache, 1, 4);
    expect(tree.wanted).toEqual(['5']);
    expect(tree.rowCount).toBe(cache.rowCount + 1);
    expect(tree.stateAt(6)).toBe('loading');
    expect(tree.order).not.toBe(order);
  });

  it('positionOfTop finds a top-level row’s shown index, loaded or not', () => {
    const { cache, tree } = setup();
    tree.setExpanded(['1']);
    expect(tree.positionOfTop(0)).toBe(0);
    expect(tree.positionOfTop(1)).toBe(1);
    // One loading row under row 1.
    expect(tree.positionOfTop(2)).toBe(3);
    expect(tree.positionOfTop(6)).toBe(7);
    answer(tree, '1', children('1', 3));
    expect(tree.positionOfTop(2)).toBe(5);
    expect(tree.positionOfTop(6)).toBe(9);
    for (const top of [2, 6]) expect(tree.topIndexOf(tree.positionOfTop(top) ?? -1)).toBe(top);
    expect(tree.positionOfTop(cache.rowCount)).toBeUndefined();
    expect(tree.positionOfTop(-1)).toBeUndefined();
  });

  it('topRange covers the top-level rows of a shown range', () => {
    const { tree } = setup();
    tree.setExpanded(['1']);
    answer(tree, '1', children('1', 3));
    expect(tree.topRange(0, 6)).toEqual({ start: 0, end: 3 });
    expect(tree.topRange(3, 4)).toEqual({ start: 1, end: 2 });
    expect(tree.topRange(5, 7)).toEqual({ start: 2, end: 4 });
    expect(tree.topRange(0, 100)).toEqual({ start: 0, end: 8 });
    expect(tree.topRange(4, 4)).toEqual({ start: 1, end: 1 });
  });

  it('getRowId names children by their index among siblings', () => {
    const cache = new PageCache<Row>({ pageSize: 4, getRowId: (row) => row.id });
    load(cache, 0, 4);
    const calls: [string, number][] = [];
    const tree = new RemoteTree(cache, {
      hasChildren,
      getRowId: (row, index) => {
        calls.push([row.id, index]);
        return `id:${row.id}`;
      },
    });
    tree.setExpanded(['r1']);
    expect(tree.wanted).toEqual(['r1']);
    answer(tree, 'r1', children('r1', 2));
    expect(calls).toEqual([
      ['r1/0', 0],
      ['r1/1', 1],
    ]);
    expect(tree.entryAt(2)?.id).toBe('id:r1/0');
    expect(tree.indexOf('id:r1/1')).toBe(3);
  });

  it('keepCounts shows the previous child count as loading rows', () => {
    const { cache, tree } = setup();
    tree.setExpanded(['1']);
    answer(tree, '1', children('1', 3));
    expect(tree.counts(true)).toEqual(new Map([['1', { index: 1, count: 3 }]]));

    const next = new PageCache<Row>({ pageSize: 4 });
    const after = new RemoteTree(next, { hasChildren, keepCounts: tree.counts(true) });
    after.setExpanded(['1']);
    // Open at its old index before its page loads, not requested yet.
    expect(after.rowCount).toBe(next.rowCount + 3);
    expect(after.wanted).toEqual([]);
    load(next, 0, 4);
    expect(after.rowCount).toBe(cache.rowCount + 3);
    expect(after.wanted).toEqual(['1']);
    after.beginChildren('1');
    expect([2, 3, 4].map((i) => after.stateAt(i))).toEqual(['loading', 'loading', 'loading']);
    expect(after.entryAt(5)?.id).toBe('2');
    expect(after.counts(true)).toEqual(new Map([['1', { index: 1, count: 3 }]]));
    after.resolveChildren('1', children('1', 2));
    expect(after.entryAt(4)?.id).toBe('2');
    expect(after.counts(true)).toEqual(new Map([['1', { index: 1, count: 2 }]]));
  });

  it('keepCounts keeps rows in place under a parent above the view', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    for (let page = 0; page < 5; page++) load(cache, page, 10);
    const tree = new RemoteTree(cache, { hasChildren });
    tree.setExpanded(['1']);
    answer(tree, '1', children('1', 3));
    expect(tree.topRange(30, 40)).toEqual({ start: 27, end: 37 });

    // refresh(): a new cache with the row count carried over; only the rows in view load.
    const next = new PageCache<Row>({ pageSize: 10, rowCount: cache.rowCount });
    const after = new RemoteTree(next, { hasChildren, keepCounts: tree.counts(true) });
    after.setExpanded(['1']);
    expect(after.topRange(30, 40)).toEqual({ start: 27, end: 37 });
    load(next, 2, 10);
    load(next, 3, 10);
    expect(after.entryAt(30)?.id).toBe('27');
    expect(after.wanted).toEqual([]);
    load(next, 0, 10);
    expect(after.wanted).toEqual(['1']);
    expect(after.entryAt(30)?.id).toBe('27');
  });

  it('keepCounts counts every row shown under a parent, nested open rows too', () => {
    const { cache, tree } = setup();
    tree.setExpanded(['1', '1.0']);
    answer(tree, '1', children('1', 2, 1));
    answer(tree, '1.0', children('1.0', 2));
    // 0, 1, 1.0, 1.0.0, 1.0.1, 1.1, 2
    expect(tree.entryAt(6)?.id).toBe('2');
    expect(tree.counts(true)).toEqual(
      new Map<string, KeptCount>([
        ['1', { index: 1, count: 4 }],
        ['1.0', { count: 2 }],
      ]),
    );
    // Without the index (other positions: a new sort).
    expect(tree.counts(false)).toEqual(
      new Map<string, KeptCount>([
        ['1', { count: 4 }],
        ['1.0', { count: 2 }],
      ]),
    );

    const next = new PageCache<Row>({ pageSize: 4, rowCount: cache.rowCount });
    const after = new RemoteTree(next, {
      hasChildren,
      keepCounts: tree.counts(true),
      expanded: ['1', '1.0'],
    });
    load(next, 0, 4);
    // Four loading rows under 1 until it answers, then its children and two under 1.0.
    expect(after.entryAt(6)?.id).toBe('2');
    after.beginChildren('1');
    after.resolveChildren('1', children('1', 2, 1));
    expect(after.wanted).toEqual(['1.0']);
    expect(after.stateAt(3)).toBe('loading');
    expect(after.entryAt(5)?.id).toBe('1.1');
    expect(after.entryAt(6)?.id).toBe('2');
  });

  it('a request failing after its parent collapsed is forgotten, not shown', () => {
    const { cache, tree } = setup();
    tree.setExpanded(['1']);
    tree.beginChildren('1');
    tree.setExpanded([]);
    expect(tree.failChildren('1')).toBe(false);
    expect(tree.forget('1', 'loading') || tree.forget('1', 'error')).toBe(false);
    tree.setExpanded(['1']);
    expect(tree.wanted).toEqual(['1']);
    expect(tree.wanted).toHaveLength(1);
    tree.beginChildren('1');
    expect(tree.wanted).toEqual([]);
    expect(tree.failChildren('1')).toBe(true);
    expect(tree.rowCount).toBe(cache.rowCount + 1);
  });

  it('keepCounts without an index waits for the parent’s row', () => {
    const next = new PageCache<Row>({ pageSize: 4 });
    const after = new RemoteTree(next, {
      hasChildren,
      keepCounts: new Map([['1', { count: 3 }]]),
    });
    after.setExpanded(['1']);
    expect(after.rowCount).toBe(next.rowCount);
    load(next, 0, 4);
    expect(after.rowCount).toBe(next.rowCount + 3);
  });

  it('a different id loading at a kept index drops the kept parent', () => {
    const next = new PageCache<Row>({ pageSize: 4, getRowId: (row) => row.id });
    const after = new RemoteTree(next, {
      hasChildren,
      keepCounts: new Map([['r1', { index: 1, count: 3 }]]),
    });
    after.setExpanded(['r1']);
    expect(after.rowCount).toBe(next.rowCount + 3);
    const order = after.order;
    const { start } = next.begin(0);
    next.resolve(0, [{ id: 'r0', kids: 2 }, { id: 'new', kids: 2 }, ...rows(start + 2, 2)]);
    expect(after.rowCount).toBe(next.rowCount);
    expect(after.entryAt(2)?.id).toBe('r2');
    expect(after.wanted).toEqual([]);
    expect(after.order).not.toBe(order);
  });

  it('an open row whose page fails stays closed', () => {
    const cache = new PageCache<Row>({ pageSize: 4 });
    load(cache, 0, 4);
    const tree = new RemoteTree(cache, { hasChildren });
    tree.setExpanded(['5']);
    cache.begin(1);
    cache.fail(1);
    expect(tree.stateAt(5)).toBe('error');
    expect(tree.rowCount).toBe(cache.rowCount);
    expect(tree.wanted).toEqual([]);
    cache.retry(1);
    load(cache, 1, 4);
    expect(tree.wanted).toEqual(['5']);
  });

  it('shownAncestor finds the row or its nearest shown ancestor', () => {
    const { tree } = setup();
    tree.setExpanded(['1', '1.0']);
    answer(tree, '1', children('1', 2, 1));
    answer(tree, '1.0', children('1/0', 2));
    expect(tree.shownAncestor('1.0.1')).toBe(4);
    tree.setExpanded(['1']);
    expect(tree.shownAncestor('1.0.1')).toBe(2);
    tree.setExpanded([]);
    expect(tree.shownAncestor('1.0.1')).toBe(1);
    expect(tree.shownAncestor('2')).toBe(2);
    expect(tree.shownAncestor('nope')).toBeUndefined();
  });

  it('keeps an open row’s children when its page is evicted', () => {
    const cache = new PageCache<Row>({ pageSize: 4 });
    for (let page = 0; page < 20; page++) load(cache, page, 4);
    const tree = new RemoteTree(cache, { hasChildren });
    tree.setExpanded(['1']);
    answer(tree, '1', children('1', 3));
    expect(tree.indexOf('40')).toBe(43);
    cache.evictOutside(60, 64);
    expect(tree.entryAt(1)).toBeUndefined();
    expect(tree.rowCount).toBe(cache.rowCount + 3);
    expect(tree.indexOf('1.0')).toBe(2);
    expect(tree.entryAt(2)?.id).toBe('1.0');
    expect(tree.wanted).toEqual([]);
  });

  it('shownIndexOf finds an open row whose page was evicted', () => {
    const cache = new PageCache<Row>({ pageSize: 4 });
    for (let page = 0; page < 20; page++) load(cache, page, 4);
    const tree = new RemoteTree(cache, { hasChildren });
    tree.setExpanded(['1', '5']);
    answer(tree, '1', children('1', 3));
    cache.evictOutside(60, 64);
    expect(tree.indexOf('1')).toBeUndefined();
    expect(tree.shownIndexOf('1')).toBe(1);
    expect(tree.shownIndexOf('1.0')).toBe(2);
    // Not open, or never seen: not found.
    expect(tree.shownIndexOf('2')).toBeUndefined();
    expect(tree.shownIndexOf('nope')).toBeUndefined();
  });

  it('drops an evicted open row when another row loads at its index', () => {
    const cache = new PageCache<Row>({ pageSize: 4, getRowId: (row) => row.id });
    for (let page = 0; page < 20; page++) load(cache, page, 4);
    const tree = new RemoteTree(cache, { hasChildren });
    tree.setExpanded(['r1']);
    answer(tree, 'r1', children('r1', 3));
    cache.evictOutside(60, 64);
    expect(tree.rowCount).toBe(cache.rowCount + 3);
    const { start } = cache.begin(0);
    cache.resolve(0, [{ id: 'r0', kids: 2 }, { id: 'moved', kids: 2 }, ...rows(start + 2, 2)]);
    expect(tree.rowCount).toBe(cache.rowCount);
    expect(tree.indexOf('r1.0')).toBeUndefined();
    expect(tree.entryAt(2)?.id).toBe('r2');
    // Back at its index: open again, with its children kept.
    cache.begin(0);
    cache.resolve(0, rows(0, 4));
    expect(tree.entryAt(2)?.id).toBe('r1.0');
  });

  /** The forest's rows as `id(parent)` depth first, and its top-level rows. */
  const forestOf = (tree: RemoteTree<Row>) => {
    const { tree: rows, layout } = tree.forest();
    const name = (row: number) => rows.ids[row] ?? '?';
    return {
      rows: Array.from(layout.order, (row) => {
        const up = rows.parent[row] ?? -1;
        return up === -1 ? name(row) : `${name(row)}(${name(up)})`;
      }),
      roots: Array.from(layout.children(-1), name),
    };
  };

  it('forest lists the loaded rows depth first, children of collapsed rows too', () => {
    const { tree } = setup();
    tree.setExpanded(['1', '1.0']);
    answer(tree, '1', children('1', 2, 1));
    answer(tree, '1.0', children('1.0', 1));
    tree.setExpanded([]);
    expect(forestOf(tree)).toEqual({
      rows: ['0', '1', '1.0(1)', '1.0.0(1.0)', '1.1(1)', '2', '3'],
      roots: ['0', '1', '2', '3'],
    });
    const { tree: rows, layout } = tree.forest();
    const row = (id: string) => rows.indexOf(id) ?? -1;
    expect(Array.from(layout.children(row('1')), (r) => rows.ids[r])).toEqual(['1.0', '1.1']);
    expect(rows.childCount[row('1')]).toBe(2);
    expect(layout.keptChildren).toEqual(rows.childCount);
    expect(layout.posInSet[row('1.1')]).toBe(2);
    expect(layout.posInSet[row('2')]).toBe(3);
    // Children not loaded: a leaf.
    expect(rows.childCount[row('0')]).toBe(0);
    expect(rows.indexOf('4')).toBeUndefined();
  });

  it('forest maps shown indexes to its rows', () => {
    const { tree } = setup();
    tree.setExpanded(['1']);
    const forest = tree.forest();
    // The loading row under '1' isn't a forest row.
    expect(forest.at(2)).toBeUndefined();
    answer(tree, '1', children('1', 2));
    const after = tree.forest();
    expect(after).not.toBe(forest);
    expect(after.tree.ids[after.at(2) ?? -1]).toBe('1.0');
    expect(after.tree.ids[after.at(4) ?? -1]).toBe('2');
    expect(after.at(9)).toBeUndefined();
  });

  it('forest is built once per version', () => {
    const { cache, tree } = setup();
    const forest = tree.forest();
    expect(tree.forest()).toBe(forest);
    load(cache, 1, 4);
    const paged = tree.forest();
    expect(paged).not.toBe(forest);
    expect(paged.tree.ids).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
    expect(tree.forest()).toBe(paged);
  });

  it('forest keeps an open row whose page was evicted, with its children', () => {
    const cache = new PageCache<Row>({ pageSize: 4 });
    for (let page = 0; page < 20; page++) load(cache, page, 4);
    const tree = new RemoteTree(cache, { hasChildren });
    tree.setExpanded(['1', '2', '62']);
    answer(tree, '1', children('1', 2));
    answer(tree, '2', children('2', 2));
    answer(tree, '62', children('62', 1));
    // Collapsed: once its page is evicted, it and its children are out.
    tree.setExpanded(['1', '62']);
    cache.evictOutside(60, 64);
    expect(cache.indexOf('1')).toBeUndefined();
    const { rows, roots } = forestOf(tree);
    expect(roots).toEqual(['1', ...cache.loadedIds()]);
    expect(rows.slice(0, 4)).toEqual(['1', '1.0(1)', '1.1(1)', roots[1]]);
    expect(rows.slice(rows.indexOf('62'), rows.indexOf('62') + 3)).toEqual([
      '62',
      '62.0(62)',
      '63',
    ]);
  });

  it('forest places an id used twice once', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { cache } = setup();
    const twice = new RemoteTree(cache, { hasChildren, getRowId: (row) => row.id });
    twice.setExpanded(['1']);
    answer(twice, '1', [{ id: '2', kids: 0 }, ...children('1', 1)]);
    expect(forestOf(twice).rows).toEqual(['0', '1', '2(1)', '1/0(1)', '3']);
  });

  it('forest gives rows with children a hidden child under a server filter', () => {
    const cache = new PageCache<Row>({ pageSize: 4 });
    const { start } = cache.begin(0);
    cache.resolve(0, [...rows(start, 2), { id: 'leaf', kids: 0 }]);
    const tree = new RemoteTree(cache, { hasChildren, filtered: true });
    tree.setExpanded(['1']);
    answer(tree, '1', [...children('1', 1), { id: 'deep', kids: 1 }]);
    const { tree: forest, layout } = tree.forest();
    const row = (id: string) => forest.indexOf(id) ?? -1;
    // Shown rows first, in layout order; the hidden children after them.
    expect(Array.from(layout.order, (r) => forest.ids[r])).toEqual(['0', '1', '1.0', '1.1', '2']);
    expect(forest.ids.slice(5)).toEqual(['\u00000', '\u00001', '\u00001.1']);
    expect(Array.from(forest.parent.slice(5))).toEqual([row('0'), row('1'), row('1.1')]);
    // Kept children as loaded; the whole tree has one more under rows with children.
    expect(layout.keptChildren[row('1')]).toBe(2);
    expect(forest.childCount[row('1')]).toBe(3);
    expect(forest.childCount[row('0')]).toBe(1);
    expect(forest.childCount[row('1.0')]).toBe(0);
    expect(forest.childCount[row('2')]).toBe(0);
    expect(layout.posInSet[5]).toBe(0);
    expect(forest.indexOf('\u00000')).toBeUndefined();
  });

  it('stays logarithmic', { timeout: 30_000 }, () => {
    const cache = new PageCache<Row>({ pageSize: 1000 });
    for (let page = 0; page < 100; page++) load(cache, page, 1000, 100_000);
    const tree = new RemoteTree(cache, { hasChildren });
    const open = Array.from({ length: 10_000 }, (_, i) => String(i * 10));
    tree.setExpanded(open);
    for (const id of open) answer(tree, id, children(id, 5));
    expect(tree.rowCount).toBe(150_000);
    expect(tree.indexOf('99990.4')).toBe(149_990);
    expect(tree.indexOf('99999')).toBe(149_999);

    const started = performance.now();
    let found = 0;
    for (let i = 0; i < 10_000; i++) {
      const index = (i * 7919) % tree.rowCount;
      const id = tree.entryAt(index)?.id;
      if (id !== undefined && tree.indexOf(id) === index) found++;
    }
    const elapsed = performance.now() - started;
    expect(found).toBe(10_000);
    // Generous: linear lookups would take seconds here.
    expect(elapsed).toBeLessThan(200);
  });
});
