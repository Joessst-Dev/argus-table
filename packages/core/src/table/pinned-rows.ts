import type { ResolvedColumn } from '../columns/resolve-columns.js';
import type { CellContext, RowPin } from '../types.js';
import type { RowView, TableModelOptions } from './model-types.js';

/** Pinned rows (`pinnedRows`): separate objects, read outside the body's row order. */

function pinned<TData, TContent>(
  options: TableModelOptions<TData, TContent>,
  side: RowPin,
): readonly TData[] {
  return options.pinnedRows?.[side] ?? [];
}

export function pinnedCount<TData, TContent>(
  options: TableModelOptions<TData, TContent>,
  side: RowPin,
): number {
  return pinned(options, side).length;
}

/** A pinned row; its id is `getRowId`'s, else `top-0`, `bottom-1`… */
export function pinnedRowAt<TData, TContent>(
  options: TableModelOptions<TData, TContent>,
  side: RowPin,
  index: number,
): RowView<TData> | undefined {
  const rows = pinned(options, side);
  if (index < 0 || index >= rows.length) return undefined;
  const row = rows[index] as TData;
  const id = options.getRowId ? options.getRowId(row, index) : `${side}-${String(index)}`;
  return { id, index, original: row };
}

export function pinnedValueAt<TData, TContent>(
  options: TableModelOptions<TData, TContent>,
  column: ResolvedColumn<TData, TContent> | undefined,
  side: RowPin,
  index: number,
): unknown {
  const rows = pinned(options, side);
  if (index < 0 || index >= rows.length) return undefined;
  return column?.getValue(rows[index] as TData, index);
}

export function pinnedCellContext<TData, TContent>(
  options: TableModelOptions<TData, TContent>,
  column: ResolvedColumn<TData, TContent> | undefined,
  side: RowPin,
  index: number,
  columnId: string,
): CellContext<TData> | undefined {
  const row = pinnedRowAt(options, side, index);
  if (!row || !column) return undefined;
  return {
    row: row.original,
    rowId: row.id,
    index,
    columnId,
    value: column.getValue(row.original, index),
    pinned: side,
  };
}
