import type { ColumnDef } from 'argus-table';
import type { CellEditDetail } from './types.js';

/**
 * Applies an edit from `argus-cell-edit` to `data`: a new array with the edited
 * row replaced by a copy holding the new value. A column whose `accessor` is a
 * path (`'qty'`, `'address.city'`) gets the value set along the path, copying
 * each object on the way; any other column needs `meta.edit.set`. The row is
 * found by identity, so `data` must be the array the table shows. An edit of a
 * pinned row, or of a row not in `data`, returns `data` unchanged: pinned rows
 * are the app's own objects.
 *
 * ```ts
 * table.addEventListener('argus-cell-edit', (e) => {
 *   table.data = applyEdit(table.data, e.detail, table.columns);
 * });
 * ```
 */
export function applyEdit<T>(
  data: readonly T[],
  detail: CellEditDetail<T>,
  columns: readonly ColumnDef<T>[],
): T[] {
  const at = detail.pinned ? -1 : data.indexOf(detail.row);
  if (at < 0) return [...data];
  const column = columns.find((c) => c.id === detail.columnId);
  const edit = column?.meta?.edit;
  const set = typeof edit === 'object' ? edit.set : undefined;
  let row: T;
  if (set) {
    row = set(detail.row, detail.value);
  } else if (typeof column?.accessor === 'string') {
    row = setPath(detail.row, column.accessor.split('.'), detail.value);
  } else {
    throw new Error(
      `applyEdit: column "${detail.columnId}" has no accessor path; give it meta.edit.set`,
    );
  }
  const next = [...data];
  next[at] = row;
  return next;
}

/** A copy of `target` with `value` at `path`, copying each object along it. */
function setPath<V>(target: V, path: readonly string[], value: unknown): V {
  const [key, ...rest] = path;
  if (key === undefined) return value as V;
  const source = (target ?? {}) as Record<string, unknown>;
  const copy: Record<string, unknown> = Array.isArray(source)
    ? ([...(source as unknown[])] as unknown as Record<string, unknown>)
    : { ...source };
  copy[key] = setPath(source[key], rest, value);
  return copy as V;
}
