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
 * The order after moving a column to position `to` (0-based, in the whole order
 * as the table shows it, counted after the move). `undefined` if the column can't
 * move, `to` is outside the column's group, or nothing changes.
 */
export function moveColumn(
  order: readonly string[],
  columns: readonly OrderableColumn[],
  columnId: string,
  to: number,
): ColumnOrderState | undefined {
  const column = columns.find((c) => c.id === columnId);
  if (!column?.reorderable || !Number.isInteger(to)) return undefined;
  const current = normalizeOrder(order, columns);
  const from = current.indexOf(columnId);
  if (to === from) return undefined;
  const pinOf = new Map(columns.map((c) => [c.id, groupOf(c)]));
  const group = groupOf(column);
  const first = current.findIndex((id) => pinOf.get(id) === group);
  const last = current.findLastIndex((id) => pinOf.get(id) === group);
  if (to < first || to > last) return undefined;
  const next = current.filter((id) => id !== columnId);
  next.splice(to, 0, columnId);
  return next;
}
