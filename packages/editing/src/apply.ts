import type { ColumnDef } from 'argus-table';
import type { CellEditDetail } from './types.js';

/**
 * Applies an edit from `argus-cell-edit` to `data`: a new array with the edited
 * row replaced by a copy holding the new value. A column whose `accessor` is a
 * path (`'qty'`, `'address.city'`) gets the value set along the path, copying
 * each object on the way; any other column needs `meta.edit.set`. The row is
 * found by identity, so `data` must be the array the table shows. An edit of a
 * pinned row, or of a row not in `data`, returns a copy of `data`: pinned rows
 * are the app's own objects.
 *
 * A tree's rows from `getParentId` are all in `data`. Nested children
 * (`getSubRows`) aren't: pass `tree` with the table's `getSubRows` and a
 * `setSubRows(row, children)` that returns a copy of `row` with those children.
 * The row is then found by identity among the children too, and the rows on
 * the path to it are copied; every other row stays the same object. The
 * children mustn't form a cycle (a row among its own descendants). The search
 * recurses once per level, so a tree thousands of levels deep can overflow the
 * stack (a `RangeError`). Without `tree`, the edit of a nested child
 * (`detail.depth` above `0`) throws.
 *
 * ```ts
 * table.addEventListener('argus-cell-edit', (e) => {
 *   table.data = applyEdit(table.data, e.detail, table.columns);
 * });
 * ```
 */
export function applyEdit<T>(
  data: readonly T[],
  detail: CellEditDetail,
  columns: readonly ColumnDef<T, unknown>[],
  tree?: {
    getSubRows: (row: T) => readonly T[] | undefined;
    setSubRows: (row: T, children: T[]) => T;
  },
): T[] {
  // The row is one of data's (or, depth first, their children's), found by
  // identity; the detail of a plain element's event doesn't know its type.
  const target = detail.row as T;
  /**
   * A copy of `rows` with the target replaced by a copy, or else (with `tree`) the
   * row whose descendants hold it.
   */
  const replace = (rows: readonly T[]): T[] | undefined => {
    const at = rows.indexOf(target);
    if (at >= 0) return rows.with(at, edited());
    if (tree) {
      for (const [i, own] of rows.entries()) {
        const children = replace(tree.getSubRows(own) ?? []);
        if (children) return rows.with(i, tree.setSubRows(own, children));
      }
    }
    return undefined;
  };
  const edited = (): T => {
    const column = columns.find((c) => c.id === detail.columnId);
    const edit = column?.meta?.edit;
    const set = typeof edit === 'object' ? edit.set : undefined;
    if (set) return set(target, detail.value) as T;
    if (typeof column?.accessor === 'string') {
      return setPath(target, column.accessor.split('.'), detail.value);
    }
    throw new Error(
      `applyEdit: column "${detail.columnId}" has no accessor path; give it meta.edit.set`,
    );
  };
  if (detail.pinned) return [...data];
  const next = replace(data);
  if (next) return next;
  if (!tree && detail.depth) {
    throw new Error('applyEdit: row not in data (nested rows need the fourth argument)');
  }
  return [...data];
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
