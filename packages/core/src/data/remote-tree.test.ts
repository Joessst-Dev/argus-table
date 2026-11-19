import { describe, expect, it } from 'vitest';
import { PageCache } from './page-cache.js';
import { RemoteTree } from './remote-tree.js';

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
function setup(options: { keepCounts?: ReadonlyMap<string, number> } = {}) {
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
    expect(tree.wanted()).toEqual([]);

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
    expect(tree.wanted()).toEqual(['1']);
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
    expect(tree.wanted()).toEqual([]);
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
    expect(tree.wanted()).toEqual(['1.0']);
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
    expect(tree.wanted()).toEqual([]);
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
    const { cache, tree } = setup({ keepCounts: new Map([['1', 3]]) });
    tree.setExpanded(['1']);
    tree.beginChildren('1');
    tree.failChildren('1');
    expect(tree.rowCount).toBe(cache.rowCount + 1);
    expect(tree.stateAt(2)).toBe('error');
    expect(tree.parentIdAt(2)).toBe('1');
    expect(tree.wanted()).toEqual([]);
    expect(tree.resolveChildren('1', children('1', 2))).toBe(false);

    tree.retryChildren('1');
    expect(tree.wanted()).toEqual(['1']);
    expect(tree.stateAt(2)).toBe('loading');
    answer(tree, '1', children('1', 2));
    expect(tree.entryAt(3)?.id).toBe('1.1');
  });

  it('a cancelled child request is wanted again', () => {
    const { tree } = setup();
    tree.setExpanded(['1']);
    tree.beginChildren('1');
    tree.cancelChildren('1');
    expect(tree.wanted()).toEqual(['1']);
    expect(tree.resolveChildren('1', children('1', 2))).toBe(false);
  });

  it('collapsing while children load keeps the request', () => {
    const { tree } = setup();
    tree.setExpanded(['1']);
    tree.beginChildren('1');
    tree.setExpanded([]);
    expect(tree.resolveChildren('1', children('1', 2))).toBe(true);
    tree.setExpanded(['1']);
    expect(tree.wanted()).toEqual([]);
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
    expect(tree.wanted()).toEqual([]);
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
    expect(tree.wanted()).toEqual([]);
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
    expect(tree.wanted()).toEqual([]);
    expect(tree.rowCount).toBe(cache.rowCount);
    const order = tree.order;
    load(cache, 1, 4);
    expect(tree.wanted()).toEqual(['5']);
    expect(tree.rowCount).toBe(cache.rowCount + 1);
    expect(tree.stateAt(6)).toBe('loading');
    expect(tree.order).not.toBe(order);
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
    expect(tree.wanted()).toEqual(['r1']);
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
    expect(tree.counts()).toEqual(new Map([['1', 3]]));

    const next = new PageCache<Row>({ pageSize: 4 });
    const after = new RemoteTree(next, { hasChildren, keepCounts: tree.counts() });
    after.setExpanded(['1']);
    expect(after.rowCount).toBe(next.rowCount);
    load(next, 0, 4);
    expect(after.rowCount).toBe(cache.rowCount + 3);
    expect(after.wanted()).toEqual(['1']);
    after.beginChildren('1');
    expect([2, 3, 4].map((i) => after.stateAt(i))).toEqual(['loading', 'loading', 'loading']);
    expect(after.entryAt(5)?.id).toBe('2');
    expect(after.counts()).toEqual(new Map([['1', 3]]));
    after.resolveChildren('1', children('1', 2));
    expect(after.entryAt(4)?.id).toBe('2');
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
    expect(tree.wanted()).toEqual([]);
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
