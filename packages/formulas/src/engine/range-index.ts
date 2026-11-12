import { comparable, keyOf, meets, signature, type Criterion, type Key } from './criteria.js';
import { isFormulaError, type FormulaError } from './errors.js';
import { numberIn, type ColumnRange } from './range.js';

// Indexes over whole columns, built on first use and kept with the range (one per
// set of rows), so a criterion or lookup that changes from row to row
// (`COUNTIF([[customer]], [customer])`) doesn't scan the column for every row.

/** What the rows meeting a criterion add up to, over a range to sum. */
export interface Stats {
  /** Rows meeting the criterion. */
  matches: number;
  /** Their numbers in the range to sum. */
  sum: number;
  /** How many of them have a number there. */
  numbers: number;
  /** The first error among them there, if any. */
  error: FormulaError | undefined;
}

class Acc implements Stats {
  matches = 0;
  sum = 0;
  numbers = 0;
  errors = 0;
  error: FormulaError | undefined = undefined;

  add(value: unknown): void {
    this.matches++;
    const n = numberIn(value);
    if (n === undefined) return;
    if (isFormulaError(n)) {
      this.errors++;
      this.error ??= n;
      return;
    }
    this.sum += n;
    this.numbers++;
  }
}

/** The values of one kind, sorted, with running totals of the range to sum in that order. */
interface Sorted {
  /** The comparable values, ascending. */
  keys: Float64Array;
  /** The row of each, in the same order. */
  rows: Int32Array;
  /** Running totals (index `i` covers the first `i`). */
  sums: Float64Array;
  numbers: Int32Array;
  errors: Int32Array;
  /** Whether differences of `sums` are exact (whole numbers within 2^53), so they can answer `SUMIF`. */
  exact: boolean;
}

interface SumCache {
  equal?: { byKey: Map<Key, Acc>; total: Acc };
  sorted: Map<'number' | 'date', Sorted>;
  /** Results of scans, by criterion signature. */
  scans: Map<string, Stats>;
}

interface Cache {
  first?: Map<Key, number>;
  ranks?: Float64Array | FormulaError;
  bySum: WeakMap<ColumnRange, SumCache>;
}

const caches = new WeakMap<ColumnRange, Cache>();

function cacheOf(range: ColumnRange): Cache {
  let cache = caches.get(range);
  if (!cache) {
    cache = { bySum: new WeakMap() };
    caches.set(range, cache);
  }
  return cache;
}

function sumCacheOf(range: ColumnRange, sum: ColumnRange): SumCache {
  const { bySum } = cacheOf(range);
  let cache = bySum.get(sum);
  if (!cache) {
    cache = { sorted: new Map(), scans: new Map() };
    bySum.set(sum, cache);
  }
  return cache;
}

function equalIndex(range: ColumnRange, sum: ColumnRange, cache: SumCache) {
  if (cache.equal) return cache.equal;
  const byKey = new Map<Key, Acc>();
  const total = new Acc();
  range.values.forEach((value, i) => {
    const key = keyOf(value);
    let acc = byKey.get(key);
    if (!acc) {
      acc = new Acc();
      byKey.set(key, acc);
    }
    acc.add(sum.values[i]);
    total.add(sum.values[i]);
  });
  cache.equal = { byKey, total };
  return cache.equal;
}

/** First index in `keys` whose value is at least (`upper`: greater than) `value`. */
function bound(keys: Float64Array, value: number, upper: boolean): number {
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const key = keys[mid] ?? 0;
    if (key < value || (upper && key === value)) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function sortedIndex(
  range: ColumnRange,
  sum: ColumnRange,
  kind: 'number' | 'date',
  cache: SumCache,
): Sorted {
  const known = cache.sorted.get(kind);
  if (known) return known;
  const rows: number[] = [];
  const values: number[] = [];
  range.values.forEach((value, i) => {
    const x = comparable(value, kind);
    if (typeof x === 'number') {
      rows.push(i);
      values[i] = x;
    }
  });
  rows.sort((a, b) => (values[a] ?? 0) - (values[b] ?? 0));
  const n = rows.length;
  const sorted: Sorted = {
    keys: new Float64Array(n),
    rows: Int32Array.from(rows),
    sums: new Float64Array(n + 1),
    numbers: new Int32Array(n + 1),
    errors: new Int32Array(n + 1),
    exact: true,
  };
  rows.forEach((row, i) => {
    sorted.keys[i] = values[row] ?? 0;
    const s = numberIn(sum.values[row]);
    const err = isFormulaError(s);
    const num = typeof s === 'number';
    sorted.sums[i + 1] = (sorted.sums[i] ?? 0) + (num ? s : 0);
    sorted.numbers[i + 1] = (sorted.numbers[i] ?? 0) + (num ? 1 : 0);
    sorted.errors[i + 1] = (sorted.errors[i] ?? 0) + (err ? 1 : 0);
    if (num && !Number.isInteger(s)) sorted.exact = false;
  });
  if (Math.abs(sorted.sums[n] ?? 0) >= 2 ** 53) sorted.exact = false;
  cache.sorted.set(kind, sorted);
  return sorted;
}

/** The first error in `sum` among the rows meeting `c` (the rare case: a scan). */
function firstError(range: ColumnRange, c: Criterion, sum: ColumnRange): FormulaError | undefined {
  for (let i = 0; i < range.values.length; i++) {
    const value = sum.values[i];
    if (isFormulaError(value) && meets(c, range.values[i])) return value;
  }
  return undefined;
}

function scan(range: ColumnRange, c: Criterion, sum: ColumnRange): Stats {
  const acc = new Acc();
  range.values.forEach((value, i) => {
    if (meets(c, value)) acc.add(sum.values[i]);
  });
  return acc;
}

/**
 * The rows of `range` meeting `c`, and what their values in `sum` add up to
 * (`sum` is `range` itself for `COUNTIF`). Equality goes through a hash index,
 * `<`, `<=`, `>`, `>=` on numbers and dates through a sorted copy; other
 * criteria (wildcards, text order) scan once per distinct criterion.
 */
export function statsOf(range: ColumnRange, c: Criterion, sum: ColumnRange, count = false): Stats {
  const cache = sumCacheOf(range, sum);
  if ('keys' in c) {
    const { byKey, total } = equalIndex(range, sum, cache);
    const acc = new Acc();
    for (const key of new Set(c.keys)) {
      const part = byKey.get(key);
      if (!part) continue;
      acc.matches += part.matches;
      acc.sum += part.sum;
      acc.numbers += part.numbers;
      acc.errors += part.errors;
      acc.error ??= part.error;
    }
    if (c.op === '=') return acc;
    // `<>`: everything else. Whole numbers subtract exactly; other sums are added up again.
    if (count || (Number.isSafeInteger(total.sum) && Number.isSafeInteger(acc.sum))) {
      return {
        matches: total.matches - acc.matches,
        sum: total.sum - acc.sum,
        numbers: total.numbers - acc.numbers,
        error: total.errors > acc.errors ? firstError(range, c, sum) : undefined,
      };
    }
  }
  if ('operand' in c && (c.operand.kind === 'number' || c.operand.kind === 'date')) {
    const sorted = sortedIndex(range, sum, c.operand.kind, cache);
    if (count || sorted.exact) {
      const y = c.operand.value;
      const n = sorted.keys.length;
      const [from, to] =
        c.op === '<'
          ? [0, bound(sorted.keys, y, false)]
          : c.op === '<='
            ? [0, bound(sorted.keys, y, true)]
            : c.op === '>'
              ? [bound(sorted.keys, y, true), n]
              : [bound(sorted.keys, y, false), n];
      const errors = (sorted.errors[to] ?? 0) - (sorted.errors[from] ?? 0);
      return {
        matches: to - from,
        sum: (sorted.sums[to] ?? 0) - (sorted.sums[from] ?? 0),
        numbers: (sorted.numbers[to] ?? 0) - (sorted.numbers[from] ?? 0),
        error: errors > 0 ? firstError(range, c, sum) : undefined,
      };
    }
  }
  const key = signature(c);
  let stats = cache.scans.get(key);
  if (!stats) {
    stats = scan(range, c, sum);
    cache.scans.set(key, stats);
  }
  return stats;
}

/** The position of the first value of `range` equal to `value` (text without case), through a hash index. */
export function firstIndexOf(range: ColumnRange, value: unknown): number | undefined {
  const cache = cacheOf(range);
  if (!cache.first) {
    const first = new Map<Key, number>();
    range.values.forEach((v, i) => {
      const key = keyOf(v);
      if (!first.has(key)) first.set(key, i);
    });
    cache.first = first;
  }
  return cache.first.get(keyOf(value));
}

/** The numbers of `range`, ascending (for `RANK`); its first error instead, if it has one. */
export function sortedNumbers(range: ColumnRange): Float64Array | FormulaError {
  const cache = cacheOf(range);
  if (!cache.ranks) {
    const numbers: number[] = [];
    let error: FormulaError | undefined;
    for (const value of range.values) {
      const n = numberIn(value);
      if (isFormulaError(n)) {
        error = n;
        break;
      }
      if (n !== undefined) numbers.push(n);
    }
    cache.ranks = error ?? Float64Array.from(numbers).sort();
  }
  return cache.ranks;
}

/** How many of the ascending `numbers` are below `value` (`upper`: at most `value`). */
export function countBelow(numbers: Float64Array, value: number, upper: boolean): number {
  return bound(numbers, value, upper);
}
