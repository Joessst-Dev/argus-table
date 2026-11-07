import { describe, expect, it } from 'vitest';
import { KEEP_PAGES, PageCache } from './page-cache.js';

interface Row {
  id: string;
}

const rows = (start: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `r${String(start + i)}` }));

/** Requests a page and resolves it with `count` rows. */
function load(cache: PageCache<Row>, page: number, count: number, total?: number) {
  const { start } = cache.begin(page);
  return cache.resolve(page, rows(start, count), total);
}

describe('PageCache: row count', () => {
  it('starts with one page of rows, total unknown', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    expect(cache.rowCount).toBe(10);
    expect(cache.totalKnown).toBe(false);
  });

  it('grows to one page past the last loaded row while the total is unknown', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    load(cache, 0, 10);
    expect(cache.rowCount).toBe(20);
    load(cache, 1, 10);
    expect(cache.rowCount).toBe(30);
    expect(cache.totalKnown).toBe(false);
  });

  it('ends at a short page', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    load(cache, 0, 10);
    load(cache, 1, 4);
    expect(cache.rowCount).toBe(14);
    expect(cache.totalKnown).toBe(true);
  });

  it('is empty when the first page has no rows', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    load(cache, 0, 0);
    expect(cache.rowCount).toBe(0);
    expect(cache.totalKnown).toBe(true);
  });

  it('uses the total when the server sends one, and asks for no rows past it', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    load(cache, 0, 10, 25);
    expect(cache.rowCount).toBe(25);
    expect(cache.totalKnown).toBe(true);
    expect(cache.begin(2)).toEqual({ start: 20, end: 25 });
    cache.resolve(2, rows(20, 5));
    expect(cache.rowCount).toBe(25);
  });

  it('drops pages past a new, smaller end', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    load(cache, 0, 10);
    load(cache, 1, 10);
    load(cache, 0, 10, 5);
    expect(cache.rowCount).toBe(5);
    expect(cache.entryAt(12)).toBeUndefined();
    expect(cache.indexOf('12')).toBeUndefined();
  });

  it('starts from a carried-over count', () => {
    const cache = new PageCache<Row>({ pageSize: 10, rowCount: 500, totalKnown: true });
    expect(cache.rowCount).toBe(500);
    expect(cache.totalKnown).toBe(true);
  });
});

describe('PageCache: rows and ids', () => {
  it('serves loaded rows by absolute index, with index ids by default', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    load(cache, 0, 10);
    load(cache, 1, 10);
    expect(cache.entryAt(13)).toEqual({ id: '13', row: { id: 'r13' } });
    expect(cache.entryAt(25)).toBeUndefined();
    expect(cache.indexOf('13')).toBe(13);
  });

  it('gives getRowId the absolute index', () => {
    const seen: number[] = [];
    const cache = new PageCache<Row>({
      pageSize: 10,
      getRowId: (row, index) => {
        seen.push(index);
        return row.id;
      },
    });
    load(cache, 2, 2);
    expect(seen).toEqual([20, 21]);
    expect(cache.indexOf('r21')).toBe(21);
  });

  it('keeps no more rows than were asked for', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    cache.begin(0);
    cache.resolve(0, rows(0, 15));
    expect(cache.entryAt(10)).toBeUndefined();
    expect(cache.rowCount).toBe(20);
  });

  it('reports each row as loading, loaded or error', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    load(cache, 0, 10);
    cache.begin(1);
    expect(cache.stateAt(3)).toBe('loaded');
    expect(cache.stateAt(13)).toBe('loading');
    cache.fail(1);
    expect(cache.stateAt(13)).toBe('error');
    expect(cache.isFailed(1)).toBe(true);
  });
});

describe('PageCache: requests', () => {
  it('lists pages in a range that are not loaded, in flight or failed', () => {
    const cache = new PageCache<Row>({ pageSize: 10, rowCount: 100 });
    load(cache, 1, 10);
    cache.begin(2);
    cache.begin(3);
    cache.fail(3);
    expect(cache.missingPages(5, 55)).toEqual([0, 4, 5]);
  });

  it('lists no pages past the row count, or for an empty range', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    expect(cache.missingPages(0, 1000)).toEqual([0]);
    expect(cache.missingPages(0, 0)).toEqual([]);
  });

  it('asks for a failed page again after retry()', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    cache.begin(0);
    cache.fail(0);
    expect(cache.missingPages(0, 10)).toEqual([]);
    cache.retry(0);
    expect(cache.missingPages(0, 10)).toEqual([0]);
  });

  it('ignores answers for pages that are not in flight', () => {
    const cache = new PageCache<Row>({ pageSize: 10 });
    expect(cache.resolve(0, rows(0, 10))).toBe(false);
    cache.begin(0);
    cache.cancel(0);
    expect(cache.resolve(0, rows(0, 10))).toBe(false);
    expect(cache.fail(0)).toBe(false);
    expect(cache.entryAt(0)).toBeUndefined();
  });

  it('finds in-flight pages outside a range', () => {
    const cache = new PageCache<Row>({ pageSize: 10, rowCount: 100 });
    cache.begin(0);
    cache.begin(4);
    cache.begin(9);
    expect(cache.inFlightOutside(35, 60)).toEqual([0, 9]);
  });
});

describe('PageCache: eviction', () => {
  it('drops loaded and failed pages far from the range, with their ids', () => {
    const cache = new PageCache<Row>({ pageSize: 10, rowCount: 10_000 });
    load(cache, 0, 10);
    load(cache, 50, 10);
    cache.begin(51 + KEEP_PAGES);
    cache.fail(51 + KEEP_PAGES);
    cache.evictOutside(500, 510);
    expect(cache.entryAt(5)).toBeUndefined();
    expect(cache.indexOf('5')).toBeUndefined();
    expect(cache.entryAt(505)).toBeDefined();
    expect(cache.isFailed(51 + KEEP_PAGES)).toBe(false);
    expect(cache.loadedPages).toBe(1);
  });
});
