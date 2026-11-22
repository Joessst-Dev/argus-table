import type { RowPredicate } from '../filters/filter.js';
import type { RowTree } from './row-tree.js';

/*
 * The tree's three steps between its rows and the body: keep the rows the
 * filters pass with their ancestors, lay the kept rows out depth-first with
 * each group of siblings in sort order, and drop the rows under collapsed
 * ones. Each is one pass, O(n), with loops rather than recursion so a deep
 * tree can't overflow the stack. Rows are source indexes (see `RowTree`).
 */

/** The rows the filters keep in a tree. */
export interface KeptRows {
  /** The source indexes the filters keep, ascending (as `sortRows` wants them). */
  rows: readonly number[];
  /**
   * 1 for each row with a matching descendant (whether or not it matches
   * itself), per source index, while a filter is on; `undefined` without one.
   * Such rows are shown open, so a match is never hidden under a collapsed row.
   */
  holdsMatch: Uint8Array | undefined;
}

/**
 * The rows `test` passes, with every ancestor of each, but not their
 * descendants: a child is kept only if it passes, or holds a row that does.
 * Without a test every row is kept.
 */
export function keepWithAncestors<TData>(
  tree: RowTree<TData>,
  test: RowPredicate<TData> | undefined,
): KeptRows {
  const { rows: source, parent } = tree;
  const n = source.length;
  if (!test) {
    const rows = new Array<number>(n);
    for (let i = 0; i < n; i++) rows[i] = i;
    return { rows, holdsMatch: undefined };
  }
  const kept = new Uint8Array(n);
  const holdsMatch = new Uint8Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (!test(source[i] as TData, i)) continue;
    if (kept[i] === 0) count++;
    kept[i] = 1;
    // Up to the first ancestor already marked: its own ancestors are too, so
    // each row is marked once and the whole pass stays linear.
    let up = parent[i] ?? -1;
    while (up !== -1 && holdsMatch[up] === 0) {
      holdsMatch[up] = 1;
      if (kept[up] === 0) count++;
      kept[up] = 1;
      up = parent[up] ?? -1;
    }
  }
  const rows = new Array<number>(count);
  let next = 0;
  for (let i = 0; i < n; i++) if (kept[i] === 1) rows[next++] = i;
  return { rows, holdsMatch };
}

/** The kept rows of a tree laid out for the body, before collapsed rows drop out. */
export interface TreeLayout {
  /** Kept rows depth-first, each sibling group in the order of `sorted`. */
  readonly order: Int32Array;
  /** Kept children per source index (0 for rows not kept). */
  readonly keptChildren: Int32Array;
  /** 1-based position among kept siblings, per source index. */
  readonly posInSet: Int32Array;
  /**
   * Kept children of a row in layout order; `-1` for the kept top-level rows.
   * A view into the layout's storage: read it, don't keep or modify it.
   */
  children(parent: number): Int32Array;
}

/**
 * A tree's rows and their layout, as branch selection reads them: a
 * `RowTree` with the filters' `TreeLayout`, or a remote tree's loaded rows
 * (`RemoteTree.forest()`, where every row is kept). Rows are indexes into `ids`.
 */
export interface TreeForest {
  readonly tree: {
    readonly ids: readonly string[];
    /** Each row's parent, `-1` for a top-level row. */
    readonly parent: Int32Array;
    /** Each row's children in the whole tree. */
    readonly childCount: Int32Array;
    indexOf(id: string): number | undefined;
  };
  readonly layout: TreeLayout;
}

/**
 * Lays out `sorted`, the kept rows in sort order (or in source order when
 * nothing sorts), so each row comes right before its kept descendants and
 * siblings keep their order in `sorted`. Sorting all kept rows at once and
 * then bucketing them by parent sorts every sibling group the same way, with
 * one sort function per column. Every parent of a row in `sorted` must be in
 * it too, as `keepWithAncestors` ensures.
 */
export function layoutTree(
  tree: Pick<RowTree<unknown>, 'parent' | 'rows'>,
  sorted: readonly number[],
): TreeLayout {
  const buckets = bucketByParent(tree.parent, sorted, tree.rows.length);
  const { start, slots, keptChildren, posInSet, roots } = buckets;
  const children = (row: number): Int32Array => {
    if (row === -1) return slots.subarray(0, roots);
    const from = start[row] ?? 0;
    return slots.subarray(from, from + (keptChildren[row] ?? 0));
  };
  const order = preorderOf(buckets, sorted.length);
  return { order, keptChildren, posInSet, children };
}

/** `sorted`'s rows bucketed by parent, in `sorted`'s order within each bucket. */
interface Buckets {
  /** Each row's children's start in `slots`. */
  start: Int32Array;
  /** The top-level rows (`roots` of them), then each row's children. */
  slots: Int32Array;
  keptChildren: Int32Array;
  /** Each kept row's position among its siblings, from 1. */
  posInSet: Int32Array;
  roots: number;
}

/**
 * Buckets the rows by parent: counts each group, gives each group its start in
 * `slots` (the top-level rows first), then fills the groups in `sorted`'s order.
 */
function bucketByParent(parent: Int32Array, sorted: readonly number[], n: number): Buckets {
  const total = sorted.length;
  const start = new Int32Array(n);
  let roots = 0;
  for (let k = 0; k < total; k++) {
    const up = parent[sorted[k] ?? 0] ?? -1;
    if (up === -1) roots++;
    else start[up] = (start[up] ?? 0) + 1;
  }
  let offset = roots;
  for (let i = 0; i < n; i++) {
    const count = start[i] ?? 0;
    start[i] = offset;
    offset += count;
  }
  const slots = new Int32Array(total);
  // Counted again while filling, so it ends as the number of kept children and
  // gives each child its position among its siblings on the way.
  const keptChildren = new Int32Array(n);
  const posInSet = new Int32Array(n);
  let filledRoots = 0;
  for (let k = 0; k < total; k++) {
    const row = sorted[k] ?? 0;
    const up = parent[row] ?? -1;
    if (up === -1) {
      slots[filledRoots] = row;
      posInSet[row] = ++filledRoots;
    } else {
      const filled = keptChildren[up] ?? 0;
      slots[(start[up] ?? 0) + filled] = row;
      keptChildren[up] = filled + 1;
      posInSet[row] = filled + 1;
    }
  }
  return { start, slots, keptChildren, posInSet, roots };
}

/**
 * The bucketed rows depth-first, in preorder: each group goes on the stack in
 * reverse so it comes off in order. Shorter than `total` only when `sorted`
 * held a row without its parent: that row is left out.
 */
function preorderOf({ start, slots, keptChildren, roots }: Buckets, total: number): Int32Array {
  const order = new Int32Array(total);
  const stack = new Int32Array(total);
  let top = 0;
  for (let k = roots - 1; k >= 0; k--) stack[top++] = slots[k] ?? 0;
  let placed = 0;
  while (top > 0) {
    const row = stack[--top] ?? 0;
    order[placed++] = row;
    const from = start[row] ?? 0;
    for (let k = from + (keptChildren[row] ?? 0) - 1; k >= from; k--) stack[top++] = slots[k] ?? 0;
  }
  return placed === total ? order : order.slice(0, placed);
}

/**
 * The rows of `layout.order` whose ancestors are all open. `isOpen` is asked
 * only for rows with kept children; a closed one's descendants are the rows
 * after it that are deeper, all skipped.
 */
export function showOpen<TData>(
  tree: RowTree<TData>,
  layout: TreeLayout,
  isOpen: (index: number) => boolean,
): number[] {
  const { depth } = tree;
  const { order, keptChildren } = layout;
  const shown: number[] = [];
  let k = 0;
  while (k < order.length) {
    const row = order[k++] ?? 0;
    shown.push(row);
    if ((keptChildren[row] ?? 0) === 0 || isOpen(row)) continue;
    const level = depth[row] ?? 0;
    while (k < order.length && (depth[order[k] ?? 0] ?? 0) > level) k++;
  }
  return shown;
}
