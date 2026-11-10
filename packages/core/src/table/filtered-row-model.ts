import type { RowData, RowModel, Table, TableFeatures } from '@tanstack/table-core';
import type { RowPredicate } from '../filters/filter.js';
import { valueVersion } from './sorted-row-model.js';

// The row test of each table, set by the model whenever filters, the quick filter or
// the columns change: a new function filters again, `undefined` keeps every row.
const predicates = new WeakMap<object, RowPredicate<never> | undefined>();

/** Sets the test the filtered row model of `table` keeps rows by. */
export function setRowPredicate<TData>(
  table: object,
  predicate: RowPredicate<TData> | undefined,
): void {
  predicates.set(table, predicate);
}

/**
 * The filtered row model, in place of TanStack's column filtering feature, which
 * would cost bundle size and read values through `row.getValue()` (slow in Firefox,
 * see sorted-row-model.ts). The model compiles the filters into one row test
 * (`rowPredicate` in filters/filter.ts) and this keeps the rows it passes, reading
 * values through the columns' accessors.
 *
 * It filters again when the test, the rows or the values (`valuesChanged`) change;
 * the sorted row model then sorts again, since its source is new. The rows are the
 * same `Row` objects. `rowsById` stays the unfiltered map: only TanStack's
 * `getRow(id)` reads it, and the model finds rows by their index instead.
 */
export function filteredRowModel<TFeatures extends TableFeatures, TData extends RowData>() {
  return (table: Table<TFeatures, TData>) => {
    let last:
      | {
          predicate: unknown;
          source: RowModel<TFeatures, TData>;
          version: number | undefined;
          model: RowModel<TFeatures, TData>;
        }
      | undefined;
    return (): RowModel<TFeatures, TData> => {
      const source = table.getPreFilteredRowModel();
      const predicate = predicates.get(table) as RowPredicate<TData> | undefined;
      if (!predicate) return source;
      const version = valueVersion(table);
      const prev = last;
      if (prev?.predicate === predicate && prev.source === source && prev.version === version) {
        return prev.model;
      }
      const rows = source.rows.filter((row) => predicate(row.original, row.index));
      const model = { rows, flatRows: rows, rowsById: source.rowsById };
      last = { predicate, source, version, model };
      return model;
    };
  };
}
