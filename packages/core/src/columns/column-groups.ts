import type { ColumnGroup, ColumnPin } from '../types.js';

/** A group of `columnGroups`, resolved. */
export interface GroupNode<TContent> {
  id: string;
  header: ColumnGroup<TContent>['header'];
  /** The enclosing group's id, `undefined` at the top. */
  parent: string | undefined;
  /** Nesting depth: 0 for a top-level group. It is also the header row the group shows in. */
  depth: number;
  /** Position in a depth-first walk of `columnGroups`: a stable number for the group. */
  ordinal: number;
}

/** `columnGroups` resolved against the columns. */
export interface GroupTree<TContent> {
  readonly groups: ReadonlyMap<string, GroupNode<TContent>>;
  /** The ids of the groups around a column, outermost first; empty for an ungrouped column. */
  pathOf(columnId: string): readonly string[];
}

const NO_PATH: readonly string[] = [];

/** A tree without groups. */
export const EMPTY_TREE: GroupTree<never> = {
  groups: new Map(),
  pathOf: () => NO_PATH,
};

/**
 * Resolves `columnGroups` against the known column ids. Throws on a group without
 * an id or with an id used twice. Unknown column ids are ignored, a column listed
 * twice belongs to the first group that lists it (depth first), and a group left
 * without columns is dropped.
 */
export function resolveColumnGroups<TContent>(
  groups: readonly ColumnGroup<TContent>[] | undefined,
  columnIds: ReadonlySet<string>,
): GroupTree<TContent> {
  if (!groups?.length) return EMPTY_TREE;
  const seen = new Set<string>();
  const nodes = new Map<string, GroupNode<TContent>>();
  const paths = new Map<string, readonly string[]>();
  let ordinal = 0;
  // Returns whether the group kept any column.
  const visit = (group: ColumnGroup<TContent>, path: readonly string[]): boolean => {
    if (typeof group.id !== 'string' || group.id === '') {
      throw new Error('argus-table: a column group needs a non-empty string id.');
    }
    if (seen.has(group.id)) {
      throw new Error(`argus-table: column group id '${group.id}' is used more than once.`);
    }
    seen.add(group.id);
    const node: GroupNode<TContent> = {
      id: group.id,
      header: group.header,
      parent: path.at(-1),
      depth: path.length,
      ordinal: ordinal++,
    };
    const inner = [...path, group.id];
    let kept = false;
    // In plain JavaScript, `columns` may be missing and hold anything.
    const children = (group.columns as readonly unknown[] | undefined) ?? [];
    for (const child of children) {
      if (typeof child === 'string') {
        if (!columnIds.has(child) || paths.has(child)) continue;
        paths.set(child, inner);
        kept = true;
      } else if (child && typeof child === 'object') {
        kept = visit(child as ColumnGroup<TContent>, inner) || kept;
      }
    }
    if (kept) nodes.set(group.id, node);
    return kept;
  };
  for (const group of groups) visit(group, NO_PATH);
  if (!nodes.size) return EMPTY_TREE;
  return { groups: nodes, pathOf: (id) => paths.get(id) ?? NO_PATH };
}

/** What header rows need to know about a shown column (a `ColumnView` fits). */
export interface GroupedColumn {
  id: string;
  kind: 'data' | 'selection';
  colIndex: number;
  pin: ColumnPin | undefined;
  offset: number;
  pinEdge: boolean;
  reorderable: boolean;
}

/** A cell of a group header row: a group over its columns, or a filler over ungrouped ones. */
export interface HeaderGroupCell<TContent> {
  /** Unique within the header: the group and its pin side, or the filler's first column. */
  key: string;
  kind: 'group' | 'filler';
  /** The group's id; `undefined` for a filler. */
  groupId: string | undefined;
  header: ColumnGroup<TContent>['header'];
  /** The header row, 0-based from the top. */
  level: number;
  /** The shown columns under the cell, in visual order. */
  columns: readonly string[];
  /** `aria-colindex` of the first column. */
  colIndex: number;
  /** Number of columns under the cell (`aria-colspan`). */
  span: number;
  pin: ColumnPin | undefined;
  /** Sticky inset in px, as `ColumnView.offset`: the start edge's for start-pinned cells, the end edge's for end-pinned ones. */
  offset: number;
  /** `true` when the cell ends at the edge of its pinned side, next to the scrolling area. */
  pinEdge: boolean;
  /** A number unique to the group and its pin side, stable while `columnGroups` is, for slot names. `-1` for a filler. */
  slot: number;
  /** `true` for a group whose shown columns can all be moved. */
  movable: boolean;
}

const SIDES = { start: 0, center: 1, end: 2 } as const;
const sideOf = (pin: ColumnPin | undefined) => pin ?? 'center';

/** The `key` of a group's cell on one pin side. */
export const groupKey = (groupId: string, pin: ColumnPin | undefined) =>
  `g:${sideOf(pin)}:${groupId}`;

/** Number of header rows above the column headers: the deepest nesting among the shown columns. */
export function groupDepth(tree: GroupTree<unknown>, columns: readonly { id: string }[]): number {
  if (!tree.groups.size) return 0;
  return columns.reduce((depth, c) => Math.max(depth, tree.pathOf(c.id).length), 0);
}

/**
 * The group header rows over the shown columns (in visual order), top row first.
 * In each row, consecutive columns of the same group and pin side share a cell; columns
 * without a group at that level share a filler. Empty without groups.
 */
export function headerGroupRows<TContent>(
  tree: GroupTree<TContent>,
  columns: readonly GroupedColumn[],
): HeaderGroupCell<TContent>[][] {
  const depth = groupDepth(tree, columns);
  const rows: HeaderGroupCell<TContent>[][] = [];
  for (let level = 0; level < depth; level++) {
    const row: HeaderGroupCell<TContent>[] = [];
    let open: { cell: HeaderGroupCell<TContent>; members: GroupedColumn[] } | undefined;
    const close = () => {
      if (!open) return;
      const { cell, members } = open;
      const first = members[0];
      const last = members.at(-1);
      open = undefined;
      if (!first || !last) return;
      cell.columns = members.map((c) => c.id);
      cell.span = members.length;
      cell.offset = cell.pin === 'end' ? last.offset : first.offset;
      cell.pinEdge = cell.pin === 'end' ? first.pinEdge : last.pinEdge;
      cell.movable =
        cell.kind === 'group' && members.every((c) => c.kind === 'data' && c.reorderable);
      row.push(cell);
    };
    for (const column of columns) {
      const groupId = tree.pathOf(column.id)[level];
      const side = sideOf(column.pin);
      if (open && open.cell.groupId === groupId && sideOf(open.cell.pin) === side) {
        open.members.push(column);
        continue;
      }
      close();
      const node = groupId === undefined ? undefined : tree.groups.get(groupId);
      open = {
        members: [column],
        cell: {
          key: node ? groupKey(node.id, column.pin) : `f:${String(level)}:${column.id}`,
          kind: node ? 'group' : 'filler',
          groupId: node?.id,
          header: node?.header,
          level,
          columns: [],
          colIndex: column.colIndex,
          span: 0,
          pin: column.pin,
          offset: 0,
          pinEdge: false,
          slot: node ? node.ordinal * 3 + SIDES[side] : -1,
          movable: false,
        },
      };
    }
    close();
    rows.push(row);
  }
  return rows;
}

/** The cell of a header row over a column, or `undefined`. */
export function cellOver<TContent>(
  rows: readonly (readonly HeaderGroupCell<TContent>[])[],
  level: number,
  columnId: string,
): HeaderGroupCell<TContent> | undefined {
  return rows[level]?.find((c) => c.columns.includes(columnId));
}
