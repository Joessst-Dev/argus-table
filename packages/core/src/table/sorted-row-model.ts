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
