import { autoSortFn } from './sort-fns.js';

type Sorting = readonly { id: string; desc: boolean }[];

/** A column as sorting sees it. */
export interface SortColumn<TData> {
  getValue: (row: TData, index: number) => unknown;
  sortable: boolean;
}

interface SortKey {
  /** Each row's value by its position in `rows`, resolved for `compare`. */
  keys: unknown[];
  compare: (a: unknown, b: unknown) => number;
  /** -1 for descending. */
  sign: number;
}

/**
 * Sorts rows, given as indexes into `data`, by the sortable columns of `sorting`
 * in turn. Returns `rows` itself when nothing sorts.
 *
 * It reads each row's value once, through the column's accessor, and sorts the
 * row positions by those values: reading values in the comparator is orders of
 * magnitude slower in Firefox at scale, and text is lowercased once per row this
 * way. Each column's sort function is picked from its first values in `rows`
 * (`autoSortFn`). Missing values (`undefined`) sort last in either direction; ties
 * keep the order of `data`.
 */
export function sortRows<TData>(
  data: readonly TData[],
  rows: readonly number[],
  sorting: Sorting,
  columnOf: (id: string) => SortColumn<TData> | undefined,
): readonly number[] {
  if (rows.length === 0) return rows;
  const sortKeys: SortKey[] = [];
  for (const { id, desc } of sorting) {
    const column = columnOf(id);
    if (!column?.sortable) continue;
    const values = rows.map((i) => column.getValue(data[i] as TData, i));
    const fn = autoSortFn(values.slice(0, 10));
    const { resolve } = fn;
    sortKeys.push({
      // Undefined stays undefined: it sorts last.
      keys: resolve ? values.map((v) => (v === undefined ? v : resolve(v))) : values,
      compare: fn.compare,
      sign: desc ? -1 : 1,
    });
  }
  if (!sortKeys.length) return rows;
  // Ties keep the order of `data`: the radix sort keeps the order of `rows`.
  const order =
    rows.length >= RADIX_MIN && rows.every((r, i) => i === 0 || r > (rows[i - 1] ?? r))
      ? radixOrder(sortKeys, rows.length)
      : undefined;
  if (order) {
    // A loop: `Array.from(order, …)` takes six times as long.
    const sorted = new Array<number>(order.length);
    for (let i = 0; i < order.length; i++) sorted[i] = rows[order[i] ?? i] ?? i;
    return sorted;
  }

  const compare = (i: number, j: number): number => {
    for (const { keys, compare, sign } of sortKeys) {
      const a = keys[i];
      const b = keys[j];
      if (a === undefined || b === undefined) {
        if (a === b) continue;
        return a === undefined ? 1 : -1;
      }
      const result = compare(a, b);
      if (result !== 0) return result * sign;
    }
    return (rows[i] ?? i) - (rows[j] ?? j);
  };

  return rows
    .map((_, i) => i)
    .sort(compare)
    .map((i) => rows[i] ?? i);
}

/** Fewer rows sort faster with the comparator than with radix passes over 65,536 buckets. */
export const RADIX_MIN = 4096;

/**
 * Positions `0…n-1` sorted by keys that are all numbers or `undefined` (else
 * `undefined`): a stable radix sort, O(n) where a comparison sort calls the
 * comparator n log n times (a million rows: 30 ms rather than 350). Each key is
 * its float64's bits, made to sort as unsigned integers (a negative number's
 * bits flipped, a positive's sign bit set; flipped again for descending), and
 * `undefined` is all ones, last either way. Sorted by 16 bits at a time, from
 * the last key to the first, low bits first.
 */
function radixOrder(sortKeys: readonly SortKey[], n: number): Uint32Array | undefined {
  const view = new DataView(new ArrayBuffer(8));
  const hi = new Uint32Array(n);
  const lo = new Uint32Array(n);
  const count = new Uint32Array(65536);
  let order = new Uint32Array(n);
  let next = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  for (const { keys, sign } of [...sortKeys].reverse()) {
    for (let i = 0; i < n; i++) {
      const v = keys[i];
      let h = -1;
      let l = -1;
      if (v !== undefined) {
        if (typeof v !== 'number' || Number.isNaN(v)) return undefined;
        // `+ 0`: -0 is 0, as the comparator has them.
        view.setFloat64(0, v + 0);
        h = view.getUint32(0);
        l = view.getUint32(4);
        if (h >>> 31) {
          h = ~h;
          l = ~l;
        } else h |= 1 << 31;
        if (sign < 0) {
          h = ~h;
          l = ~l;
        }
      }
      hi[i] = h;
      lo[i] = l;
    }
    for (const [word, shift] of [
      [lo, 0],
      [lo, 16],
      [hi, 0],
      [hi, 16],
    ] as const) {
      const digit = (i: number) => ((word[i] ?? 0) >>> shift) & 0xffff;
      count.fill(0);
      for (let i = 0; i < n; i++) {
        const d = digit(i);
        count[d] = (count[d] ?? 0) + 1;
      }
      // One digit for every row: nothing moves.
      if (count[digit(0)] === n) continue;
      let sum = 0;
      for (let d = 0; d < 65536; d++) {
        const c = count[d] ?? 0;
        count[d] = sum;
        sum += c;
      }
      for (let i = 0; i < n; i++) {
        const p = order[i] ?? 0;
        const d = digit(p);
        const at = count[d] ?? 0;
        next[at] = p;
        count[d] = at + 1;
      }
      [order, next] = [next, order];
    }
  }
  return order;
}
