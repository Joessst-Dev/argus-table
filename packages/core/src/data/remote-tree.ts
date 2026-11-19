import type { RemoteRows, TreeRowInfo } from '../table/model-types.js';
import type { TreeExpandedState } from '../types.js';
import type { CachedRow, PageCache, RowState } from './page-cache.js';

/** Where a parent's children are: loaded, in flight, or their request failed. */
export type ChildState = 'loaded' | 'loading' | 'error';

export interface RemoteTreeOptions<TData> {
  /** Whether a row has children to load (`DataSource.hasChildren`). */
  hasChildren: (row: TData) => boolean;
  /**
   * Row id function for children, given their index among their siblings.
   * Default: the parent's id, a dot and that index (`'3.0'`).
   */
  getRowId?: ((row: TData, index: number) => string) | undefined;
  /**
   * Child counts from a previous tree (`counts()`, kept over a `refresh()` or a
   * new sort): an open parent shows that many loading rows until its children
   * arrive, so the rows below it stay in place.
   */
  keepCounts?: ReadonlyMap<string, number> | undefined;
}

/** A parent's children: their state and, once loaded, the rows. */
interface Children<TData> {
  state: ChildState;
  entries: readonly CachedRow<TData>[];
}

/** A loaded child row. */
interface Known<TData> {
  entry: CachedRow<TData>;
  parentId: string;
  /** `hasChildren(row)`, asked once. */
  has: boolean;
}

/** A row under an open top-level row: a loaded child, or a placeholder for children loading or failed. */
interface Node<TData> {
  /** `undefined` for a placeholder. */
  entry: CachedRow<TData> | undefined;
  state: RowState;
  depth: number;
  parentId: string;
  /** The parent's position in the subtree; `-1` for the top-level row. */
  parentLocal: number;
  setSize: number;
  posInSet: number;
  hasChildren: boolean;
  open: boolean;
}

/** The shown descendants of a top-level row, depth first, and the parents among them to request. */
interface Subtree<TData> {
  nodes: readonly Node<TData>[];
  wanted: readonly string[];
}

/** The open top-level rows (with shown descendants), sorted, and the prefix sums of those. */
interface OpenIndex<TData> {
  /** Top-level indexes. */
  tops: number[];
  subtrees: Subtree<TData>[];
  /** `before[m]`: descendants shown above open row `m`; `before[k]` is all of them. */
  before: number[];
  /** Open row by top-level id. */
  byId: Map<string, number>;
  wanted: string[];
}

/** A top-level row seen loaded: where it was, so it stays open while its page is evicted. */
interface Seen<TData> {
  index: number;
  row: TData;
  has: boolean;
}

/**
 * Rows from a `dataSource` shown as a tree: the top-level rows of a `PageCache`,
 * with each open parent's children (loaded separately, one request per parent)
 * spliced in after it, at every level. Bookkeeping only: the caller (the
 * element's DataController) requests what `wanted()` lists and reports back.
 *
 * Indexes are shown indexes: top-level rows and the shown descendants of open
 * ones. Lookups are binary searches over the open top-level rows (k of them),
 * O(log k); the index of open rows is rebuilt when expansion, children or the
 * cache change (O(e log k) for e expanded ids), and a top-level row's flattened
 * descendants only when something under it changes. An open parent whose
 * children are loading or failed shows placeholder rows (no entry) under it.
 */
export class RemoteTree<TData> implements RemoteRows<TData> {
  readonly cache: PageCache<TData>;
  readonly #hasChildren: (row: TData) => boolean;
  readonly #getRowId: ((row: TData, index: number) => string) | undefined;
  readonly #keepCounts: ReadonlyMap<string, number> | undefined;
  #expanded = new Set<string>();
  readonly #children = new Map<string, Children<TData>>();
  readonly #known = new Map<string, Known<TData>>();
  readonly #seen = new Map<string, Seen<TData>>();
  readonly #subtrees = new Map<string, Subtree<TData>>();
  /** Top-level ids whose subtree changed since it was built. */
  readonly #dirty = new Set<string>();
  /** A shown child's top-level row and position in its subtree. */
  readonly #where = new Map<string, { root: string; local: number }>();
  #version = 0;
  #built = -1;
  #index: OpenIndex<TData> = { tops: [], subtrees: [], before: [0], byId: new Map(), wanted: [] };
  #order: object = Object.freeze({});

  constructor(cache: PageCache<TData>, options: RemoteTreeOptions<TData>) {
    this.cache = cache;
    this.#hasChildren = options.hasChildren;
    this.#getRowId = options.getRowId;
    this.#keepCounts = options.keepCounts;
  }

  /** Shown rows: the top-level rows, loaded or not, and the shown descendants of open ones. */
  get rowCount(): number {
    const index = this.#ensure();
    return this.cache.rowCount + (index.before[index.tops.length] ?? 0);
  }

  /** Changes whenever the cache or anything shown under its rows changes. */
  get version(): number {
    return this.#version + this.cache.version;
  }

  /** Changes identity when loaded rows change position; a page load alone keeps it. */
  get order(): object {
    this.#ensure();
    return this.#order;
  }

  entryAt(index: number): CachedRow<TData> | undefined {
    const top = this.#topAt(index);
    if (top !== -1) return this.cache.entryAt(top);
    return this.#nodeAt(index)?.entry;
  }

  indexOf(rowId: string): number | undefined {
    const top = this.cache.indexOf(rowId);
    if (top !== undefined) return this.#positionOfTop(top);
    const index = this.#ensure();
    const where = this.#where.get(rowId);
    if (!where) return undefined;
    const m = index.byId.get(where.root);
    if (m === undefined || index.subtrees[m]?.nodes[where.local]?.entry?.id !== rowId) {
      return undefined;
    }
    return this.#positionOfOpen(m) + 1 + where.local;
  }

  /** The ids of the loaded rows shown, in order. */
  loadedIds(): string[] {
    const { tops, subtrees } = this.#ensure();
    const ids: string[] = [];
    let m = 0;
    const flush = (below: number) => {
      // Children of open rows above `below` (their own row may be evicted).
      for (; m < tops.length && (tops[m] ?? 0) < below; m++) {
        for (const node of subtrees[m]?.nodes ?? []) if (node.entry) ids.push(node.entry.id);
      }
    };
    for (const id of this.cache.loadedIds()) {
      const top = this.cache.indexOf(id) ?? 0;
      flush(top);
      ids.push(id);
      flush(top + 1);
    }
    flush(Infinity);
    return ids;
  }

  /** Top-level rows: the cache's state; placeholders: their parent's children's state. */
  stateAt(index: number): RowState {
    const top = this.#topAt(index);
    if (top !== -1) return this.cache.stateAt(top);
    return this.#nodeAt(index)?.state ?? 'loading';
  }

  /** Where a loaded row sits in the tree; `undefined` for rows not loaded and placeholders. */
  treeRow(index: number): TreeRowInfo | undefined {
    const top = this.#topAt(index);
    if (top !== -1) {
      const entry = this.cache.entryAt(top);
      if (!entry) return undefined;
      const hasChildren = this.#hasChildren(entry.row) && !this.#empty(entry.id);
      return {
        depth: 0,
        hasChildren,
        open: hasChildren && this.#expanded.has(entry.id),
        forced: false,
        parent: undefined,
        setSize: this.cache.totalKnown ? this.cache.rowCount : -1,
        posInSet: top + 1,
      };
    }
    const m = this.#openAbove(index);
    const node = this.#nodeAt(index);
    if (!node?.entry) return undefined;
    const start = this.#positionOfOpen(m);
    return {
      depth: node.depth,
      hasChildren: node.hasChildren,
      open: node.open,
      forced: false,
      parent: node.parentLocal === -1 ? start : start + 1 + node.parentLocal,
      setSize: node.setSize,
      posInSet: node.posInSet,
    };
  }

  /** Whether a row can open: loaded, `hasChildren`, and not known to have no children. */
  canExpand(rowId: string): boolean {
    if (this.#empty(rowId)) return false;
    const known = this.#known.get(rowId);
    if (known) return known.has;
    const top = this.cache.indexOf(rowId);
    const entry = top === undefined ? undefined : this.cache.entryAt(top);
    return entry !== undefined && this.#hasChildren(entry.row);
  }

  /** The index of the row when shown, else of its nearest shown ancestor; `undefined` when none is. */
  shownAncestor(rowId: string): number | undefined {
    let id: string | undefined = rowId;
    // At most as many steps as rows are known (a guard against id cycles).
    for (let steps = 0; id !== undefined && steps <= this.#known.size; steps++) {
      const index = this.indexOf(id);
      if (index !== undefined) return index;
      id = this.#known.get(id)?.parentId;
    }
    return undefined;
  }

  /** The top-level index at a shown index, or `undefined` for a descendant (or out of range). */
  topIndexOf(index: number): number | undefined {
    const top = this.#topAt(index);
    return top === -1 ? undefined : top;
  }

  /** The top-level rows the shown range [start, end) covers, for `getRows` paging. */
  topRange(start: number, end: number): { start: number; end: number } {
    const count = this.rowCount;
    const from = Math.max(0, Math.min(Math.floor(start), count));
    const to = Math.max(0, Math.min(Math.floor(end), count));
    const first = from < count ? this.#topOrRoot(from) : this.cache.rowCount;
    if (to <= from) return { start: first, end: first };
    return { start: first, end: this.#topOrRoot(to - 1) + 1 };
  }

  /** For a loaded child or a placeholder: its parent's id. */
  parentIdAt(index: number): string | undefined {
    if (this.#topAt(index) !== -1) return undefined;
    return this.#nodeAt(index)?.parentId;
  }

  /** The expanded ids (`treeExpanded`). Ids of rows not loaded yet open once they load. */
  setExpanded(ids: TreeExpandedState): void {
    const next = new Set(ids);
    const old = this.#expanded;
    if (next.size === old.size && [...next].every((id) => old.has(id))) return;
    for (const id of next) if (!old.has(id)) this.#expansionChanged(id);
    for (const id of old) if (!next.has(id)) this.#expansionChanged(id);
    this.#expanded = next;
    this.#version++;
  }

  /** Ids of open, loaded parents shown whose children are neither loaded nor loading nor failed: to request. */
  wanted(): string[] {
    return [...this.#ensure().wanted];
  }

  /** The state of a parent's children, or `undefined` when they haven't been requested. */
  childState(parentId: string): ChildState | undefined {
    return this.#children.get(parentId)?.state;
  }

  /** Marks a parent's children as in flight. */
  beginChildren(parentId: string): void {
    const entries = this.#children.get(parentId)?.entries ?? [];
    this.#children.set(parentId, { state: 'loading', entries });
    this.#changed(parentId);
  }

  /** Stores a parent's children. Ignored (`false`) unless they are in flight. */
  resolveChildren(parentId: string, rows: readonly TData[]): boolean {
    const record = this.#children.get(parentId);
    if (record?.state !== 'loading') return false;
    for (const entry of record.entries) this.#known.delete(entry.id);
    const getRowId = this.#getRowId;
    const entries = rows.map((row, i) => ({
      id: getRowId ? getRowId(row, i) : `${parentId}.${String(i)}`,
      row,
    }));
    for (const entry of entries) {
      this.#known.set(entry.id, { entry, parentId, has: this.#hasChildren(entry.row) });
    }
    this.#children.set(parentId, { state: 'loaded', entries });
    this.#changed(parentId);
    return true;
  }

  /** Marks in-flight children as failed: one error row shows under the parent. */
  failChildren(parentId: string): void {
    const record = this.#children.get(parentId);
    if (record?.state !== 'loading') return;
    this.#children.set(parentId, { state: 'error', entries: record.entries });
    this.#changed(parentId);
  }

  /** Lets failed children be requested again (`wanted()`). */
  retryChildren(parentId: string): void {
    if (this.#children.get(parentId)?.state !== 'error') return;
    this.#children.delete(parentId);
    this.#changed(parentId);
  }

  /** Forgets in-flight children (their request was aborted), so they can be requested again. */
  cancelChildren(parentId: string): void {
    if (this.#children.get(parentId)?.state !== 'loading') return;
    this.#children.delete(parentId);
    this.#changed(parentId);
  }

  /** The number of rows shown under each shown open parent, for the next tree after `refresh()` (`keepCounts`). */
  counts(): ReadonlyMap<string, number> {
    const counts = new Map<string, number>();
    for (const id of this.#expanded) {
      const known = this.#known.get(id);
      const shown = known
        ? known.has && this.indexOf(id) !== undefined
        : this.#topIndex(id) !== undefined;
      if (shown) counts.set(id, this.#shownChildren(id));
    }
    return counts;
  }

  /** A loaded row by id (a parent, for `ChildrenRequest.parent`). */
  childRow(parentId: string): TData | undefined {
    const known = this.#known.get(parentId);
    if (known) return known.entry.row;
    const top = this.cache.indexOf(parentId);
    return top === undefined ? undefined : this.cache.entryAt(top)?.row;
  }

  /** `true` when a parent's children are loaded and there are none. */
  #empty(rowId: string): boolean {
    const record = this.#children.get(rowId);
    return record?.state === 'loaded' && record.entries.length === 0;
  }

  /** Rows shown directly under an open parent: its children, or its placeholders. */
  #shownChildren(parentId: string): number {
    const record = this.#children.get(parentId);
    if (record?.state === 'loaded') return record.entries.length;
    if (record?.state === 'error') return 1;
    return Math.max(0, Math.floor(this.#keepCounts?.get(parentId) ?? 1));
  }

  #changed(parentId: string): void {
    this.#dirty.add(this.#rootOf(parentId));
    this.#version++;
  }

  #expansionChanged(id: string): void {
    // A top-level row's own expansion changes only the index, not its subtree.
    const root = this.#rootOf(id);
    if (root !== id) this.#dirty.add(root);
  }

  /** The top-level id above a row (itself for a top-level or unknown id). */
  #rootOf(id: string): string {
    let root = id;
    for (let steps = 0; steps <= this.#known.size; steps++) {
      const parent = this.#known.get(root)?.parentId;
      if (parent === undefined) break;
      root = parent;
    }
    return root;
  }

  /**
   * The top-level index of an expanded id that can show children: its row is
   * loaded, or was (its page evicted since: its children stay), and has children.
   */
  #topIndex(id: string): number | undefined {
    const cache = this.cache;
    const index = cache.indexOf(id);
    if (index !== undefined) {
      const row = cache.entryAt(index)?.row;
      if (row === undefined) return undefined;
      let seen = this.#seen.get(id);
      if (seen?.row !== row || seen.index !== index) {
        seen = { index, row, has: this.#hasChildren(row) };
        this.#seen.set(id, seen);
      }
      return seen.has ? index : undefined;
    }
    const seen = this.#seen.get(id);
    if (!seen?.has || seen.index >= cache.rowCount) return undefined;
    const entry = cache.entryAt(seen.index);
    if (entry && entry.id !== id) {
      this.#seen.delete(id);
      return undefined;
    }
    return seen.index;
  }

  #ensure(): OpenIndex<TData> {
    const version = this.version;
    if (this.#built === version) return this.#index;
    this.#built = version;

    const found: { top: number; id: string }[] = [];
    for (const id of this.#expanded) {
      if (this.#known.has(id)) continue;
      const top = this.#topIndex(id);
      if (top !== undefined) found.push({ top, id });
    }
    found.sort((a, b) => a.top - b.top);

    const index: OpenIndex<TData> = {
      tops: [],
      subtrees: [],
      before: [0],
      byId: new Map(),
      wanted: [],
    };
    let total = 0;
    for (const { top, id } of found) {
      const subtree = this.#subtree(id);
      for (const parentId of subtree.wanted) {
        // The top-level row itself needs to be loaded to be requested.
        if (parentId !== id || this.cache.entryAt(top) !== undefined) index.wanted.push(parentId);
      }
      if (subtree.nodes.length === 0) continue;
      index.byId.set(id, index.tops.length);
      index.tops.push(top);
      index.subtrees.push(subtree);
      total += subtree.nodes.length;
      index.before.push(total);
    }

    const old = this.#index;
    const same =
      old.tops.length === index.tops.length &&
      old.tops.every(
        (top, m) => top === index.tops[m] && old.subtrees[m]?.nodes === index.subtrees[m]?.nodes,
      );
    if (!same) this.#order = Object.freeze({});
    this.#index = index;
    return index;
  }

  /** A top-level row's shown descendants, rebuilt only when something under it changed. */
  #subtree(root: string): Subtree<TData> {
    const old = this.#subtrees.get(root);
    if (old && !this.#dirty.has(root)) return old;
    this.#dirty.delete(root);
    const nodes: Node<TData>[] = [];
    const wanted: string[] = [];
    this.#emit(root, 1, -1, nodes, wanted, new Set([root]));

    if (old && sameNodes(old.nodes, nodes)) {
      const subtree = { nodes: old.nodes, wanted };
      this.#subtrees.set(root, subtree);
      return subtree;
    }
    if (old) {
      for (const node of old.nodes) {
        if (node.entry && this.#where.get(node.entry.id)?.root === root) {
          this.#where.delete(node.entry.id);
        }
      }
    }
    nodes.forEach((node, local) => {
      if (node.entry) this.#where.set(node.entry.id, { root, local });
    });
    const subtree = { nodes, wanted };
    this.#subtrees.set(root, subtree);
    return subtree;
  }

  /** Adds a parent's shown rows, depth first: its children (and theirs when open), or placeholders. */
  #emit(
    parentId: string,
    depth: number,
    parentLocal: number,
    nodes: Node<TData>[],
    wanted: string[],
    path: Set<string>,
  ): void {
    const record = this.#children.get(parentId);
    if (record?.state !== 'loaded') {
      if (!record) wanted.push(parentId);
      const state = record?.state ?? 'loading';
      const count = this.#shownChildren(parentId);
      for (let i = 0; i < count; i++) {
        nodes.push({
          entry: undefined,
          state,
          depth,
          parentId,
          parentLocal,
          setSize: count,
          posInSet: i + 1,
          hasChildren: false,
          open: false,
        });
      }
      return;
    }
    const setSize = record.entries.length;
    record.entries.forEach((entry, i) => {
      const hasChildren = (this.#known.get(entry.id)?.has ?? false) && !this.#empty(entry.id);
      const open = hasChildren && this.#expanded.has(entry.id) && !path.has(entry.id);
      const local = nodes.length;
      nodes.push({
        entry,
        state: 'loaded',
        depth,
        parentId,
        parentLocal,
        setSize,
        posInSet: i + 1,
        hasChildren,
        open,
      });
      if (open) {
        path.add(entry.id);
        this.#emit(entry.id, depth + 1, local, nodes, wanted, path);
        path.delete(entry.id);
      }
    });
  }

  /** The number of open rows above top-level index `top`. */
  #openBefore(top: number): number {
    const { tops } = this.#ensure();
    let low = 0;
    let high = tops.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((tops[mid] ?? 0) < top) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  #positionOfTop(top: number): number {
    const m = this.#openBefore(top);
    return top + (this.#index.before[m] ?? 0);
  }

  /** The shown index of open row `m`. */
  #positionOfOpen(m: number): number {
    const index = this.#ensure();
    return (index.tops[m] ?? 0) + (index.before[m] ?? 0);
  }

  /** The last open row shown above a shown index, or `-1`. */
  #openAbove(position: number): number {
    const { tops, before } = this.#ensure();
    let low = 0;
    let high = tops.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((tops[mid] ?? 0) + (before[mid] ?? 0) < position) low = mid + 1;
      else high = mid;
    }
    return low - 1;
  }

  /** The top-level index at a shown index, or `-1` for a descendant or out of range. */
  #topAt(position: number): number {
    if (!Number.isInteger(position) || position < 0 || position >= this.rowCount) return -1;
    const m = this.#openAbove(position);
    if (m !== -1 && position <= this.#positionOfOpen(m) + this.#sizeOf(m)) return -1;
    return position - (this.#index.before[m + 1] ?? 0);
  }

  /** The descendant at a shown index (`#topAt` is `-1` there). */
  #nodeAt(position: number): Node<TData> | undefined {
    const m = this.#openAbove(position);
    if (m === -1) return undefined;
    return this.#index.subtrees[m]?.nodes[position - this.#positionOfOpen(m) - 1];
  }

  #sizeOf(m: number): number {
    return this.#index.subtrees[m]?.nodes.length ?? 0;
  }

  /** The top-level index at a shown index, or its top-level ancestor's for a descendant. */
  #topOrRoot(position: number): number {
    const top = this.#topAt(position);
    if (top !== -1) return top;
    return this.#index.tops[this.#openAbove(position)] ?? 0;
  }
}

function sameNodes<TData>(a: readonly Node<TData>[], b: readonly Node<TData>[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((node, i) => {
    const other = b[i];
    return (
      other !== undefined &&
      node.entry === other.entry &&
      node.state === other.state &&
      node.depth === other.depth &&
      node.parentId === other.parentId &&
      node.parentLocal === other.parentLocal &&
      node.setSize === other.setSize &&
      node.posInSet === other.posInSet &&
      node.hasChildren === other.hasChildren &&
      node.open === other.open
    );
  });
}
