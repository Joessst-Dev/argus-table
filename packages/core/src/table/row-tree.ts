/** Where a tree's rows come from: nested children, or parent ids on flat data. */
export interface TreeSource<TData> {
  /** A row's children, nested in it. Wins over `getParentId` when both are set. */
  getSubRows?: ((row: TData) => readonly TData[] | undefined) | undefined;
  /** The id of a row's parent in flat data; `null` or `undefined` for a top-level row. */
  getParentId?: ((row: TData) => string | null | undefined) | undefined;
}

/**
 * Every row of a tree by source index. Top-level and flat rows keep their index
 * in `data`; nested children follow from `data.length` on, in depth-first
 * order, so a row's index is the same whatever the sort, filters or expanded
 * rows.
 */
export interface RowTree<TData> {
  /** The rows by source index: `rows[i] === data[i]` for `i < data.length` (`data` itself for flat data). */
  readonly rows: readonly TData[];
  /** The rows' ids by source index. */
  readonly ids: readonly string[];
  /** The source index of each row's parent, `-1` for a top-level row. */
  readonly parent: Int32Array;
  /** Each row's depth, `0` for a top-level row. */
  readonly depth: Int32Array;
  /** Each row's number of children in the tree (filters not applied). */
  readonly childCount: Int32Array;
  /** The source index of the row with an id. */
  indexOf(id: string): number | undefined;
}

/** How many ids a warning names before it stops listing them. */
const LISTED = 5;

const listed = (ids: readonly string[]): string =>
  ids
    .slice(0, LISTED)
    .map((id) => JSON.stringify(id))
    .join(', ') + (ids.length > LISTED ? ` and ${String(ids.length - LISTED)} more` : '');

/**
 * Builds the tree of `data` in O(n), with loops rather than recursion so a deep
 * tree can't overflow the stack. Default ids are the index in `data` for
 * top-level rows and the parent's id, a dot and the index among siblings for
 * nested children (`'3.0.2'`); `getRowId` gets each row with its source index.
 *
 * In flat data a row whose parent id matches no row, or that is part of a cycle
 * of parents, becomes a top-level row: showing it beats dropping it. One
 * warning per build names such rows.
 */
export function buildRowTree<TData>(
  data: readonly TData[],
  source: TreeSource<TData>,
  getRowId: ((row: TData, index: number) => string) | undefined,
  warn: (message: string) => void = console.warn,
): RowTree<TData> {
  const { getSubRows, getParentId } = source;
  if (getSubRows) {
    if (getParentId) {
      warn('argus-table: getSubRows and getParentId are both set; getSubRows is used.');
    }
    return nestedTree(data, getSubRows, getRowId);
  }
  if (getParentId) return flatTree(data, getParentId, getRowId, warn);
  // Neither set: every row is top-level.
  return flatTree(data, () => undefined, getRowId, warn);
}

function nestedTree<TData>(
  data: readonly TData[],
  getSubRows: (row: TData) => readonly TData[] | undefined,
  getRowId: ((row: TData, index: number) => string) | undefined,
): RowTree<TData> {
  const rows: TData[] = data.slice();
  const ids: string[] = [];
  // Plain arrays while the size is unknown, typed arrays once it is.
  const parents: number[] = [];
  const depths: number[] = [];
  const counts: number[] = [];

  // Pending children, pushed in reverse so they come off the stack in order:
  // the row, its parent's source index, and its index among its siblings.
  const stackRows: TData[] = [];
  const stackParents: number[] = [];
  const stackSiblings: number[] = [];
  const pushChildren = (row: TData, index: number): void => {
    const kids = getSubRows(row);
    if (!kids) return;
    counts[index] = kids.length;
    for (let k = kids.length - 1; k >= 0; k--) {
      stackRows.push(kids[k] as TData);
      stackParents.push(index);
      stackSiblings.push(k);
    }
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as TData;
    ids.push(getRowId ? getRowId(row, i) : String(i));
    parents.push(-1);
    depths.push(0);
    counts.push(0);
  }
  // Top-level rows hold the first indexes, so their descendants are numbered
  // after all of them: one walk per top-level row, in order.
  for (let top = 0; top < data.length; top++) {
    pushChildren(data[top] as TData, top);
    while (stackRows.length > 0) {
      const row = stackRows.pop() as TData;
      const parent = stackParents.pop() ?? -1;
      const sibling = stackSiblings.pop() ?? 0;
      const index = rows.length;
      rows.push(row);
      ids.push(getRowId ? getRowId(row, index) : `${ids[parent] ?? ''}.${String(sibling)}`);
      parents.push(parent);
      depths.push((depths[parent] ?? 0) + 1);
      counts.push(0);
      pushChildren(row, index);
    }
  }

  return makeTree(
    rows,
    ids,
    Int32Array.from(parents),
    Int32Array.from(depths),
    Int32Array.from(counts),
  );
}

/** The depth of a row on the current walk up, not known yet. */
const ON_WALK = -2;

function flatTree<TData>(
  data: readonly TData[],
  getParentId: (row: TData) => string | null | undefined,
  getRowId: ((row: TData, index: number) => string) | undefined,
  warn: (message: string) => void,
): RowTree<TData> {
  const n = data.length;
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push(getRowId ? getRowId(data[i] as TData, i) : String(i));
  // Filled from the end, so the first row with an id wins, as a search would find it.
  const byId = new Map<string, number>();
  for (let i = n - 1; i >= 0; i--) byId.set(ids[i] ?? '', i);

  const parent = new Int32Array(n);
  const missing: string[] = [];
  for (let i = 0; i < n; i++) {
    const parentId = getParentId(data[i] as TData);
    if (parentId == null) {
      parent[i] = -1;
      continue;
    }
    const index = byId.get(parentId);
    if (index === undefined) missing.push(ids[i] ?? '');
    parent[i] = index ?? -1;
  }

  // Depths, and cycles on the way: follow each row's parents up to a row whose
  // depth is known or a top-level row, then fill the depths back down the path,
  // so every row is walked over once. Meeting a row of the current walk closes
  // a cycle: every row of it becomes top-level, and the rows leading into it
  // keep their parents.
  const depth = new Int32Array(n).fill(-1);
  const walk: number[] = [];
  const cycled: string[] = [];
  for (let start = 0; start < n; start++) {
    let row = start;
    while (row !== -1 && depth[row] === -1) {
      depth[row] = ON_WALK;
      walk.push(row);
      row = parent[row] ?? -1;
    }
    let below = walk.length;
    let known = row === -1 ? -1 : (depth[row] ?? 0);
    if (known === ON_WALK) {
      below = walk.lastIndexOf(row);
      for (let k = below; k < walk.length; k++) {
        const member = walk[k] ?? 0;
        parent[member] = -1;
        depth[member] = 0;
        cycled.push(ids[member] ?? '');
      }
      known = 0;
    }
    for (let k = below - 1; k >= 0; k--) {
      known += 1;
      depth[walk[k] ?? 0] = known;
    }
    walk.length = 0;
  }

  if (missing.length > 0 || cycled.length > 0) {
    const reasons: string[] = [];
    if (missing.length > 0) reasons.push(`a parent id that matches no row (${listed(missing)})`);
    if (cycled.length > 0) reasons.push(`parents that form a cycle (${listed(cycled)})`);
    warn(`argus-table: rows with ${reasons.join(' or ')} are shown as top-level rows.`);
  }

  const childCount = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const p = parent[i] ?? -1;
    if (p !== -1) childCount[p] = (childCount[p] ?? 0) + 1;
  }

  return makeTree(data, ids, parent, depth, childCount, byId);
}

function makeTree<TData>(
  rows: readonly TData[],
  ids: readonly string[],
  parent: Int32Array,
  depth: Int32Array,
  childCount: Int32Array,
  byId?: Map<string, number>,
): RowTree<TData> {
  let index = byId;
  return {
    rows,
    ids,
    parent,
    depth,
    childCount,
    indexOf(id) {
      // Built on the first lookup: many trees are never searched by id.
      if (!index) {
        const map = new Map<string, number>();
        ids.forEach((key, i) => {
          if (!map.has(key)) map.set(key, i);
        });
        index = map;
      }
      return index.get(id);
    },
  };
}
