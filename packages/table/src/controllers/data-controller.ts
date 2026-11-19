import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  PageCache,
  RemoteTree,
  type ChildrenRequest,
  type ColumnFilterState,
  type DataSource,
  type KeptCount,
  type LoadErrorDetail,
  type RowState,
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
  /** The expanded rows, for a source with `hasChildren` and `getChildren`. */
  treeExpanded: TreeExpandedState;
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
 */
export class DataController<T> implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  #config: DataConfig<T> = {
    source: undefined,
    sorting: [],
    filters: {},
    quickFilter: '',
    getRowId: undefined,
    treeExpanded: [],
  };
  #cache: PageCache<T> | undefined;
  /** The rows as a tree, while the source has `hasChildren` and `getChildren`. */
  #tree: RemoteTree<T> | undefined;
  readonly #requests = new Map<number, AbortController>();
  /** In-flight `getChildren` calls, by parent id. */
  readonly #childRequests = new Map<string, AbortController>();
  /** The top-level rows of the rendered range. */
  #range: { start: number; end: number } | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #errors: LoadErrorDetail[] = [];
  /** Whether a row id used twice was reported: once, whatever the resets. */
  #warned = false;

  constructor(host: ReactiveControllerHost) {
    this.#host = host;
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
  }

  /**
   * The rows the model reads, while a data source is set: the tree, or the page
   * cache. Indexes are shown indexes.
   */
  get rows(): PageCache<T> | RemoteTree<T> | undefined {
    return this.#tree ?? this.#cache;
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
      next.quickFilter !== prev.quickFilter
    ) {
      this.#reset({ rowCount: undefined, totalKnown: false });
    } else if (next.sorting !== prev.sorting || next.getRowId !== prev.getRowId) {
      // Other positions: open rows keep their counts once their rows load again.
      const counts = this.#tree?.counts();
      this.#reset({
        rowCount: this.#cache.rowCount,
        totalKnown: this.#cache.totalKnown,
        counts: counts && new Map([...counts].map(([id, { count }]) => [id, { count }])),
      });
    }
    this.#tree?.setExpanded(next.treeExpanded);
  }

  /**
   * Drops every loaded page and child rows and loads the rendered ones again. The
   * row count and open rows' child counts stay until the answers.
   */
  refresh(): void {
    if (!this.#cache) return;
    this.#reset({
      rowCount: this.#cache.rowCount,
      totalKnown: false,
      counts: this.#tree?.counts(),
    });
    this.#tree?.setExpanded(this.#config.treeExpanded);
    this.#host.requestUpdate();
  }

  /** The state of the row at a shown index. */
  stateAt(index: number): RowState {
    return this.rows?.stateAt(index) ?? 'loaded';
  }

  /**
   * The rendered rows, `start` to `end` (exclusive, shown indexes). Loads what's
   * missing once the range has been quiet for a moment: the pages of the
   * top-level rows they cover, and the children of open rows. Call after every update.
   */
  request(start: number, end: number): void {
    const cache = this.#cache;
    if (!cache) return;
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
        (!tree || !tree.hasWanted() || this.#childRequests.size >= MAX_CHILD_REQUESTS))
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
    const tree = this.#tree;
    const top = tree ? tree.topIndexOf(index) : index;
    if (top === undefined) {
      const parentId = tree?.parentIdAt(index);
      if (parentId === undefined || tree?.childState(parentId) !== 'error') return;
      tree.retryChildren(parentId);
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
    this.#errors = [];
    const { source, getRowId } = this.#config;
    this.#cache =
      source && carry
        ? new PageCache<T>({
            pageSize: source.pageSize ?? DEFAULT_PAGE_SIZE,
            getRowId,
            rowCount: carry.rowCount,
            totalKnown: carry.totalKnown,
          })
        : undefined;
    const hasChildren = source?.hasChildren?.bind(source);
    this.#tree =
      this.#cache && hasChildren && source?.getChildren
        ? new RemoteTree<T>(this.#cache, {
            hasChildren,
            getRowId,
            keepCounts: carry?.counts,
            warn: this.#warn,
          })
        : undefined;
  }

  readonly #warn = (message: string) => {
    if (this.#warned) return;
    this.#warned = true;
    console.warn(message);
  };

  #abortAll(): void {
    for (const [page, controller] of this.#requests) {
      controller.abort();
      this.#cache?.cancel(page);
    }
    this.#requests.clear();
    for (const [parentId, controller] of this.#childRequests) {
      controller.abort();
      this.#tree?.cancelChildren(parentId);
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
      this.#requests.get(page)?.abort();
      this.#requests.delete(page);
      cache.cancel(page);
    }
    cache.evictOutside(range.start, range.end);
    for (const page of cache.missingPages(range.start, range.end)) this.#fetch(cache, page);
    const tree = this.#tree;
    if (tree) this.#startChildren(tree);
  }

  /** Requests the children `wanted()` lists, up to `MAX_CHILD_REQUESTS` in flight. */
  #startChildren(tree: RemoteTree<T>): void {
    if (this.#childRequests.size >= MAX_CHILD_REQUESTS || !tree.hasWanted()) return;
    for (const parentId of tree.wanted()) {
      if (this.#childRequests.size >= MAX_CHILD_REQUESTS) break;
      this.#fetchChildren(tree, parentId);
    }
  }

  #fetch(cache: PageCache<T>, page: number): void {
    const source = this.#config.source;
    if (!source) return;
    const { start, end } = cache.begin(page);
    const controller = new AbortController();
    this.#requests.set(page, controller);
    const current = () => !controller.signal.aborted && cache === this.#cache;
    settle(
      () =>
        source.getRows({
          start,
          end,
          sorting: this.#config.sorting,
          filters: this.#config.filters,
          quickFilter: this.#config.quickFilter,
          signal: controller.signal,
        }),
      (response) => {
        if (!current()) return;
        const { rows, total } = (response ?? {}) as { rows?: unknown; total?: unknown };
        if (!Array.isArray(rows)) {
          throw new TypeError('argus-table: getRows() must resolve to { rows: [], total? }.');
        }
        this.#requests.delete(page);
        cache.resolve(page, rows as T[], typeof total === 'number' ? total : undefined);
        this.#host.requestUpdate();
      },
      (error) => {
        if (!current()) return;
        this.#requests.delete(page);
        cache.fail(page);
        this.#errors.push({ error, start, end });
        this.#host.requestUpdate();
      },
    );
  }

  /** Loads the children of an open, loaded row with one `getChildren` call. */
  #fetchChildren(tree: RemoteTree<T>, parentId: string): void {
    const source = this.#config.source;
    const parent = tree.childRow(parentId);
    if (!source || parent === undefined) return;
    tree.beginChildren(parentId);
    const controller = new AbortController();
    this.#childRequests.set(parentId, controller);
    const current = () => !controller.signal.aborted && tree === this.#tree;
    const request: ChildrenRequest<T> = {
      parent,
      parentId,
      sorting: this.#config.sorting,
      filters: this.#config.filters,
      quickFilter: this.#config.quickFilter,
      signal: controller.signal,
    };
    settle(
      () => source.getChildren?.(request) ?? Promise.resolve({ rows: [] }),
      (response) => {
        if (!current()) return;
        const { rows } = (response ?? {}) as { rows?: unknown };
        if (!Array.isArray(rows)) {
          throw new TypeError('argus-table: getChildren() must resolve to { rows: [] }.');
        }
        this.#childRequests.delete(parentId);
        tree.resolveChildren(parentId, rows as T[]);
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
 * Calls a loader and hands its answer to `done`, or what it threw or rejected
 * with (or what `done` threw) to `failed`.
 */
function settle(
  call: () => Promise<unknown>,
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
