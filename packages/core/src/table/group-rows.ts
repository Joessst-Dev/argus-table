import type { ResolvedColumn } from '../columns/resolve-columns.js';
import { isEmptyValue } from '../filters/filter.js';
import type { GroupRowInfo } from '../types.js';
import { aggregate } from './aggregate.js';
import type { RowTree } from './row-tree.js';
import { autoSortFn } from './sort-fns.js';

/**
 * Rows grouped by columns' values (`grouping`), as a tree the tree steps lay
 * out: source indexes `0 … size - 1` are the data rows (every row of `data`,
 * kept or not), the next `groups` are the group rows (outermost level first),
 * and after them one hidden child per group, never in the layout: like a row a
 * filter hides, it keeps the group's id out of branch selection. `rows[i]` is
 * `undefined` from `size` on.
 */
export interface GroupedRows<TData> extends RowTree<TData> {
  /** The number of data rows (`data.length`). */
  readonly size: number;
  /** The number of group rows. */
  readonly groups: number;
  /** The filtered data rows, ascending: what sorting starts from. */
  readonly filtered: readonly number[];
  /** The group rows' source indexes, ascending (each level's groups in value order). */
  readonly groupRows: readonly number[];
  /** A group row's information; `undefined` for other indexes. */
  info(row: number): GroupRowInfo | undefined;
  /**
   * A group row's sort key for a column: its value in the column it groups by,
   * its total in a column with an `aggregate`, else `undefined` (sorts last).
   */
  key(row: number, columnId: string): unknown;
}

type Column<TData> = Pick<ResolvedColumn<TData, unknown>, 'id' | 'getValue' | 'aggregate'>;

interface Group {
  info: GroupRowInfo;
  /** The source index of the parent group, `-1` at the top. */
  up: number;
  /** The data rows under the group, in data order. */
  members: number[];
  /** The id's path so far: column ids and keys. */
  path: unknown[];
}

/**
 * The value a row is grouped by: a date's time (an invalid date is empty), and
 * `null` for empty values; others as they are, compared like `Map` keys.
 */
function groupKey(value: unknown): unknown {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  return isEmptyValue(value) ? null : value;
}

/**
 * A key as it goes into a group's id (JSON): numbers JSON can't hold
 * (`Infinity`) and bigints as their text, objects by their text (they group by
 * identity; their ids may then collide: group by primitive values or dates).
 */
const idKey = (key: unknown) =>
  (typeof key === 'number' && !Number.isFinite(key)) || typeof key === 'bigint'
    ? String(key)
    : typeof key === 'object' && key !== null
      ? // eslint-disable-next-line @typescript-eslint/no-base-to-string
        String(key)
      : key;

/**
 * Groups the filtered rows of `data` by `grouping`, outermost first, with each
 * level's groups in ascending order of their values (the empty group last), and
 * totals the `totalled` columns per group over the rows under it. Reads each
 * grouping value once per row and each totalled value once per row. `dataIds`
 * are the data rows' ids (by data index) and `dataIndexOf` finds one, both kept
 * by the caller per `data`, so a regroup (a filter) doesn't redo them.
 */
export function buildGroups<TData>(
  data: readonly TData[],
  filtered: readonly number[],
  grouping: readonly Column<TData>[],
  totalled: readonly Column<TData>[],
  dataIds: readonly string[],
  dataIndexOf: (id: string) => number | undefined,
): GroupedRows<TData> {
  const size = data.length;
  const groups: Group[] = [];
  // The groups of the level being built, and the data rows' innermost groups.
  let level: { group: number; members: readonly number[]; path: unknown[] }[] = [
    { group: -1, members: filtered, path: [] },
  ];
  grouping.forEach((column, depth) => {
    const next: typeof level = [];
    for (const parent of level) {
      const buckets = new Map<unknown, { value: unknown; members: number[] }>();
      for (const i of parent.members) {
        const value = column.getValue(data[i] as TData, i);
        const key = groupKey(value);
        let bucket = buckets.get(key);
        if (!bucket)
          buckets.set(key, (bucket = { value: key === null ? undefined : value, members: [] }));
        bucket.members.push(i);
      }
      const entries = [...buckets];
      const { resolve, compare } = autoSortFn(entries.slice(0, 10).map(([, b]) => b.value));
      const sortable = (v: unknown) => (resolve ? resolve(v) : v);
      entries.sort(([a, x], [b, y]) =>
        a === null
          ? b === null
            ? 0
            : 1
          : b === null
            ? -1
            : compare(sortable(x.value), sortable(y.value)),
      );
      for (const [key, { value, members }] of entries) {
        const path = [...parent.path, column.id, idKey(key)];
        const row = size + groups.length;
        groups.push({
          info: {
            id: `\u0000g${JSON.stringify(path)}`,
            groupColumnId: column.id,
            value,
            count: members.length,
            depth,
            totals: {},
          },
          up: parent.group,
          members,
          path,
        });
        next.push({ group: row, members, path });
      }
    }
    level = next;
  });

  const g = groups.length;
  const total = size + 2 * g;
  const rows = data.concat(new Array<TData>(2 * g));
  const ids = dataIds.concat(new Array<string>(2 * g));
  const parent = new Int32Array(total).fill(-1);
  const depth = new Int32Array(total);
  const childCount = new Int32Array(total);
  const leafDepth = grouping.length;
  for (const { group, members } of level) {
    for (const i of members) {
      parent[i] = group;
      depth[i] = leafDepth;
    }
  }
  groups.forEach(({ info, up, members }, k) => {
    const row = size + k;
    const hidden = size + g + k;
    ids[row] = info.id;
    ids[hidden] = `\u0000${info.id}`;
    parent[row] = up;
    depth[row] = info.depth;
    parent[hidden] = row;
    depth[hidden] = info.depth + 1;
    // The hidden child, and data rows under the innermost groups; child groups
    // (numbered after their parent) add themselves.
    childCount[row] = 1 + (info.depth === leafDepth - 1 ? members.length : 0);
    if (up !== -1) childCount[up] = (childCount[up] ?? 0) + 1;
  });

  for (const column of totalled) {
    const kind = column.aggregate;
    if (!kind) continue;
    const values = new Array<unknown>(size);
    for (const i of filtered) values[i] = column.getValue(data[i] as TData, i);
    for (const { info, members } of groups) {
      (info.totals as Record<string, unknown>)[column.id] = aggregate(
        kind,
        members.map((i) => values[i]),
        () => members.map((i) => ids[i] ?? ''),
      );
    }
  }

  let byId: Map<string, number> | undefined;
  const groupRows = Array.from({ length: g }, (_, k) => size + k);
  return {
    rows,
    ids,
    parent,
    depth,
    childCount,
    size,
    groups: g,
    filtered,
    groupRows,
    indexOf(id) {
      if (!id.startsWith('\u0000')) return dataIndexOf(id);
      // Group rows and their hidden children: the only reserved ids here.
      byId ??= new Map(ids.slice(size).map((rowId, k) => [rowId, size + k]));
      return byId.get(id);
    },
    info: (row) => groups[row - size]?.info,
    key(row, columnId) {
      const info = groups[row - size]?.info;
      if (!info) return undefined;
      return info.groupColumnId === columnId ? info.value : info.totals[columnId];
    },
  };
}
