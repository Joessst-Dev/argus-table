/** Whether a row's data is there: loaded, still to come, or its page failed. */
export type RowState = 'loaded' | 'loading' | 'error';

/** A loaded row and its id. */
export interface CachedRow<TData> {
  id: string;
  row: TData;
}

export interface PageCacheOptions<TData> {
  /** Rows per page, at least 1. */
  pageSize: number;
  /** Row id function, given the absolute index. Default: the index as a string. */
  getRowId?: ((row: TData, index: number) => string) | undefined;
  /** Row count to start with (carried over from a previous cache). Default: one page. */
  rowCount?: number;
  /** Whether `rowCount` is the real total. Default: `false`. */
  totalKnown?: boolean;
}

/**
 * Pages kept loaded on each side of the requested range; pages further away are
 * dropped, so memory stays bounded however far the table scrolls.
 */
export const KEEP_PAGES = 10;

/**
 * The row cache behind `dataSource`: which pages are loaded, in flight or failed,
 * and how many rows the table has. Bookkeeping only: no timers and no fetching,
 * so the caller (the element's DataController) decides when to load.
 *
 * Without a known total, the row count stays one page past the last loaded row,
 * so the next page shows as skeletons and loads when it scrolls into view. A page
 * shorter than asked for marks the end.
 */
export class PageCache<TData> {
  readonly pageSize: number;
  readonly #getRowId: (row: TData, index: number) => string;
  readonly #pages = new Map<number, CachedRow<TData>[]>();
  /** In-flight pages and the `end` they asked for. */
  readonly #inFlight = new Map<number, number>();
  readonly #failed = new Set<number>();
  readonly #indexById = new Map<string, number>();
  #rowCount: number;
  #totalKnown: boolean;

  constructor(options: PageCacheOptions<TData>) {
    this.pageSize = Math.max(1, Math.floor(options.pageSize));
    this.#getRowId = options.getRowId ?? ((_row, index) => String(index));
    this.#rowCount = Math.max(0, Math.floor(options.rowCount ?? this.pageSize));
    this.#totalKnown = options.totalKnown ?? false;
  }

  /** Number of rows, loaded or not. */
  get rowCount(): number {
    return this.#rowCount;
  }

  /** `true` once the total is known (given by the server, or found from a short page). */
  get totalKnown(): boolean {
    return this.#totalKnown;
  }

  pageOf(index: number): number {
    return Math.floor(index / this.pageSize);
  }

  /** The loaded row at an index, with its id; `undefined` until its page has loaded. */
  entryAt(index: number): CachedRow<TData> | undefined {
    if (index < 0 || index >= this.#rowCount) return undefined;
    return this.#pages.get(this.pageOf(index))?.[index % this.pageSize];
  }

  /** The index of a loaded row's id, or `undefined`. */
  indexOf(rowId: string): number | undefined {
    return this.#indexById.get(rowId);
  }

  /** The ids of every loaded row, in row order. */
  loadedIds(): string[] {
    const pages = [...this.#pages.keys()].sort((a, b) => a - b);
    return pages.flatMap((page) => (this.#pages.get(page) ?? []).map((entry) => entry.id));
  }

  stateAt(index: number): RowState {
    if (this.entryAt(index)) return 'loaded';
    return this.#failed.has(this.pageOf(index)) ? 'error' : 'loading';
  }

  /** Pages touching the rows `start` to `end` (exclusive) that still need a request. */
  missingPages(start: number, end: number): number[] {
    const last = Math.min(end, this.#rowCount) - 1;
    const pages: number[] = [];
    if (last < 0) return pages;
    for (let page = this.pageOf(Math.max(0, start)); page <= this.pageOf(last); page++) {
      if (!this.#pages.has(page) && !this.#inFlight.has(page) && !this.#failed.has(page)) {
        pages.push(page);
      }
    }
    return pages;
  }

  /** Marks a page as in flight and returns the rows to ask for. */
  begin(page: number): { start: number; end: number } {
    const start = page * this.pageSize;
    let end = start + this.pageSize;
    if (this.#totalKnown) end = Math.min(end, this.#rowCount);
    this.#failed.delete(page);
    this.#inFlight.set(page, end);
    return { start, end };
  }

  /** Stores a page's rows and updates the row count. Ignored unless the page is in flight. */
  resolve(page: number, rows: readonly TData[], total?: number): boolean {
    const end = this.#inFlight.get(page);
    if (end === undefined) return false;
    this.#inFlight.delete(page);
    const start = page * this.pageSize;
    const asked = end - start;
    const entries = rows.slice(0, asked).map((row, i) => ({
      id: this.#getRowId(row, start + i),
      row,
    }));
    this.#drop(page);
    if (entries.length > 0) this.#pages.set(page, entries);
    entries.forEach((entry, i) => this.#indexById.set(entry.id, start + i));

    if (total !== undefined && Number.isFinite(total) && total >= 0) {
      this.#setCount(Math.floor(total), true);
    } else if (entries.length < asked) {
      this.#setCount(start + entries.length, true);
    } else if (!this.#totalKnown) {
      this.#setCount(Math.max(this.#rowCount, end + this.pageSize), false);
    }
    return true;
  }

  /** Marks an in-flight page as failed. Ignored unless the page is in flight. */
  fail(page: number): boolean {
    if (!this.#inFlight.delete(page)) return false;
    this.#failed.add(page);
    return true;
  }

  /** Lets a failed page be requested again. */
  retry(page: number): void {
    this.#failed.delete(page);
  }

  /** Forgets an in-flight page (its request was aborted), so it can be requested again. */
  cancel(page: number): void {
    this.#inFlight.delete(page);
  }

  /** `true` if a page failed and hasn't been retried or evicted since. */
  isFailed(page: number): boolean {
    return this.#failed.has(page);
  }

  /** In-flight pages entirely outside rows `start` to `end` (exclusive). */
  inFlightOutside(start: number, end: number): number[] {
    const first = this.pageOf(Math.max(0, start));
    const last = this.pageOf(Math.max(0, end - 1));
    return [...this.#inFlight.keys()].filter((page) => page < first || page > last);
  }

  /**
   * Drops loaded and failed pages more than `KEEP_PAGES` pages away from rows
   * `start` to `end` (exclusive). Failed pages that come back into view load again.
   */
  evictOutside(start: number, end: number): void {
    const first = this.pageOf(Math.max(0, start)) - KEEP_PAGES;
    const last = this.pageOf(Math.max(0, end - 1)) + KEEP_PAGES;
    for (const page of [...this.#pages.keys()]) {
      if (page < first || page > last) this.#drop(page);
    }
    for (const page of [...this.#failed]) {
      if (page < first || page > last) this.#failed.delete(page);
    }
  }

  /** Number of pages holding rows: bounded by eviction. */
  get loadedPages(): number {
    return this.#pages.size;
  }

  #setCount(count: number, known: boolean): void {
    this.#rowCount = count;
    this.#totalKnown = known;
    // Rows past the end are gone; drop pages that start there.
    for (const page of [...this.#pages.keys()]) {
      if (page * this.pageSize >= count) this.#drop(page);
    }
  }

  #drop(page: number): void {
    const entries = this.#pages.get(page);
    if (!entries) return;
    const start = page * this.pageSize;
    entries.forEach((entry, i) => {
      if (this.#indexById.get(entry.id) === start + i) this.#indexById.delete(entry.id);
    });
    this.#pages.delete(page);
  }
}
