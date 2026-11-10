import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  PageCache,
  type ColumnFilterState,
  type DataSource,
  type LoadErrorDetail,
  type RowState,
  type SortState,
} from '@argus-table/core';

/** Rows per request when the data source sets no `pageSize`. */
export const DEFAULT_PAGE_SIZE = 100;

/** Quiet time after the last range change before pages load, so fast scrolling loads only where it stops. */
export const LOAD_DEBOUNCE_MS = 50;

export interface DataConfig<T> {
  source: DataSource<T> | undefined;
  sorting: SortState;
  filters: ColumnFilterState;
  quickFilter: string;
  getRowId: ((row: T, index: number) => string) | undefined;
}

/**
 * Loads `dataSource` pages for the rendered rows (infinite loading). It owns the
 * page cache: a new source, sort order, filter or row id function starts a fresh one, and
 * answers for an old cache are dropped. Requests wait until the range has been
 * quiet for `LOAD_DEBOUNCE_MS`; pages that scrolled away are aborted.
 */
export class DataController<T> implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  #config: DataConfig<T> = {
    source: undefined,
    sorting: [],
    filters: {},
    quickFilter: '',
    getRowId: undefined,
  };
  #cache: PageCache<T> | undefined;
  readonly #requests = new Map<number, AbortController>();
  #range: { start: number; end: number } | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #errors: LoadErrorDetail[] = [];

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

  /** The page cache, while a data source is set: the model reads rows from it. */
  get rows(): PageCache<T> | undefined {
    return this.#cache;
  }

  /**
   * Takes the source, sort order, filters and row id function. Any change starts a
   * fresh cache; a sort or row id change keeps the row count (the rows are the same),
   * a new source or filter doesn't (the rows aren't).
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
      this.#reset({ rowCount: this.#cache.rowCount, totalKnown: this.#cache.totalKnown });
    }
  }

  /** Drops every loaded page and loads the rendered ones again. The row count stays until pages answer. */
  refresh(): void {
    if (!this.#cache) return;
    this.#reset({ rowCount: this.#cache.rowCount, totalKnown: false });
    this.#host.requestUpdate();
  }

  stateAt(index: number): RowState {
    return this.#cache?.stateAt(index) ?? 'loaded';
  }

  /**
   * The rendered rows, `start` to `end` (exclusive). Loads what's missing once the
   * range has been quiet for a moment. Call after every update.
   */
  request(start: number, end: number): void {
    const cache = this.#cache;
    if (!cache) return;
    const prev = this.#range;
    const moved = prev?.start !== start || prev.end !== end;
    this.#range = { start, end };
    if (moved) {
      clearTimeout(this.#timer);
    } else if (this.#timer !== undefined || cache.missingPages(start, end).length === 0) {
      return;
    }
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#load();
    }, LOAD_DEBOUNCE_MS);
  }

  /** Requests the failed page holding row `index` again (the Retry button, or Enter on a failed row). */
  retry(index: number): void {
    const cache = this.#cache;
    const page = cache?.pageOf(index);
    if (!cache || page === undefined || !cache.isFailed(page)) return;
    cache.retry(page);
    this.#range = undefined;
    this.#host.requestUpdate();
  }

  /** Load errors since the last call, to fire as `argus-load-error` after the update. */
  takeErrors(): LoadErrorDetail[] {
    const errors = this.#errors;
    this.#errors = [];
    return errors;
  }

  #reset(carry: { rowCount: number | undefined; totalKnown: boolean } | undefined): void {
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
  }

  #abortAll(): void {
    for (const [page, controller] of this.#requests) {
      controller.abort();
      this.#cache?.cancel(page);
    }
    this.#requests.clear();
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
  }

  #fetch(cache: PageCache<T>, page: number): void {
    const source = this.#config.source;
    if (!source) return;
    const { start, end } = cache.begin(page);
    const controller = new AbortController();
    this.#requests.set(page, controller);
    const current = () => !controller.signal.aborted && cache === this.#cache;
    let pending: Promise<unknown>;
    try {
      pending = Promise.resolve(
        source.getRows({
          start,
          end,
          sorting: this.#config.sorting,
          filters: this.#config.filters,
          quickFilter: this.#config.quickFilter,
          signal: controller.signal,
        }),
      );
    } catch (error) {
      pending = Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    pending
      .then((response) => {
        if (!current()) return;
        const { rows, total } = (response ?? {}) as { rows?: unknown; total?: unknown };
        if (!Array.isArray(rows)) {
          throw new TypeError('argus-table: getRows() must resolve to { rows: [], total? }.');
        }
        this.#requests.delete(page);
        cache.resolve(page, rows as T[], typeof total === 'number' ? total : undefined);
        this.#host.requestUpdate();
      })
      .catch((error: unknown) => {
        if (!current()) return;
        this.#requests.delete(page);
        cache.fail(page);
        this.#errors.push({ error, start, end });
        this.#host.requestUpdate();
      });
  }
}
