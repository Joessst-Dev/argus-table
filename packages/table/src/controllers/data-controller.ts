import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  filtersRows,
  PageCache,
  RemoteGroups,
  RemoteTree,
  type ChildrenRequest,
  type GroupLevel,
  type ColumnFilterState,
  type DataSource,
  type KeptCount,
  type LoadErrorDetail,
  type SortState,
  type TreeExpandedState,
} from '@argus-table/core';

/** Rows per request when the data source sets no `pageSize`. */
export const DEFAULT_PAGE_SIZE = 100;

/** Quiet time after the last range change before pages load, so fast scrolling loads only where it stops. */
export const LOAD_DEBOUNCE_MS = 50;

/** `getChildren` calls in flight at most; the others start as these settle. */
export const MAX_CHILD_REQUESTS = 6;

export interface DataConfig<T> {
  source: DataSource<T> | undefined;
  sorting: SortState;
  filters: ColumnFilterState;
  quickFilter: string;
  getRowId: ((row: T, index: number) => string) | undefined;
  /** The expanded rows, for a source with `hasChildren` and `getChildren`, or its open groups. */
  treeExpanded: TreeExpandedState;
  /** The columns the server groups by (`grouping`'s `groupable` ones, in order); `[]` for none. */
  grouping: readonly string[];
}

/** A page request in flight: how to stop it, and how to forget it in its cache. */
interface Request {
  controller: AbortController;
  cancel: () => void;
}

/** What a reset keeps: the row count and, for a tree, open rows' child counts. */
interface Carry {
  rowCount: number | undefined;
  totalKnown: boolean;
  counts?: ReadonlyMap<string, KeptCount> | undefined;
}

/**
 * Loads `dataSource` pages for the rendered rows (infinite loading). It owns the
 * page cache: a new source, sort order, filter or row id function starts a fresh one, and
 * answers for an old cache are dropped. Requests wait until the range has been
 * quiet for `LOAD_DEBOUNCE_MS`; pages that scrolled away are aborted.
 *
 * With `hasChildren` and `getChildren` the rows form a tree: a `RemoteTree` over
 * the cache, whose indexes are shown indexes (top-level rows and the loaded
 * children of open ones). Pages are requested for the top-level rows the shown
 * range covers, and the children of open, loaded rows with one `getChildren`
 * call per parent (at most `MAX_CHILD_REQUESTS` at a time), aborted on a reset
 * or disconnect (not on collapse).
 *
 * With `grouping` the server groups the rows: a `RemoteGroups` holds a page
 * cache per level shown (top-level groups, and each open group's groups or
 * rows), and each level's pages load for the rendered range, with the level's
 * `groupPath` in the request.
 */
export class DataController<T> implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #arrived: (parentId: string) => void;
  #config: DataConfig<T> = {
    source: undefined,
    sorting: [],
    filters: {},
    quickFilter: '',
    getRowId: undefined,
    treeExpanded: [],
    grouping: [],
  };
  #cache: PageCache<T> | undefined;
  /** The rows as a tree, while the source has `hasChildren` and `getChildren`. */
  #tree: RemoteTree<T> | undefined;
  /** The rows grouped on the server, while `grouping` is set. */
  #groups: RemoteGroups<T> | undefined;
  /** Loads a parent's children, while there is a tree (`getChildrenLoader`). */
  #loadChildren: LoadChildren<T> | undefined;
  /** Pages in flight, by page (by level and page while grouped). */
  readonly #requests = new Map<string, Request>();
  /** In-flight `getChildren` calls, by parent id. */
  readonly #childRequests = new Map<string, AbortController>();
  /** The top-level rows of the rendered range (shown rows while grouped). */
  #range: { start: number; end: number } | undefined;
  /** While grouped: the levels' rows the rendered range covers, as a key to notice a change. */
  #rangesKey = '';
  #timer: ReturnType<typeof setTimeout> | undefined;
  #errors: LoadErrorDetail[] = [];
  /** Whether a row id used twice was reported: once, whatever the resets. */
  #warned = false;
  #warnedGrouping = false;

  /** `arrived`: called with a parent's id when its children arrive. */
  constructor(host: ReactiveControllerHost, arrived: (parentId: string) => void = () => undefined) {
    this.#host = host;
    this.#arrived = arrived;
    host.addController(this);
  }

  hostDisconnected(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#abortAll();
  }

  hostConnected(): void {
    // Requests aborted on disconnect load again on the next range request.
    this.#range = undefined;
    this.#rangesKey = '';
  }

  /**
   * The rows the model reads, while a data source is set: the tree, or the page
   * cache. Indexes are shown indexes.
   */
  get rows(): PageCache<T> | RemoteTree<T> | RemoteGroups<T> | undefined {
    return this.#groups ?? this.#tree ?? this.#cache;
  }

  /** The page cache of the (top-level) rows, while a data source is set. */
  get cache(): PageCache<T> | undefined {
    return this.#cache;
  }

  /**
   * Takes the source, sort order, filters, row id function and expanded rows. A
   * change other than the expanded rows starts a fresh cache: a sort or row id
   * change keeps the row count (the rows are the same) and open rows' child
   * counts, a new source or filter doesn't (the rows aren't).
   */
  configure(next: DataConfig<T>): void {
    const prev = this.#config;
    this.#config = next;
    if (!next.source) {
      this.#reset(undefined);
      return;
    }
    if (
      next.source !== prev.source ||
      !this.#cache ||
      next.filters !== prev.filters ||
      next.quickFilter !== prev.quickFilter ||
      next.grouping.length !== prev.grouping.length ||
      next.grouping.some((id, i) => id !== prev.grouping[i]) ||
      (this.#groups && (next.sorting !== prev.sorting || next.getRowId !== prev.getRowId))
    ) {
      this.#reset({ rowCount: undefined, totalKnown: false });
    } else if (next.sorting !== prev.sorting || next.getRowId !== prev.getRowId) {
      // Other positions: open rows keep their counts once their rows load again.
      this.#reset({
        rowCount: this.#cache.rowCount,
        totalKnown: this.#cache.totalKnown,
        counts: this.#tree?.counts(false),
      });
    }
    this.#tree?.setExpanded(next.treeExpanded);
    this.#groups?.setExpanded(next.treeExpanded);
  }

  /**
   * Drops every loaded page and child rows and loads the rendered ones again. The
   * row count and open rows' child counts stay until the answers.
   */
  refresh(): void {
    if (!this.#cache) return;
    if (this.#groups) {
      this.#reset({ rowCount: undefined, totalKnown: false });
      this.#host.requestUpdate();
      return;
    }
    this.#reset({
      rowCount: this.#cache.rowCount,
      totalKnown: false,
      counts: this.#tree?.counts(true),
    });
    this.#host.requestUpdate();
  }

  /**
   * The page holding the row at a shown index: a key per page (per level and
   * page while grouped) and the shown rows it spans, `start` to `end`
   * (exclusive). `undefined` for a tree's child rows and placeholders (their
   * parent's children fail as a whole), and without a data source.
   */
  pageSpan(index: number): { key: string; start: number; end: number } | undefined {
    const cache = this.#cache;
    if (!cache) return undefined;
    if (this.#groups) return this.#groups.pageSpan(index);
    const tree = this.#tree;
    const top = tree ? tree.topIndexOf(index) : index;
    if (top === undefined) return undefined;
    const page = cache.pageOf(top);
    const first = page * cache.pageSize;
    const last = Math.min(first + cache.pageSize, cache.rowCount);
    // In a tree, open rows above push the page down.
    const shown = (t: number) => (tree ? (tree.positionOfTop(t) ?? tree.rowCount) : t);
    return { key: String(page), start: shown(first), end: shown(last) };
  }

  /**
   * The rendered rows, `start` to `end` (exclusive, shown indexes). Loads what's
   * missing once the range has been quiet for a moment: the pages of the
   * top-level rows they cover, and the children of open rows. Call after every update.
   */
  request(start: number, end: number): void {
    const cache = this.#cache;
    if (!cache) return;
    const groups = this.#groups;
    if (groups) {
      this.#requestGroups(groups, start, end);
      return;
    }
    const tree = this.#tree;
    const range = tree ? tree.topRange(start, end) : { start, end };
    const prev = this.#range;
    const moved = prev?.start !== range.start || prev.end !== range.end;
    this.#range = range;
    if (moved) {
      clearTimeout(this.#timer);
    } else if (
      this.#timer !== undefined ||
      (cache.missingPages(range.start, range.end).length === 0 &&
        (!tree || tree.wanted.length === 0 || this.#childRequests.size >= MAX_CHILD_REQUESTS))
    ) {
      return;
    }
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#load();
    }, LOAD_DEBOUNCE_MS);
  }

  /**
   * Requests the failed rows at a shown index again (the Retry button, or Enter
   * on a failed row): a top-level row's page, or a child row's parent's children.
   */
  retry(index: number): void {
    const cache = this.#cache;
    if (!cache) return;
    if (this.#groups) {
      if (!this.#groups.retry(index)) return;
      this.#range = undefined;
      this.#rangesKey = '';
      this.#host.requestUpdate();
      return;
    }
    const tree = this.#tree;
    const top = tree ? tree.topIndexOf(index) : index;
    if (top === undefined) {
      const parentId = tree?.parentIdAt(index);
      if (parentId === undefined || !tree?.forget(parentId, 'error')) return;
    } else {
      const page = cache.pageOf(top);
      if (!cache.isFailed(page)) return;
      cache.retry(page);
    }
    this.#range = undefined;
    this.#host.requestUpdate();
  }

  /** Load errors since the last call, to fire as `argus-load-error` after the update. */
  takeErrors(): LoadErrorDetail[] {
    const errors = this.#errors;
    this.#errors = [];
    return errors;
  }

  #reset(carry: Carry | undefined): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#abortAll();
    this.#range = undefined;
    this.#rangesKey = '';
    this.#errors = [];
    const { source, getRowId, filters, quickFilter, treeExpanded, grouping } = this.#config;
    const hasChildren = source?.hasChildren?.bind(source);
    this.#loadChildren = source && getChildrenLoader(source);
    const tree = hasChildren !== undefined && this.#loadChildren !== undefined;
    if (tree && grouping.length && !this.#warnedGrouping) {
      this.#warnedGrouping = true;
      console.warn(
        'argus-table: grouping is ignored with a dataSource that has hasChildren and getChildren.',
      );
    }
    this.#groups =
      source && carry && grouping.length && !tree
        ? new RemoteGroups<T>({
            grouping,
            pageSize: source.pageSize ?? DEFAULT_PAGE_SIZE,
            getRowId,
            expanded: treeExpanded,
          })
        : undefined;
    // While grouped, the top-level groups' cache (for paging state).
    this.#cache = this.#groups
      ? (this.#groups.root as PageCache<T>)
      : source && carry
        ? new PageCache<T>({
            pageSize: source.pageSize ?? DEFAULT_PAGE_SIZE,
            getRowId,
            rowCount: carry.rowCount,
            totalKnown: carry.totalKnown,
          })
        : undefined;
    this.#tree =
      this.#cache && !this.#groups && hasChildren && this.#loadChildren
        ? new RemoteTree<T>(this.#cache, {
            hasChildren,
            getRowId,
            keepCounts: carry?.counts,
            warn: this.#warn,
            filtered: filtersRows(filters, quickFilter),
            expanded: treeExpanded,
          })
        : undefined;
  }

  readonly #warn = (message: string) => {
    if (this.#warned) return;
    this.#warned = true;
    console.warn(message);
  };

  #abortAll(): void {
    for (const { controller, cancel } of this.#requests.values()) {
      controller.abort();
      cancel();
    }
    this.#requests.clear();
    for (const [parentId, controller] of this.#childRequests) {
      controller.abort();
      this.#tree?.forget(parentId, 'loading');
    }
    this.#childRequests.clear();
  }

  #load(): void {
    const cache = this.#cache;
    const range = this.#range;
    if (!cache || !range) return;
    // Keep a page of margin, so a small scroll back doesn't abort a page about to land.
    const margin = cache.pageSize;
    for (const page of cache.inFlightOutside(range.start - margin, range.end + margin)) {
      this.#abort(String(page));
    }
    cache.evictOutside(range.start, range.end);
    for (const page of cache.missingPages(range.start, range.end)) this.#fetch(cache, page);
    const tree = this.#tree;
    if (tree) this.#startChildren(tree);
  }

  /** Requests the children `wanted` lists, up to `MAX_CHILD_REQUESTS` in flight. */
  #startChildren(tree: RemoteTree<T>): void {
    // `wanted` is a new array once a request starts: this one stays as it is.
    for (const parentId of tree.wanted) {
      if (this.#childRequests.size >= MAX_CHILD_REQUESTS) break;
      this.#fetchChildren(tree, parentId);
    }
  }

  #fetch(cache: PageCache<T>, page: number): void {
    const source = this.#config.source;
    if (!source) return;
    const { start, end } = cache.begin(page);
    const controller = new AbortController();
    const key = String(page);
    this.#requests.set(key, {
      controller,
      cancel: () => {
        cache.cancel(page);
      },
    });
    const current = () => !controller.signal.aborted && cache === this.#cache;
    settle(
      () =>
        source.getRows({
          start,
          end,
          sorting: this.#config.sorting,
          filters: this.#config.filters,
          quickFilter: this.#config.quickFilter,
          grouping: [],
          groupPath: [],
          signal: controller.signal,
        }),
      (response) => {
        if (!current()) return;
        const { rows, total } = (response ?? {}) as { rows?: unknown; total?: unknown };
        if (!Array.isArray(rows)) {
          throw new TypeError('argus-table: getRows() must resolve to { rows: [], total? }.');
        }
        this.#requests.delete(key);
        cache.resolve(page, rows as T[], typeof total === 'number' ? total : undefined);
        this.#host.requestUpdate();
      },
      (error) => {
        if (!current()) return;
        this.#requests.delete(key);
        cache.fail(page);
        // In a tree, shown indexes: open rows above the page push it down.
        const tree = this.#tree;
        const shown = (top: number) => tree?.positionOfTop(top) ?? tree?.rowCount ?? top;
        this.#errors.push({ error, start: shown(start), end: shown(end) });
        this.#host.requestUpdate();
      },
    );
  }

  /** Aborts a page request and forgets it in its cache. */
  #abort(key: string): void {
    const request = this.#requests.get(key);
    if (!request) return;
    request.controller.abort();
    request.cancel();
    this.#requests.delete(key);
  }

  /**
   * While grouped: notes the levels' rows the shown range covers, and loads
   * what's missing once it has been quiet, as `request()` does for pages.
   */
  #requestGroups(groups: RemoteGroups<T>, start: number, end: number): void {
    const ranges = groups.ranges(start, end);
    const key = ranges
      .map((r) => `${r.level.key}\u0001${String(r.start)}\u0001${String(r.end)}`)
      .join('\u0002');
    const moved = key !== this.#rangesKey;
    this.#range = { start, end };
    this.#rangesKey = key;
    if (moved) clearTimeout(this.#timer);
    else if (
      this.#timer !== undefined ||
      ranges.every((r) => groups.missingPages(r.level, r.start, r.end).length === 0)
    ) {
      return;
    }
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#loadGroups(groups);
    }, LOAD_DEBOUNCE_MS);
  }

  /**
   * While grouped: aborts pages that scrolled away (a page of margin per
   * level; every page of a level out of view), drops far pages, and requests
   * the missing ones of each level in view.
   */
  #loadGroups(groups: RemoteGroups<T>): void {
    const range = this.#range;
    if (groups !== this.#groups || !range) return;
    const ranges = groups.ranges(range.start, range.end);
    const covered = new Map(ranges.map((r) => [r.level.key, r]));
    const margin = groups.root.pageSize;
    for (const level of groups.levels()) {
      const r = covered.get(level.key);
      const outside = r
        ? groups.inFlightOutside(level, r.start - margin, r.end + margin)
        : groups.inFlightOutside(level, Infinity, Infinity);
      for (const page of outside) this.#abort(`${level.key}\u0001${String(page)}`);
    }
    groups.evict(range.start, range.end);
    for (const r of ranges) {
      for (const page of groups.missingPages(r.level, r.start, r.end)) {
        this.#fetchLevel(groups, r.level, page);
      }
    }
  }

  /** Loads a page of a level: its groups, or the deepest level's rows, with its `groupPath`. */
  #fetchLevel(groups: RemoteGroups<T>, level: GroupLevel, page: number): void {
    const source = this.#config.source;
    if (!source) return;
    const { start, end } = groups.begin(level, page);
    const controller = new AbortController();
    const key = `${level.key}\u0001${String(page)}`;
    this.#requests.set(key, {
      controller,
      cancel: () => {
        groups.cancel(level, page);
      },
    });
    const current = () => !controller.signal.aborted && groups === this.#groups;
    settle(
      () =>
        source.getRows({
          start,
          end,
          sorting: this.#config.sorting,
          filters: this.#config.filters,
          quickFilter: this.#config.quickFilter,
          grouping: this.#config.grouping,
          groupPath: level.path,
          signal: controller.signal,
        }),
      (response) => {
        if (!current()) return;
        const result = groups.resolve(level, page, response ?? {});
        if (result === 'wrong') {
          throw new TypeError(
            'argus-table: getRows() answers groups for a groupPath shorter than grouping, else rows.',
          );
        }
        this.#requests.delete(key);
        this.#host.requestUpdate();
      },
      (error) => {
        if (!current()) return;
        this.#requests.delete(key);
        groups.fail(level, page);
        const span = groups.span(level, page);
        this.#errors.push({ error, start: span.start, end: span.end, groupPath: level.path });
        this.#host.requestUpdate();
      },
    );
  }

  /** Loads the children of an open, loaded row (one `wanted` lists) with one `#loadChildren` call. */
  #fetchChildren(tree: RemoteTree<T>, parentId: string): void {
    tree.beginChildren(parentId);
    const controller = new AbortController();
    this.#childRequests.set(parentId, controller);
    const current = () => !controller.signal.aborted && tree === this.#tree;
    settle(
      () => this.#loadChildren?.(tree, parentId, controller.signal, this.#config),
      (response) => {
        if (!current()) return;
        const { rows } = (response ?? {}) as { rows?: unknown };
        if (!Array.isArray(rows)) {
          throw new TypeError('argus-table: getChildren() must resolve to { rows: [] }.');
        }
        this.#childRequests.delete(parentId);
        tree.resolveChildren(parentId, rows as T[]);
        // Outside any update, so a controlled table's handler can set properties.
        this.#arrived(parentId);
        this.#startChildren(tree);
        this.#host.requestUpdate();
      },
      (error) => {
        if (!current()) return;
        this.#childRequests.delete(parentId);
        // Not reported for a row collapsed meanwhile: its next expand loads again.
        if (tree.failChildren(parentId)) {
          // The parent's shown index (the error row is right below it), `-1` when it isn't shown.
          const start = tree.shownIndexOf(parentId) ?? -1;
          this.#errors.push({ error, start, end: start + 1, parentId });
        }
        this.#startChildren(tree);
        this.#host.requestUpdate();
      },
    );
  }
}

/**
 * Loads one parent's children for a tree: the one place that knows how a
 * parent's children are asked for, so another kind of parent (a server's group
 * row) can bring its own request.
 */
type LoadChildren<T> = (
  tree: RemoteTree<T>,
  parentId: string,
  signal: AbortSignal,
  config: DataConfig<T>,
) => unknown;

/** A source's `getChildren` as a `LoadChildren`; `undefined` without one. */
function getChildrenLoader<T>(source: DataSource<T>): LoadChildren<T> | undefined {
  const getChildren = source.getChildren?.bind(source);
  if (!getChildren) return undefined;
  return (tree, parentId, signal, { sorting, filters, quickFilter }) => {
    const request: ChildrenRequest<T> = {
      // Loaded: `wanted` lists loaded rows only.
      parent: tree.childRow(parentId) as T,
      parentId,
      sorting,
      filters,
      quickFilter,
      signal,
    };
    return getChildren(request);
  };
}

/**
 * Calls a loader and hands its answer to `done`, or what it threw or rejected
 * with (or what `done` threw) to `failed`.
 */
function settle(
  call: () => unknown,
  done: (response: unknown) => void,
  failed: (error: unknown) => void,
): void {
  let pending: Promise<unknown>;
  try {
    pending = Promise.resolve(call());
  } catch (error) {
    pending = Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
  pending.then(done).catch(failed);
}
