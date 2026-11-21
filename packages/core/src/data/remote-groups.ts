import type { RemoteForest, RemoteRows, TreeRowInfo } from '../table/model-types.js';
import { GROUP_ID_PREFIX, groupId, groupingKey, isGroupId } from '../table/group-rows.js';
import type { RowStructure, StandIn } from '../table/row-structure.js';
import { remoteForest } from './forest.js';
import type { GroupData, GroupPathItem, GroupRowInfo, TreeExpandedState } from '../types.js';
import { PageCache, type CachedRow, type RowState } from './page-cache.js';

export interface RemoteGroupsOptions<TData> {
  /** The columns the server groups by, outermost first (non-empty). */
  grouping: readonly string[];
  pageSize: number;
  /** Data rows' ids, given the index among the group's rows; else the group's id, a dot and that index. */
  getRowId?: ((row: TData, index: number) => string) | undefined;
  /** The open groups' ids (`treeExpanded`). */
  expanded?: TreeExpandedState | undefined;
}

/** One level of rows being filled: the top-level groups, or an open group's groups or rows. */
export interface GroupLevel {
  /** `''` for the top-level groups, else the open group's id. */
  readonly key: string;
  /** The open group's path, for `getRows` (`[]` for the top level). */
  readonly path: readonly GroupPathItem[];
  /** Whether the level's rows are groups (else data rows). */
  readonly groups: boolean;
}

interface Level extends GroupLevel {
  /** The depth of the level's rows: `0` for the top-level groups. */
  readonly depth: number;
  readonly cache: PageCache<unknown>;
  /** The parent level's key and the open group's index in it; `undefined` for the top level. */
  readonly parent: string | undefined;
  /** The open group's index in its parent level: found again when its row loads elsewhere. */
  at: number;
}

/** A level as shown: its open child levels and where its rows are. */
interface Node {
  level: Level;
  /** Open child levels shown, by their index in this level. */
  open: Node[];
  /** Rows shown under the open child levels before each one (`before[m]`), and in all (`before[open.length]`). */
  before: number[];
  /** Rows shown: the level's rows and its open levels' rows. */
  size: number;
  /** The shown index of the level's first row. */
  start: number;
}

/** Where a shown index is: a level and an index among its rows. */
interface At {
  position: number;
  version: number;
  node: Node | undefined;
  index: number;
}

const STAND_IN = '\u0000s';

/**
 * A data source's rows grouped on the server (`grouping`): one `PageCache` per
 * level shown, the top-level groups and each open group's groups or rows, all
 * loaded page by page. Shown indexes go through the open levels' sizes, level by
 * level (binary search, rebuilt once per version). It is the model's `remote`
 * and its `RowStructure`: group rows have no row object (`entryAt`), their ids
 * are `groupId` paths, open groups are `treeExpanded`'s ids. Every change of a
 * level's cache goes through this class (`resolve`, `fail`, `evict` …), which
 * keeps the version. Closing a group drops its level.
 */
export class RemoteGroups<TData> implements RemoteRows<TData>, RowStructure {
  readonly root: PageCache<unknown>;
  readonly structure: RowStructure = this;
  readonly tree: boolean = true;
  readonly grouped: boolean = true;
  readonly #grouping: readonly string[];
  readonly #pageSize: number;
  readonly #getRowId: ((row: TData, index: number) => string) | undefined;
  #expanded: ReadonlySet<string>;
  readonly #levels = new Map<string, Level>();
  #version = 0;
  #built = -1;
  #nodes = new Map<string, Node>();
  #layout = '';
  #order: object = Object.freeze({});
  #last: At | undefined;
  /** The loaded rows of the levels the last `setExpanded` closed, by their group's id. */
  #dropped = new Map<string, string>();
  /** The forest, and the loaded data rows' ids in row order, per version. */
  #forest: { version: number; forest: RemoteForest; data: string[] } | undefined;

  constructor(options: RemoteGroupsOptions<TData>) {
    this.#grouping = options.grouping;
    this.#pageSize = options.pageSize;
    this.#getRowId = options.getRowId;
    this.#expanded = new Set(options.expanded);
    const root = this.#level('', [], -1, undefined, 0, undefined);
    this.root = root.cache;
  }

  get version(): number {
    return this.#version;
  }

  get rowCount(): number {
    return this.#ensure().get('')?.size ?? 0;
  }

  /** A new object when loaded rows change position: a group opened or closed, a level's size changed. */
  get order(): object {
    this.#ensure();
    return this.#order;
  }

  /** The open groups' ids. Opening one shows its level once its group row has loaded. */
  setExpanded(ids: TreeExpandedState): void {
    const next = new Set(ids);
    const old = this.#expanded;
    if (next.size === old.size && [...next].every((id) => old.has(id))) return;
    this.#expanded = next;
    // A closed group's level goes, and the levels inside it; their loaded rows
    // remember their group, so an active cell there finds it (`shownAncestor`).
    this.#dropped = new Map();
    for (const [key, level] of [...this.#levels]) {
      if (key === '' || this.#shownLevel(key)) continue;
      for (const id of level.cache.loadedIds()) this.#dropped.set(id, key);
      this.#levels.delete(key);
    }
    this.#version++;
  }

  /** The levels being shown (the top level first). */
  levels(): readonly GroupLevel[] {
    this.#ensure();
    return [...this.#levels.values()];
  }

  /** Each level the shown range touches, once, with the rows of it the range covers. */
  ranges(start: number, end: number): { level: GroupLevel; start: number; end: number }[] {
    const out: { level: GroupLevel; start: number; end: number }[] = [];
    const root = this.#ensure().get('');
    if (root && end > start) this.#rangesIn(root, Math.max(0, start), end, out);
    return out;
  }

  /**
   * A level's page cache while the level is shown: for paging requests
   * (`missingPages`, `begin`, `inFlightOutside`, `cancel`, `fail`). Stores go
   * through `resolve`, and a closed level's cache is `undefined`.
   */
  cacheOf(level: GroupLevel): PageCache<unknown> | undefined {
    return this.#current(level)?.cache;
  }

  /**
   * Stores a page's answer: groups at a level of groups, rows at the deepest.
   * `'wrong'` for an answer of the other kind (nothing stored: fail the page),
   * `'stale'` for a level closed or a page no longer asked for.
   */
  resolve(
    level: GroupLevel,
    page: number,
    response: { rows?: unknown; groups?: unknown; total?: unknown },
  ): 'stored' | 'stale' | 'wrong' {
    const current = this.#current(level);
    if (!current) return 'stale';
    const list = current.groups ? response.groups : response.rows;
    // Groups at the deepest level, or a group without its count, are the wrong kind.
    const other = (current.groups ? list : response.groups) as (GroupData | null)[] | undefined;
    if (
      !Array.isArray(list) ||
      (current.groups ? other?.some((group) => typeof group?.count !== 'number') : other?.length)
    ) {
      return 'wrong';
    }
    const { total } = response;
    if (!current.cache.resolve(page, list, typeof total === 'number' ? total : undefined)) {
      return 'stale';
    }
    this.#version++;
    return 'stored';
  }

  /** Lets the failed page of the row at a shown index load again; `false` when it didn't fail. */
  retry(index: number): boolean {
    const { node, index: i } = this.#at(index);
    const cache = node?.level.cache;
    const page = cache?.pageOf(i) ?? 0;
    if (!cache?.isFailed(page)) return false;
    cache.retry(page);
    this.#version++;
    return true;
  }

  /**
   * Drops pages far from the shown range: in the levels it touches, more than
   * `KEEP_PAGES` pages from what it covers; in the others, all but the pages at
   * their end nearest to it.
   */
  evict(start: number, end: number): void {
    const covered = new Map(this.ranges(start, end).map((r) => [r.level.key, r]));
    let dropped = false;
    for (const node of this.#ensure().values()) {
      const { cache, key } = node.level;
      const before = cache.version;
      const range = covered.get(key);
      if (range) cache.evictOutside(range.start, range.end);
      else if (node.start + node.size <= start) cache.evictOutside(cache.rowCount, cache.rowCount);
      else cache.evictOutside(0, 0);
      dropped ||= cache.version !== before;
    }
    if (dropped) this.#version++;
  }

  /** The shown rows of a level's page, `start` to `end` (exclusive). */
  span(level: GroupLevel, page: number): { start: number; end: number } {
    const node = this.#ensure().get(level.key);
    if (!node) return { start: -1, end: 0 };
    const { cache } = node.level;
    const first = page * cache.pageSize;
    const last = Math.min(first + cache.pageSize, cache.rowCount) - 1;
    return { start: this.#position(node, first), end: this.#position(node, last) + 1 };
  }

  /** The page holding a shown index: a key per level and page, and its shown rows. */
  pageSpan(index: number): { key: string; start: number; end: number } | undefined {
    const { node, index: i } = this.#at(index);
    if (!node) return undefined;
    const page = node.level.cache.pageOf(i);
    return { key: `${node.level.key}\u0001${String(page)}`, ...this.span(node.level, page) };
  }

  // RemoteRows

  /** Data rows only: a group row has no row object. */
  entryAt(index: number): CachedRow<TData> | undefined {
    const { node, index: i } = this.#at(index);
    if (!node || node.level.groups) return undefined;
    return node.level.cache.entryAt(i) as CachedRow<TData> | undefined;
  }

  indexOf(rowId: string): number | undefined {
    for (const node of this.#ensure().values()) {
      const i = node.level.cache.indexOf(rowId);
      if (i !== undefined) return this.#position(node, i);
    }
    return undefined;
  }

  /** The loaded data rows' ids, in row order. */
  loadedIds(): string[] {
    this.forest();
    return this.#forest?.data ?? [];
  }

  stateAt(index: number): RowState {
    const { node, index: i } = this.#at(index);
    return node?.level.cache.stateAt(i) ?? 'loading';
  }

  // RowStructure

  idAt(index: number): string | undefined {
    const { node, index: i } = this.#at(index);
    return node?.level.cache.entryAt(i)?.id;
  }

  groupAt(index: number): GroupRowInfo | undefined {
    const { node, index: i } = this.#at(index);
    const level = node?.level;
    const entry = level?.groups ? level.cache.entryAt(i) : undefined;
    if (!level || !entry) return undefined;
    const group = entry.row as GroupData;
    return {
      rowId: entry.id,
      groupColumnId: this.#grouping[level.depth] ?? '',
      value: groupingKey(group.value) === null ? undefined : group.value,
      count: group.count,
      depth: level.depth,
      totals: group.totals ?? {},
    };
  }

  /** Rows not loaded hold their place by their level and index there. */
  standInId(index: number): string {
    const { node, index: i } = this.#at(index);
    return `${STAND_IN}${String(i)}\u0000${node?.level.key ?? ''}`;
  }

  /** A closed level gives its group row (or its nearest shown ancestor). */
  standIn(id: string): StandIn | undefined {
    if (!id.startsWith(STAND_IN)) return undefined;
    const split = id.indexOf('\u0000', STAND_IN.length);
    const i = Number(id.slice(STAND_IN.length, split));
    const key = id.slice(split + 1);
    const node = this.#ensure().get(key);
    // Not a number (a malformed id): no row.
    if (node && i < node.level.cache.rowCount) {
      return { index: this.#position(node, i), same: true, moves: true };
    }
    const index = key === '' ? undefined : this.shownAncestor(key);
    return index === undefined ? undefined : { index, same: false, moves: true };
  }

  parentAt(index: number): number | undefined {
    const { node } = this.#at(index);
    return node && node.level.key !== '' ? node.start - 1 : undefined;
  }

  treeRow(index: number): TreeRowInfo | undefined {
    const { node, index: i } = this.#at(index);
    const level = node?.level;
    const entry = level?.cache.entryAt(i);
    if (!node || !level || !entry) return undefined;
    const hasChildren = level.groups && (entry.row as GroupData).count > 0;
    const { cache } = level;
    return {
      depth: level.depth,
      hasChildren,
      open: hasChildren && this.#expanded.has(entry.id),
      forced: false,
      parent: level.key === '' ? undefined : node.start - 1,
      setSize: cache.totalKnown ? cache.rowCount : -1,
      posInSet: i + 1,
    };
  }

  depthAt(index: number): number | undefined {
    return this.#at(index).node?.level.depth;
  }

  toggleId(index: number): string | undefined {
    return this.treeRow(index)?.hasChildren ? this.idAt(index) : undefined;
  }

  /** Closing needs no loaded row; any group id may open (it shows once its row loads). */
  mayToggle(rowId: string, open: boolean): boolean {
    return !open || isGroupId(rowId);
  }

  shownAncestor(rowId: string): number | undefined {
    let id: string | undefined = rowId;
    while (id !== undefined) {
      const index = this.indexOf(id);
      if (index !== undefined) return index;
      id = this.#parentOf(id);
    }
    return undefined;
  }

  /**
   * The loaded rows as a forest, for branch selection: depth first, every group
   * with one hidden child that is never selected, so a group's id never stands
   * for its rows (it holds rows the server hasn't sent). Built once per version.
   */
  forest(): RemoteForest {
    const version = this.version;
    if (this.#forest?.version === version) return this.#forest.forest;
    const nodes = this.#ensure();
    const ids: string[] = [];
    const parent: number[] = [];
    const groups: number[] = [];
    const data: string[] = [];
    const walk = (node: Node, up: number) => {
      const { cache, groups: grouped } = node.level;
      for (const id of cache.loadedIds()) {
        const row = ids.length;
        ids.push(id);
        parent.push(up);
        if (!grouped) {
          data.push(id);
          continue;
        }
        groups.push(row);
        const child = nodes.get(id);
        if (child) walk(child, row);
      }
    };
    const root = nodes.get('');
    if (root) walk(root, -1);
    const forest = remoteForest(ids, parent, groups, (index) => this.idAt(index));
    this.#forest = { version, forest, data };
    return forest;
  }

  forestRow(index: number): number | undefined {
    return this.forest().at(index);
  }

  // Inside

  #level(
    key: string,
    path: readonly GroupPathItem[],
    depth: number,
    parent: string | undefined,
    at: number,
    count: number | undefined,
  ): Level {
    const rowsDepth = depth + 1;
    const groups = rowsDepth < this.#grouping.length;
    const column = this.#grouping[rowsDepth] ?? '';
    const getRowId = this.#getRowId;
    const cache = groups
      ? new PageCache<unknown>({
          pageSize: this.#pageSize,
          rowCount: 1,
          getRowId: (group) =>
            groupId([
              ...path.flatMap((p) => [p.columnId, groupingKey(p.value)]),
              column,
              groupingKey((group as GroupData | null)?.value),
            ]),
        })
      : new PageCache<unknown>({
          pageSize: this.#pageSize,
          rowCount: count ?? 0,
          totalKnown: true,
          getRowId: (row, i) => (getRowId ? getRowId(row as TData, i) : `${key}.${String(i)}`),
        });
    const level: Level = { key, path, depth: rowsDepth, groups, cache, parent, at };
    this.#levels.set(key, level);
    return level;
  }

  /** The level still shown under a key: closed levels' answers are dropped. */
  #current(level: GroupLevel): Level | undefined {
    const current = this.#levels.get(level.key);
    return current === level ? current : undefined;
  }

  /** Whether a level's group and every group above it are open. */
  #shownLevel(key: string): boolean {
    for (let k: string | undefined = key; k !== '';) {
      const level: Level | undefined = k === undefined ? undefined : this.#levels.get(k);
      if (!level || !this.#expanded.has(level.key)) return false;
      k = level.parent;
    }
    return true;
  }

  /** The parent of a row: a group's from its path, a loaded data row's from its level. */
  #parentOf(id: string): string | undefined {
    if (isGroupId(id)) {
      const path = JSON.parse(id.slice(GROUP_ID_PREFIX.length)) as unknown[];
      return path.length > 2 ? groupId(path.slice(0, -2)) : undefined;
    }
    for (const level of this.#levels.values()) {
      if (!level.groups && level.cache.indexOf(id) !== undefined) return level.key;
    }
    return this.#dropped.get(id);
  }

  /** Opens the levels of open groups whose rows have loaded, and lays out the shown levels. */
  #ensure(): Map<string, Node> {
    if (this.#built === this.#version) return this.#nodes;
    this.#built = this.#version;
    const nodes = new Map<string, Node>();
    const build = (level: Level, start: number): Node => {
      const { cache } = level;
      // An id the server sent twice (groups whose values share a key) opens once.
      const children = new Set<Level>();
      if (level.groups) {
        for (const id of cache.loadedIds()) {
          if (!this.#expanded.has(id)) continue;
          const at = cache.indexOf(id) ?? 0;
          const group = cache.entryAt(at)?.row as GroupData;
          const column = this.#grouping[level.depth] ?? '';
          const open = this.#levels.get(id);
          if (open) open.at = at;
          children.add(
            open ??
              this.#level(
                id,
                [...level.path, { columnId: column, value: group.value }],
                level.depth,
                level.key,
                at,
                group.count,
              ),
          );
        }
        // Open levels whose group row was evicted keep their place, unless
        // another group has loaded there.
        for (const other of this.#levels.values()) {
          if (other.parent === level.key && cache.entryAt(other.at) === undefined) {
            children.add(other);
          }
        }
      }
      const shown = [...children]
        .filter((c) => c.at < cache.rowCount && this.#expanded.has(c.key))
        .sort((a, b) => a.at - b.at);
      const node: Node = { level, open: [], before: [0], size: cache.rowCount, start };
      nodes.set(level.key, node);
      let below = 0;
      for (const child of shown) {
        const childNode = build(child, start + child.at + below + 1);
        node.open.push(childNode);
        below += childNode.size;
        node.before.push(below);
      }
      node.size += below;
      return node;
    };
    const root = this.#levels.get('');
    if (root) build(root, 0);
    this.#nodes = nodes;
    const layout = JSON.stringify([...nodes.values()].map((n) => [n.level.key, n.start, n.size]));
    if (layout !== this.#layout) {
      this.#layout = layout;
      this.#order = Object.freeze({});
    }
    return nodes;
  }

  /** The level and index of a shown index, remembered for the next call (a row's cells). */
  #at(position: number): At {
    const version = this.#version;
    const last = this.#last;
    if (last?.position === position && last.version === version) return last;
    const root = this.#ensure().get('');
    let node: Node | undefined;
    let index = -1;
    if (root && Number.isInteger(position) && position >= 0 && position < root.size) {
      // `r` counts a level's shown rows; an open level's group row is at
      // `at + before[m]`, and its rows follow it.
      let r = position;
      let current: Node = root;
      for (;;) {
        const m = this.#openAbove(current, r);
        const child: Node | undefined = current.open[m];
        const row = child ? child.level.at + (current.before[m] ?? 0) : 0;
        if (!child || r > row + child.size) {
          index = r - (current.before[m + 1] ?? 0);
          break;
        }
        r -= row + 1;
        current = child;
      }
      node = current;
    }
    return (this.#last = { position, version, node, index });
  }

  /** The last open level whose group row is above shown row `r` of a node, or `-1`. */
  #openAbove(node: Node, r: number): number {
    return this.#openWhile(node, (at, before) => at + before < r) - 1;
  }

  /** How many of a node's open levels, from the first, `test` holds for (a prefix): a binary search. */
  #openWhile(node: Node, test: (at: number, before: number) => boolean): number {
    const { open, before } = node;
    let low = 0;
    let high = open.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (test(open[mid]?.level.at ?? 0, before[mid] ?? 0)) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  /** The shown index of a level's row. */
  #position(node: Node, i: number): number {
    return node.start + i + (node.before[this.#openWhile(node, (at) => at < i)] ?? 0);
  }

  /** The level ranges a shown range covers in a level and the open levels under it. */
  #rangesIn(
    node: Node,
    start: number,
    end: number,
    out: { level: GroupLevel; start: number; end: number }[],
  ): void {
    const from = Math.max(start, node.start);
    const to = Math.min(end, node.start + node.size);
    if (from >= to) return;
    out.push({
      level: node.level,
      start: this.#localAt(node, from),
      end: this.#localAt(node, to - 1) + 1,
    });
    for (const child of node.open) this.#rangesIn(child, from, to, out);
  }

  /** The index in a level of the row at a shown index, or of its group row in that level. */
  #localAt(node: Node, position: number): number {
    const r = position - node.start;
    const m = this.#openAbove(node, r);
    const child = node.open[m];
    if (child && r <= child.level.at + (node.before[m] ?? 0) + child.size) return child.level.at;
    return r - (node.before[m + 1] ?? 0);
  }
}
