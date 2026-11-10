import type { ColumnOrderState, ColumnPin } from '../types.js';

/** What ordering needs to know about a column. */
export interface OrderableColumn {
  id: string;
  pin: ColumnPin | undefined;
  reorderable: boolean;
}

type Group = ColumnPin | 'center';

const groupOf = (column: OrderableColumn): Group => column.pin ?? 'center';

/**
 * The order the table shows: start-pinned, scrolling, end-pinned columns, each
 * group in the sequence of `order`. Unknown and repeated ids are dropped; columns
 * the order doesn't list follow the listed ones of their group, in `columns` order.
 */
export function normalizeOrder(
  order: readonly string[],
  columns: readonly OrderableColumn[],
): ColumnOrderState {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const listed = new Set<string>();
  const groups: Record<Group, string[]> = { start: [], center: [], end: [] };
  for (const id of order) {
    const column = byId.get(id);
    if (!column || listed.has(id)) continue;
    listed.add(id);
    groups[groupOf(column)].push(id);
  }
  for (const column of columns) {
    if (!listed.has(column.id)) groups[groupOf(column)].push(column.id);
  }
  return [...groups.start, ...groups.center, ...groups.end];
}

/**
 * The order after moving a column to position `to`: 0-based among the columns
 * `shown` accepts (hidden columns don't count), in the order the table shows them,
 * counted after the move. The column lands just before the shown column now at `to`,
 * hidden columns keep their place among the others. `undefined` if the column can't
 * move or isn't shown, `to` is outside the column's group, or nothing changes.
 */
export function moveColumn(
  order: readonly string[],
  columns: readonly OrderableColumn[],
  columnId: string,
  to: number,
  shown: (id: string) => boolean = () => true,
): ColumnOrderState | undefined {
  const column = columns.find((c) => c.id === columnId);
  if (!column?.reorderable || !Number.isInteger(to) || !shown(columnId)) return undefined;
  const current = normalizeOrder(order, columns);
  const visible = current.filter(shown);
  const from = visible.indexOf(columnId);
  if (to === from) return undefined;
  const pinOf = new Map(columns.map((c) => [c.id, groupOf(c)]));
  const group = groupOf(column);
  const first = visible.findIndex((id) => pinOf.get(id) === group);
  const last = visible.findLastIndex((id) => pinOf.get(id) === group);
  if (to < first || to > last) return undefined;
  const next = current.filter((id) => id !== columnId);
  const before = visible.filter((id) => id !== columnId)[to];
  // Before the shown column now at `to`: one of the next group's, at the end of a
  // group, and normalizing puts the column back at the end of its own.
  next.splice(before === undefined ? next.length : next.indexOf(before), 0, columnId);
  return normalizeOrder(next, columns);
}
