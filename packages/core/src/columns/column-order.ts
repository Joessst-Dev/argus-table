import type { ColumnOrderState, ColumnPin } from '../types.js';
import { EMPTY_TREE, type GroupTree } from './column-groups.js';

/** What ordering needs to know about a column. */
export interface OrderableColumn {
  id: string;
  pin: ColumnPin | undefined;
  reorderable: boolean;
}

/** What moves as one: a column, or a group's columns on one pin side. */
export type OrderUnit =
  { kind: 'column'; id: string } | { kind: 'group'; id: string; pin: ColumnPin | undefined };

/** A unit among its siblings, with its shown columns in visual order. */
export interface SiblingUnit {
  unit: OrderUnit;
  columns: readonly string[];
}

type Side = ColumnPin | 'center';

const sideOf = (pin: ColumnPin | undefined): Side => pin ?? 'center';

/**
 * Puts the columns of each group next to each other, nested groups within theirs:
 * a group takes the place of its first column, and keeps its columns' order.
 */
function cluster(ids: readonly string[], tree: GroupTree<unknown>, depth = 0): string[] {
  const units = new Map<string, string[]>();
  for (const id of ids) {
    const group = tree.pathOf(id)[depth];
    const key = group === undefined ? `c:${id}` : `g:${group}`;
    let members = units.get(key);
    if (!members) units.set(key, (members = []));
    members.push(id);
  }
  return [...units].flatMap(([key, members]) =>
    key.startsWith('g:') ? cluster(members, tree, depth + 1) : members,
  );
}

/**
 * The order the table shows: start-pinned, scrolling, end-pinned columns, each
 * side in the sequence of `order`. Unknown and repeated ids are dropped; columns
 * the order doesn't list follow the listed ones of their side, in `columns` order.
 * The columns of a group stay together on each side (see `columnGroups`).
 */
export function normalizeOrder(
  order: readonly string[],
  columns: readonly OrderableColumn[],
  tree: GroupTree<unknown> = EMPTY_TREE,
): ColumnOrderState {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const listed = new Set<string>();
  const sides: Record<Side, string[]> = { start: [], center: [], end: [] };
  for (const id of order) {
    const column = byId.get(id);
    if (!column || listed.has(id)) continue;
    listed.add(id);
    sides[sideOf(column.pin)].push(id);
  }
  for (const column of columns) {
    if (!listed.has(column.id)) sides[sideOf(column.pin)].push(column.id);
  }
  const { start, center, end } = sides;
  if (!tree.groups.size) return [...start, ...center, ...end];
  return [...cluster(start, tree), ...cluster(center, tree), ...cluster(end, tree)];
}

/** Whether a column belongs to a unit: is the column, or one of the group's on its side. */
function inUnit(
  unit: OrderUnit,
  id: string,
  pinOf: ReadonlyMap<string, Side>,
  tree: GroupTree<unknown>,
): boolean {
  if (unit.kind === 'column') return id === unit.id;
  return pinOf.get(id) === sideOf(unit.pin) && tree.pathOf(id).includes(unit.id);
}

/**
 * The units a unit moves among, in visual order: the columns and groups with the
 * same parent group (or none) on the same pin side, with their shown columns.
 * Without groups, the shown columns of the side. Empty if the unit isn't shown.
 */
export function siblingUnits(
  order: readonly string[],
  columns: readonly OrderableColumn[],
  tree: GroupTree<unknown>,
  unit: OrderUnit,
  shown: (id: string) => boolean = () => true,
): SiblingUnit[] {
  const pinOf = new Map(columns.map((c) => [c.id, sideOf(c.pin)]));
  let side: Side | undefined;
  let parent: readonly string[];
  if (unit.kind === 'column') {
    side = pinOf.get(unit.id);
    parent = tree.pathOf(unit.id);
  } else {
    const node = tree.groups.get(unit.id);
    if (!node) return [];
    side = sideOf(unit.pin);
    parent = [];
    for (let id = node.parent; id !== undefined; id = tree.groups.get(id)?.parent) {
      parent = [id, ...parent];
    }
  }
  if (side === undefined) return [];
  const pin = side === 'center' ? undefined : side;
  const depth = parent.length;
  const units: SiblingUnit[] = [];
  let last: { key: string; columns: string[] } | undefined;
  for (const id of normalizeOrder(order, columns, tree)) {
    if (pinOf.get(id) !== side || !shown(id)) continue;
    const path = tree.pathOf(id);
    if (path.length < depth || parent.some((g, i) => path[i] !== g)) continue;
    const group = path[depth];
    const key = group === undefined ? `c:${id}` : `g:${group}`;
    if (last?.key === key) {
      last.columns.push(id);
      continue;
    }
    last = { key, columns: [id] };
    units.push({
      unit: group === undefined ? { kind: 'column', id } : { kind: 'group', id: group, pin },
      columns: last.columns,
    });
  }
  return units.some((u) => sameUnit(u.unit, unit)) ? units : [];
}

/** Whether two units are the same column, or the same group on the same side. */
export function sameUnit(a: OrderUnit, b: OrderUnit): boolean {
  if (a.kind !== b.kind || a.id !== b.id) return false;
  return a.kind === 'column' || sideOf(a.pin) === sideOf((b as typeof a).pin);
}

/**
 * The order after moving a unit (a column, or a group on one pin side) to position
 * `to` among its siblings (see `siblingUnits`), counted after the move. It lands just
 * before the sibling now at `to`, or after the last one; hidden columns keep their
 * place among the others, and a group's hidden columns move with it. `undefined` if
 * the unit can't move (a column with `reorderable: false`, a group with one), isn't
 * shown, `to` is out of range, or nothing changes. A group with `reorderable: false`
 * doesn't move either.
 */
export function moveUnit(
  order: readonly string[],
  columns: readonly OrderableColumn[],
  tree: GroupTree<unknown>,
  unit: OrderUnit,
  to: number,
  shown: (id: string) => boolean = () => true,
): ColumnOrderState | undefined {
  if (!Number.isInteger(to)) return undefined;
  const siblings = siblingUnits(order, columns, tree, unit, shown);
  const from = siblings.findIndex((s) => sameUnit(s.unit, unit));
  const moving = siblings[from];
  if (!moving || to === from || to < 0 || to >= siblings.length) return undefined;
  const byId = new Map(columns.map((c) => [c.id, c]));
  if (!moving.columns.every((id) => byId.get(id)?.reorderable)) return undefined;
  if (unit.kind === 'group' && tree.groups.get(unit.id)?.reorderable !== true) return undefined;
  const pinOf = new Map(columns.map((c) => [c.id, sideOf(c.pin)]));
  const current = normalizeOrder(order, columns, tree);
  const block = current.filter((id) => inUnit(unit, id, pinOf, tree));
  const next = current.filter((id) => !inUnit(unit, id, pinOf, tree));
  const others = siblings.filter((_, i) => i !== from);
  const before = others[to];
  const after = others.at(-1);
  let at = next.length;
  if (before) at = next.findIndex((id) => inUnit(before.unit, id, pinOf, tree));
  else if (after) at = next.findLastIndex((id) => inUnit(after.unit, id, pinOf, tree)) + 1;
  next.splice(at, 0, ...block);
  const result = normalizeOrder(next, columns, tree);
  return result.every((id, i) => id === current[i]) ? undefined : result;
}
