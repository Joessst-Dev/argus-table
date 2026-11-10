import type {
  ColumnDef_RowSorting,
  RowData,
  RowModel,
  SortFnDef,
  Table,
  TableFeatures,
} from '@tanstack/table-core';
import { column_getCanSort, column_getSortFn } from '@tanstack/table-core/static-functions';

type Sorting = readonly { id: string; desc: boolean }[];

// Bumped per table when a column reads its values differently (same id, new
// accessor): the rows and the sorting are the same, the sorted order is not.
const valueVersions = new WeakMap<object, number>();

/** Makes the sorted row model of `table` sort again on its next read. */
export function valuesChanged(table: object): void {
  valueVersions.set(table, (valueVersions.get(table) ?? 0) + 1);
}

interface SortKey {
  /** Each row's value by its position in the unsorted rows, resolved for `compare`. */
  keys: unknown[];
  compare: (a: unknown, b: unknown) => number;
  /** -1 flips `compare` (descending, inverted). */
  sign: number;
  sortUndefined: false | -1 | 1 | 'first' | 'last' | undefined;
}

/**
 * The sorted row model, in place of TanStack's `createSortedRowModel()`, giving the
 * same order: the same sort functions (`auto` included), `sortUndefined`,
 * `invertSorting`, ties by row index.
 *
 * It reads each row's value once, through the column's accessor, and sorts the row
 * positions by those values. TanStack's model calls `row.getValue()` four times per
 * comparison, and its row methods take rest arguments (`function (...args)`): in
 * Firefox that slows a large sort down by orders of magnitude (750k rows: 176 s
 * against 0.9 s for the same comparator without rest arguments). Reading values
 * once is also faster everywhere, most of all for text, which is lowercased once
 * per row instead of twice per comparison.
 *
 * The registered sort functions come from `constructSortFn`: each carries a value
 * comparator (`sort`, which compares values only) and a normalizer
 * (`resolveDataValue`). The rows are flat (no sub-rows), so there is nothing to
 * sort below them.
 */
export function sortedRowModel<TFeatures extends TableFeatures, TData extends RowData>() {
  return (table: Table<TFeatures, TData>) => {
    let last:
      | {
          sorting: unknown;
          source: RowModel<TFeatures, TData>;
          version: number | undefined;
          model: RowModel<TFeatures, TData>;
        }
      | undefined;
    return (): RowModel<TFeatures, TData> => {
      const source = table.getPreSortedRowModel();
      const sorting = (table.options.state as { sorting?: Sorting } | undefined)?.sorting;
      const version = valueVersions.get(table);
      const prev = last;
      if (prev && prev.sorting === sorting && prev.source === source && prev.version === version) {
        return prev.model;
      }
      const model = sortRows(table, source, sorting ?? []);
      last = { sorting, source, version, model };
      return model;
    };
  };
}

function sortRows<TFeatures extends TableFeatures, TData extends RowData>(
  table: Table<TFeatures, TData>,
  source: RowModel<TFeatures, TData>,
  sorting: Sorting,
): RowModel<TFeatures, TData> {
  const rows = source.rows;
  const sortKeys: SortKey[] = [];
  for (const { id, desc } of sorting) {
    const column = table.getColumn(id);
    if (!column || !column_getCanSort(column)) continue;
    const fn = column_getSortFn(column) as unknown as SortFnDef<TFeatures, TData>;
    const def = column.columnDef as ColumnDef_RowSorting<TFeatures, TData>;
    const read = column.accessorFn;
    const resolve = fn.resolveDataValue;
    const sortUndefined = def.sortUndefined;
    sortKeys.push({
      keys: rows.map((row) => {
        const value = read?.(row.original, row.index);
        // Undefined stays undefined where `sortUndefined` places it.
        return resolve && !(value === undefined && sortUndefined)
          ? (resolve(value) as unknown)
          : value;
      }),
      compare: fn.sort as (a: unknown, b: unknown) => number,
      sign: (desc ? -1 : 1) * (def.invertSorting ? -1 : 1),
      sortUndefined,
    });
  }
  if (!sortKeys.length || !rows.length) return source;

  const compare = (i: number, j: number): number => {
    for (const { keys, compare, sign, sortUndefined } of sortKeys) {
      const a = keys[i];
      const b = keys[j];
      let result = 0;
      if (sortUndefined && (a === undefined || b === undefined)) {
        if (a === undefined && b === undefined) continue;
        if (sortUndefined === 'first') return a === undefined ? -1 : 1;
        if (sortUndefined === 'last') return a === undefined ? 1 : -1;
        result = a === undefined ? sortUndefined : -sortUndefined;
      }
      if (result === 0) result = compare(a, b);
      if (result !== 0) return result * sign;
    }
    return (rows[i]?.index ?? i) - (rows[j]?.index ?? j);
  };

  const sorted = rows
    .map((_, i) => i)
    .sort(compare)
    .map((i) => rows[i])
    .filter((row) => row !== undefined);
  return { rows: sorted, flatRows: sorted, rowsById: source.rowsById };
}
