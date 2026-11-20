import type { RemoteForest, RemoteRows, TreeRowInfo } from '../table/model-types.js';
import {
  plainStandIn,
  plainStandInId,
  type RowStructure,
  type StandIn,
} from '../table/row-structure.js';
import type { TreeExpandedState } from '../types.js';
import type { CachedRow, PageCache, RowState } from './page-cache.js';
import { layoutTree } from '../table/tree-order.js';

/** The rows shown under a parent, kept from one tree to the next (`RemoteTree.counts()`). */
export interface KeptCount {
  /**
   * The parent's top-level index, for a top-level parent: it counts as open there
   * (with `count` loading rows) until its page loads, unless another row loads
   * there. Without it, the count applies once the parent's row is loaded.
   */
  index?: number | undefined;
  /** Rows shown under the parent: its children and their shown descendants. */
  count: number;
}

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
   * arrive (or fail), so the rows below it stay in place. A top-level parent with
   * an `index` counts as open at that index before its page loads.
   */
  keepCounts?: ReadonlyMap<string, KeptCount> | undefined;
  /**
   * Where to report a row id used by more than one row, each time children
   * bring one (the caller warns once). Nothing is reported without it.
   */
  warn?: ((message: string) => void) | undefined;
  /**
   * The server filtered the rows (a filter or quick filter is on): a row with
   * children may have more than it sent, so for branch selection its id never
   * stands for its whole branch (`forest()`).
   */
  filtered?: boolean | undefined;
  /** The expanded ids to start with (`setExpanded`). */
  expanded?: TreeExpandedState | undefined;
}

/** A parent's children: loaded (with the rows), in flight, or their request failed. */
type Children<TData> =
  { state: 'loaded'; entries: readonly CachedRow<TData>[] } | { state: 'loading' | 'error' };

/** A loaded child row. */
interface Known<TData> {
  entry: CachedRow<TData>;
  parentId: string;
  /** `hasChildren(row)`, asked once. */
  has: boolean;
}

/** Where a shown index is (`RemoteTree.#at`): a top-level index, or open row `m`'s descendant `node`. */
interface At<TData> {
  position: number;
  version: number;
  top: number | undefined;
  m: number;
  node: Node<TData> | undefined;
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
  /** `undefined` for a parent kept from a previous tree (`KeptCount.index`) whose row hasn't loaded. */
  row: TData | undefined;
  has: boolean;
}

/**
 * Rows from a `dataSource` shown as a tree: the top-level rows of a `PageCache`,
 * with each open parent's children (loaded separately, one request per parent)
 * spliced in after it, at every level. Bookkeeping only: the caller (the
 * element's DataController) requests what `wanted` lists and reports back.
 *
 * Indexes are shown indexes: top-level rows and the shown descendants of open
 * ones. Lookups are binary searches over the open top-level rows (k of them),
 * O(log k). The index of open rows is rebuilt when expansion, children or the
 * cache change: O(e log e) for e expanded ids; a top-level row's flattened
 * descendants are rebuilt only when something under it changes. An open parent
 * whose children are loading or failed shows placeholder rows (no entry) under it.
 *
 * Child ids must be unique across levels (reported through `warn` otherwise).
 */
export class RemoteTree<TData> implements RemoteRows<TData>, RowStructure {
  readonly cache: PageCache<TData>;
  readonly #hasChildren: (row: TData) => boolean;
  readonly #getRowId: ((row: TData, index: number) => string) | undefined;
  /** Kept counts of parents whose children haven't settled since. */
  readonly #kept: Map<string, KeptCount>;
  readonly #warn: ((message: string) => void) | undefined;
  readonly #filtered: boolean;
  /** The expanded top-level rows that can show children, by top-level index. */
  #sorted: { top: number; id: string }[] = [];
  #expanded: Set<string>;
  readonly #children = new Map<string, Children<TData>>();
  readonly #known = new Map<string, Known<TData>>();
  readonly #seen = new Map<string, Seen<TData>>();
  /** `hasChildren` of loaded top-level rows, asked once per row. */
  readonly #hasTop = new WeakMap<CachedRow<TData>, boolean>();
  readonly #subtrees = new Map<string, Subtree<TData>>();
  /** Top-level ids whose subtree changed since it was built. */
  readonly #dirty = new Set<string>();
  /** A shown child's top-level row and position in its subtree. */
  readonly #where = new Map<string, { root: string; local: number }>();
  #version = 0;
  #built = -1;
  #index: OpenIndex<TData> = { tops: [], subtrees: [], before: [0], byId: new Map(), wanted: [] };
  #order: object = Object.freeze({});
  /** The last shown index looked up: a rendered row is read once per cell. */
  #last: At<TData> | undefined;
  /** The loaded rows as a forest, and the version it was built for. */
  #forest: { version: number; forest: RemoteForest } | undefined;

  constructor(cache: PageCache<TData>, options: RemoteTreeOptions<TData>) {
    this.cache = cache;
    this.#hasChildren = options.hasChildren;
    this.#getRowId = options.getRowId;
    this.#filtered = options.filtered ?? false;
    this.#warn = options.warn;
    this.#expanded = new Set(options.expanded);
    this.#kept = new Map(options.keepCounts);
    for (const [id, { index }] of this.#kept) {
      if (index !== undefined) this.#seen.set(id, { index, row: undefined, has: true });
    }
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
    const { top, node } = this.#at(index);
    return top === undefined ? node?.entry : this.cache.entryAt(top);
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
    const { byId, subtrees } = this.#ensure();
    const ids: string[] = [];
    for (const [id, loaded] of this.#roots()) {
      if (loaded) ids.push(id);
      // Its shown children (an open row's, its own row may be evicted).
      for (const node of subtrees[byId.get(id) ?? -1]?.nodes ?? []) {
        if (node.entry) ids.push(node.entry.id);
      }
    }
    return ids;
  }

  /** Top-level rows: the cache's state; placeholders: their parent's children's state. */
  stateAt(index: number): RowState {
    const { top, node } = this.#at(index);
    return top === undefined ? (node?.state ?? 'loading') : this.cache.stateAt(top);
  }

  /** Where a loaded row sits in the tree; `undefined` for rows not loaded and placeholders. */
  treeRow(index: number): TreeRowInfo | undefined {
    const { top, m, node } = this.#at(index);
    if (top !== undefined) {
      const entry = this.cache.entryAt(top);
      if (!entry) return undefined;
      const hasChildren = this.#hasEntry(entry) && !this.#empty(entry.id);
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

  /**
   * The depth of the row at a shown index: `0` for top-level rows (loaded or not),
   * the parent's depth plus one for children and placeholders; `undefined` out of range.
   */
  depthAt(index: number): number | undefined {
    const { top, node } = this.#at(index);
    return top === undefined ? node?.depth : 0;
  }

  /** Whether a row can open: loaded, `hasChildren`, and not known to have no children. */
  canExpand(rowId: string): boolean {
    return !this.#empty(rowId) && this.#has(rowId) === true;
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

  /** The rows arrange themselves: the model reads them through this tree. */
  readonly structure: RowStructure = this;

  readonly tree: boolean = true;

  idAt(index: number): string | undefined {
    return this.entryAt(index)?.id;
  }

  /** A loaded row's parent from its place in the tree; a placeholder's from its parent's id. */
  parentAt(index: number): number | undefined {
    const info = this.treeRow(index);
    if (info) return info.parent;
    const parentId = this.parentIdAt(index);
    return parentId === undefined ? undefined : this.shownIndexOf(parentId);
  }

  toggleId(index: number): string | undefined {
    // Rows are never `forced` here: the server filters.
    return this.treeRow(index) ? this.idAt(index) : undefined;
  }

  /** Closing needs no loaded row: an open id may be under a page not loaded. */
  mayToggle(rowId: string, open: boolean): boolean {
    return !open || this.canExpand(rowId);
  }

  forestRow(index: number): number | undefined {
    return this.forest().at(index);
  }

  /**
   * Shown indexes move as rows load above (an open row's loading rows appear
   * when its page loads), so a stand-in names what doesn't move: a top-level
   * row's top-level index (`\u0000t…`), or a loading or failed child row's
   * parent and its place among the rows under it (`\u0000c…`).
   */
  standInId(index: number): string {
    const top = this.topIndexOf(index);
    if (top !== undefined) return `\u0000t${String(top)}`;
    const parentId = this.parentIdAt(index);
    const parent = parentId === undefined ? undefined : this.shownIndexOf(parentId);
    if (parent !== undefined) return `\u0000c${String(index - parent - 1)}\u0000${parentId ?? ''}`;
    return plainStandInId(index, true);
  }

  /**
   * A child row's stand-in whose row is gone gives its parent (its children came
   * back fewer, or it collapsed) or the parent's nearest shown ancestor.
   */
  standIn(id: string): StandIn | undefined {
    if (id.startsWith('\u0000t')) {
      const top = /^\d+$/.test(id.slice(2)) ? Number(id.slice(2)) : undefined;
      const index = top === undefined ? undefined : this.positionOfTop(top);
      return index === undefined ? undefined : { index, same: true, moves: true };
    }
    if (id.startsWith('\u0000c')) {
      const sep = id.indexOf('\u0000', 2);
      const offset = Number(id.slice(2, sep));
      const parentId = id.slice(sep + 1);
      const parent = this.shownIndexOf(parentId);
      if (parent === undefined) {
        const ancestor = this.shownAncestor(parentId);
        return ancestor === undefined ? undefined : { index: ancestor, same: false, moves: true };
      }
      // Still a row right under the parent (loading, failed, or its child once loaded).
      const at = parent + 1 + offset;
      if (this.parentIdAt(at) === parentId) return { index: at, same: true, moves: true };
      return { index: parent, same: false, moves: true };
    }
    return plainStandIn(id, true);
  }

  /** The top-level index at a shown index, or `undefined` for a descendant (or out of range). */
  topIndexOf(position: number): number | undefined {
    return this.#at(position).top;
  }

  /**
   * The shown index of a top-level row by its (whole) top-level index, loaded or
   * not (the inverse of `topIndexOf`); `undefined` past the top-level rows.
   */
  positionOfTop(top: number): number | undefined {
    if (top < 0 || top >= this.cache.rowCount) return undefined;
    return this.#positionOfTop(top);
  }

  /** The top-level rows the shown range [start, end) covers (whole indexes), for `getRows` paging. */
  topRange(start: number, end: number): { start: number; end: number } {
    const count = this.rowCount;
    const from = Math.max(0, Math.min(start, count));
    const to = Math.max(0, Math.min(end, count));
    const first = from < count ? this.#topOrRoot(from) : this.cache.rowCount;
    if (to <= from) return { start: first, end: first };
    return { start: first, end: this.#topOrRoot(to - 1) + 1 };
  }

  /** For a loaded child or a placeholder: its parent's id. */
  parentIdAt(index: number): string | undefined {
    return this.#at(index).node?.parentId;
  }

  /** The expanded ids (`treeExpanded`). Ids of rows not loaded yet open once they load. */
  setExpanded(ids: TreeExpandedState): void {
    const next = new Set(ids);
    const old = this.#expanded;
    if (next.size === old.size && [...next].every((id) => old.has(id))) return;
    for (const id of next) if (!old.has(id)) this.#expansionChanged(id);
    for (const id of old) {
      if (next.has(id)) continue;
      this.#expansionChanged(id);
      // Failed children load again on the next expand, like a failed page scrolled back to.
      this.forget(id, 'error');
    }
    this.#expanded = next;
    this.#version++;
  }

  /**
   * Ids of open, loaded parents shown whose children are neither loaded nor
   * loading nor failed: to request. A new array whenever the tree changes.
   */
  get wanted(): readonly string[] {
    return this.#ensure().wanted;
  }

  /**
   * The shown index of a row, loaded or not: `indexOf`, or for an open top-level
   * row whose page was evicted (shown as a skeleton), its index from when it was
   * loaded. `undefined` when it isn't shown.
   */
  shownIndexOf(rowId: string): number | undefined {
    const index = this.indexOf(rowId);
    if (index !== undefined || this.#known.has(rowId)) return index;
    const top = this.#topIndex(rowId);
    return top === undefined ? undefined : this.#positionOfTop(top);
  }

  /** Marks a parent's children (one `wanted` lists) as in flight. */
  beginChildren(parentId: string): void {
    this.#children.set(parentId, { state: 'loading' });
    this.#changed(parentId);
  }

  /**
   * Stores a parent's children. Ignored (`false`) unless they are in flight. There
   * is no request token: the caller ignores answers to requests it aborted.
   */
  resolveChildren(parentId: string, rows: readonly TData[]): boolean {
    const record = this.#children.get(parentId);
    if (record?.state !== 'loading') return false;
    const getRowId = this.#getRowId;
    const entries = rows.map((row, i) => ({
      id: getRowId ? getRowId(row, i) : `${parentId}.${String(i)}`,
      row,
    }));
    for (const entry of entries) {
      if (this.cache.indexOf(entry.id) !== undefined || this.#known.has(entry.id)) {
        this.#warn?.(
          `argus-table: row id "${entry.id}" is used by more than one row; ids must be unique across levels of a tree.`,
        );
      }
      this.#known.set(entry.id, { entry, parentId, has: this.#hasChildren(entry.row) });
    }
    this.#children.set(parentId, { state: 'loaded', entries });
    this.#kept.delete(parentId);
    this.#changed(parentId);
    return true;
  }

  /**
   * The loaded rows as a forest, for branch selection: the loaded top-level
   * rows (and open ones whose page was evicted, with their children) in order,
   * each followed by its loaded descendants depth first, collapsed or not. A
   * row whose children aren't loaded is a leaf. Every row it holds is kept
   * (the server filters). With `filtered`, each row with children (by
   * `hasChildren`) also gets one hidden child, which isn't in the layout and is
   * never selected: its id then never stands for its whole branch, which the
   * server may not have sent (ticking it selects the rows shown under it, and
   * one without loaded children can't be ticked). Built once per `version`,
   * O(loaded rows); its shown rows are its `order`'s positions.
   */
  forest(): RemoteForest {
    const version = this.version;
    if (this.#forest?.version === version) return this.#forest.forest;
    // Depth first, each row numbered as it's reached, so its rows are already
    // in layout order: the layout is that of a tree sorted that way.
    const ids: string[] = [];
    const rows = new Map<string, number>();
    const parent: number[] = [];
    // Under a server filter, rows with children: each gets a hidden child.
    const hiding: number[] = [];
    const stack: { id: string; up: number }[] = [];
    const roots = this.#roots().filter(
      ([id, loaded]) => loaded || this.#children.get(id)?.state === 'loaded',
    );
    for (let k = roots.length - 1; k >= 0; k--) stack.push({ id: roots[k]?.[0] ?? '', up: -1 });
    for (let item = stack.pop(); item; item = stack.pop()) {
      // An id used twice (warned about when its children arrived) is placed once.
      if (rows.has(item.id)) continue;
      const row = ids.length;
      rows.set(item.id, row);
      ids.push(item.id);
      parent.push(item.up);
      // An evicted root has children (`undefined`: not loaded).
      if (this.#filtered && this.#has(item.id) !== false) hiding.push(row);
      const record = this.#children.get(item.id);
      const entries = record?.state === 'loaded' ? record.entries : [];
      for (let k = entries.length - 1; k >= 0; k--) {
        stack.push({ id: entries[k]?.id ?? '', up: row });
      }
    }
    const shown = ids.map((_, row) => row);
    // Hidden children after the rows, out of the layout: never selected, they
    // keep their parents' ids out, as rows a client filter hides do.
    for (const row of hiding) {
      parent.push(row);
      ids.push(`\u0000${ids[row] ?? ''}`);
    }
    const tree = { ids, rows: ids, parent: Int32Array.from(parent) };
    const layout = layoutTree(tree, shown);
    const childCount = Int32Array.from(layout.keptChildren);
    for (const row of hiding) childCount[row] = (childCount[row] ?? 0) + 1;
    const forest: RemoteForest = {
      tree: { ...tree, childCount, indexOf: (id) => rows.get(id) },
      layout,
      at: (index) => {
        const id = this.entryAt(index)?.id;
        return id === undefined ? undefined : rows.get(id);
      },
    };
    this.#forest = { version, forest };
    return forest;
  }

  /**
   * Marks in-flight children as failed: one error row shows under the parent.
   * When the parent was collapsed meanwhile, forgets the request instead, so the
   * next expand loads again. Returns whether the error shows (to report it).
   */
  failChildren(parentId: string): boolean {
    const record = this.#children.get(parentId);
    if (record?.state !== 'loading') return false;
    this.#kept.delete(parentId);
    const shown = this.#expanded.has(parentId);
    if (shown) this.#children.set(parentId, { state: 'error' });
    else this.#children.delete(parentId);
    this.#changed(parentId);
    return shown;
  }

  /**
   * Forgets a parent's children while in `state`, so `wanted` lists them again:
   * failed ones (Retry), or in-flight ones whose request was aborted. Returns
   * whether they were in that state.
   */
  forget(parentId: string, state: 'loading' | 'error'): boolean {
    if (this.#children.get(parentId)?.state !== state) return false;
    this.#children.delete(parentId);
    this.#changed(parentId);
    return true;
  }

  /**
   * The number of rows shown under each shown open parent (its children and
   * theirs, all of its shown subtree), for the next tree (`keepCounts`); with
   * `keepIndex` (after `refresh()`), with the top-level index of top-level parents.
   */
  counts(keepIndex: boolean): ReadonlyMap<string, KeptCount> {
    const index = this.#ensure();
    const counts = new Map<string, KeptCount>();
    for (const id of this.#expanded) {
      const known = this.#known.get(id);
      if (known) {
        const count = known.has ? this.#shownUnder(index, id) : undefined;
        if (count !== undefined) counts.set(id, { count });
        continue;
      }
      const top = this.#topIndex(id);
      if (top === undefined) continue;
      // Not in `byId`: nothing shows under it.
      const count = index.subtrees[index.byId.get(id) ?? -1]?.nodes.length ?? 0;
      counts.set(id, { index: keepIndex ? top : undefined, count });
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

  /**
   * The top-level rows in order: the loaded ones (`true`), and the open ones
   * whose page was evicted (`false`), whose children stay.
   */
  #roots(): [id: string, loaded: boolean][] {
    this.#ensure();
    const cache = this.cache;
    const evicted = this.#sorted.filter(({ id }) => cache.indexOf(id) === undefined);
    const roots: [string, boolean][] = [];
    let e = 0;
    const flush = (below: number) => {
      for (; e < evicted.length && (evicted[e]?.top ?? 0) < below; e++) {
        roots.push([evicted[e]?.id ?? '', false]);
      }
    };
    for (const id of cache.loadedIds()) {
      flush(cache.indexOf(id) ?? 0);
      roots.push([id, true]);
    }
    flush(Infinity);
    return roots;
  }

  /** Whether a loaded row has children on the server (`hasChildren`); `undefined` when it isn't loaded. */
  #has(id: string): boolean | undefined {
    const known = this.#known.get(id);
    if (known) return known.has;
    const top = this.cache.indexOf(id);
    const entry = top === undefined ? undefined : this.cache.entryAt(top);
    return entry && this.#hasEntry(entry);
  }

  #hasEntry(entry: CachedRow<TData>): boolean {
    let has = this.#hasTop.get(entry);
    if (has === undefined) this.#hasTop.set(entry, (has = this.#hasChildren(entry.row)));
    return has;
  }

  /** Rows shown under a shown child row (its open subtree); `undefined` when it isn't shown. */
  #shownUnder(index: OpenIndex<TData>, id: string): number | undefined {
    const where = this.#where.get(id);
    const m = where === undefined ? undefined : index.byId.get(where.root);
    const nodes = m === undefined ? undefined : index.subtrees[m]?.nodes;
    const node = where === undefined ? undefined : nodes?.[where.local];
    if (!nodes || !where || node?.entry?.id !== id) return undefined;
    if (!node.open) return 0;
    let end = where.local + 1;
    while (end < nodes.length && (nodes[end]?.depth ?? 0) > node.depth) end++;
    return end - where.local - 1;
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
    return this.#kept.get(parentId)?.count ?? 1;
  }

  #changed(parentId: string): void {
    const root = this.#rootOf(parentId);
    this.#dirty.add(root);
    // Where a loaded top-level row is now, so it stays open if its page is evicted before the next read.
    this.#topIndex(root);
    this.#version++;
  }

  #expansionChanged(id: string): void {
    // A top-level row's own expansion changes only the index, not its subtree.
    const root = this.#rootOf(id);
    if (root !== id) this.#dirty.add(root);
    this.#topIndex(root);
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
    this.#sorted = found.sort((a, b) => a.top - b.top);

    const index: OpenIndex<TData> = {
      tops: [],
      subtrees: [],
      before: [0],
      byId: new Map(),
      wanted: [],
    };
    let total = 0;
    for (const { top, id } of this.#sorted) {
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

  /**
   * The number of open rows, from the first, that `test` holds for (given the
   * row's top-level index and the descendants shown above it): it holds for a
   * prefix of them. A binary search.
   */
  #openWhile(test: (top: number, before: number) => boolean): number {
    const { tops, before } = this.#ensure();
    let low = 0;
    let high = tops.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (test(tops[mid] ?? 0, before[mid] ?? 0)) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  #positionOfTop(top: number): number {
    const m = this.#openWhile((at) => at < top);
    return top + (this.#index.before[m] ?? 0);
  }

  /** The shown index of open row `m`. */
  #positionOfOpen(m: number): number {
    const index = this.#ensure();
    return (index.tops[m] ?? 0) + (index.before[m] ?? 0);
  }

  /** The last open row shown above a shown index, or `-1`. */
  #openAbove(position: number): number {
    return this.#openWhile((top, before) => top + before < position) - 1;
  }

  /**
   * Where a shown index is: a top-level index (`top`), or a descendant (`node`)
   * of open row `m` (the last one above it); neither out of range.
   */
  #at(position: number): At<TData> {
    const version = this.version;
    const last = this.#last;
    if (last?.position === position && last.version === version) return last;
    const inRange = Number.isInteger(position) && position >= 0 && position < this.rowCount;
    const m = this.#openAbove(position);
    const node = inRange
      ? this.#index.subtrees[m]?.nodes[position - this.#positionOfOpen(m) - 1]
      : undefined;
    const top = inRange && !node ? position - (this.#index.before[m + 1] ?? 0) : undefined;
    return (this.#last = { position, version, top, m, node });
  }

  /** The top-level index at a shown index, or its top-level ancestor's for a descendant. */
  #topOrRoot(position: number): number {
    const { top, m } = this.#at(position);
    return top ?? this.#index.tops[m] ?? 0;
  }
}

/**
 * Whether two listings of one top-level row's descendants are the same. Listed
 * depth first, every child of a parent in a row, so the depths and entries give
 * the rest: a node's parent is the nearest node above it one level up (or the
 * top-level row), its set the nodes under that parent.
 */
function sameNodes<TData>(a: readonly Node<TData>[], b: readonly Node<TData>[]): boolean {
  return (
    a.length === b.length &&
    a.every((node, i) => {
      const other = b[i];
      return (
        other !== undefined &&
        node.entry === other.entry &&
        node.state === other.state &&
        node.depth === other.depth &&
        node.hasChildren === other.hasChildren &&
        node.open === other.open
      );
    })
  );
}
