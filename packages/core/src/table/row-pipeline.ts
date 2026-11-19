import type { ResolvedColumn } from '../columns/resolve-columns.js';
import type { RowPredicate } from '../filters/filter.js';
import { DisplayRows } from './display-rows.js';
import type { TableModelOptions } from './model-types.js';
import { buildRowTree, type RowTree } from './row-tree.js';
import { sortRows } from './sorted-row-model.js';
import {
  keepWithAncestors,
  layoutTree,
  showOpen,
  type KeptRows,
  type TreeLayout,
} from './tree-order.js';
import type { SortState, TreeExpandedState } from '../types.js';

/** A tree's layout with what its rows need from it. */
export interface TreeSteps<TData> {
  tree: RowTree<TData>;
  layout: TreeLayout;
  /** The kept top-level rows. */
  roots: number;
  holdsMatch: Uint8Array | undefined;
}

/**
 * The body's rows: indexes into `data`, no object per row (ADR 0010). All rows,
 * the ones the filters keep, those in the sort order, and the displayed rows
 * (data rows and open detail panels). Each step keeps its array while what it
 * reads is the same, so `rows()` keeps its identity. Remote rows aren't here:
 * the model reads them from `options.remote`.
 *
 * When the rows form a tree (`getSubRows` or `getParentId`), the indexes are
 * source indexes (`RowTree`) and three steps replace filtering and sorting: keep
 * the rows the filters pass with their ancestors, sort them all at once and lay
 * them out depth-first by parent, then drop the rows under collapsed ones. The
 * last step alone runs when a row is expanded or collapsed.
 */
export class RowPipeline<TData, TContent> {
  readonly #options: () => TableModelOptions<TData, TContent>;
  readonly #byId: () => ReadonlyMap<string, ResolvedColumn<TData, TContent>>;
  /** The row test of the filters and the quick filter; `undefined` when nothing filters. */
  readonly #predicate: () => RowPredicate<TData> | undefined;
  /** Bumped when a column reads its values differently: filter and sort again. */
  readonly #version: () => number;

  // A new `getRowId` gives a new array too: the ids at each index changed.
  #all: { data: readonly TData[]; getRowId: unknown; rows: number[] } | undefined;
  #filtered:
    | { source: readonly number[]; test: unknown; version: number; rows: readonly number[] }
    | undefined;
  #sorted:
    | { source: readonly number[]; sorting: SortState; version: number; rows: readonly number[] }
    | undefined;
  // Built lazily per row order (a sort, a filter or new data gives a new array).
  #indexById: { rows: readonly number[]; map: Map<string, number> } | undefined;
  #display: { key: readonly unknown[] | undefined; rows: DisplayRows } | undefined;

  #tree:
    | {
        data: readonly TData[];
        sub: unknown;
        parent: unknown;
        getRowId: unknown;
        tree: RowTree<TData>;
      }
    | undefined;
  #kept: { tree: RowTree<TData>; test: unknown; version: number; kept: KeptRows } | undefined;
  #layout:
    | {
        kept: KeptRows;
        sorting: SortState;
        version: number;
        sorted: readonly number[];
        steps: TreeSteps<TData>;
      }
    | undefined;
  #expandedSet: { state: TreeExpandedState | undefined; set: ReadonlySet<string> } | undefined;
  #shown:
    { steps: TreeSteps<TData>; expanded: ReadonlySet<string>; rows: readonly number[] } | undefined;
  // Each source row's index in the shown order (-1 when not shown), built lazily per order.
  #orderIndex: { rows: readonly number[]; at: Int32Array } | undefined;
  #warnedBoth = false;
  #warnedRemote = false;

  constructor(
    options: () => TableModelOptions<TData, TContent>,
    byId: () => ReadonlyMap<string, ResolvedColumn<TData, TContent>>,
    predicate: () => RowPredicate<TData> | undefined,
    version: () => number,
  ) {
    this.#options = options;
    this.#byId = byId;
    this.#predicate = predicate;
    this.#version = version;
  }

  /**
   * The rows' tree, built once per `data`, `getSubRows`, `getParentId` and
   * `getRowId`; `undefined` (nothing allocated) when the rows don't form one.
   * Trees with a data source come later (children loaded per row): until then
   * the tree functions are ignored with remote rows, with one warning.
   */
  tree(): RowTree<TData> | undefined {
    const { data, getSubRows, getParentId, getRowId, remote } = this.#options();
    if (!getSubRows && !getParentId) return undefined;
    if (remote) {
      if (!this.#warnedRemote) {
        this.#warnedRemote = true;
        console.warn(
          'argus-table: getSubRows and getParentId are ignored with a dataSource; its rows are shown flat.',
        );
      }
      return undefined;
    }
    const prev = this.#tree;
    if (
      prev?.data === data &&
      prev.sub === getSubRows &&
      prev.parent === getParentId &&
      prev.getRowId === getRowId
    ) {
      return prev.tree;
    }
    if (getSubRows && getParentId && !this.#warnedBoth) {
      this.#warnedBoth = true;
      console.warn('argus-table: getSubRows and getParentId are both set; getSubRows is used.');
    }
    const tree = buildRowTree(data, { getSubRows, getParentId }, getRowId);
    this.#tree = { data, sub: getSubRows, parent: getParentId, getRowId, tree };
    return tree;
  }

  /** The rows by source index: the tree's, else `data`. */
  source(): readonly TData[] {
    return this.tree()?.rows ?? this.#options().data;
  }

  #keptRows(tree: RowTree<TData>): KeptRows {
    const test = this.#predicate();
    // Without a test the version changes nothing.
    const version = test ? this.#version() : 0;
    const prev = this.#kept;
    if (prev?.tree === tree && prev.test === test && prev.version === version) return prev.kept;
    const kept = keepWithAncestors(tree, test);
    this.#kept = { tree, test, version, kept };
    return kept;
  }

  /** The tree's kept rows laid out in sort order; `undefined` without a tree. */
  treeSteps(): TreeSteps<TData> | undefined {
    const tree = this.tree();
    if (!tree) return undefined;
    const kept = this.#keptRows(tree);
    const { sorting } = this.#options();
    const version = this.#version();
    const prev = this.#layout;
    if (prev?.kept === kept && prev.sorting === sorting && prev.version === version) {
      return prev.steps;
    }
    const byId = this.#byId();
    // One sort over every kept row (ascending, so the radix sort applies), then
    // bucketed by parent: each sibling group ends up in sort order.
    const sorted = sortRows(tree.rows, kept.rows, sorting, (id) => byId.get(id));
    // Nothing sorts (`sortRows` gives back its input): the layout is the same.
    if (prev?.sorted === sorted) {
      this.#layout = { ...prev, sorting, version };
      return prev.steps;
    }
    const layout = layoutTree(tree, sorted);
    const steps = {
      tree,
      layout,
      roots: layout.children(-1).length,
      holdsMatch: kept.holdsMatch,
    };
    this.#layout = { kept, sorting, version, sorted, steps };
    return steps;
  }

  #expanded(): ReadonlySet<string> {
    const { treeExpanded } = this.#options();
    const prev = this.#expandedSet;
    if (prev && prev.state === treeExpanded) return prev.set;
    const set = new Set(treeExpanded);
    // The same ids in a new array keep the Set, and so the shown rows and `rowOrder`.
    const same = prev?.set.size === set.size && [...set].every((id) => prev.set.has(id));
    this.#expandedSet = { state: treeExpanded, set: same ? prev.set : set };
    return this.#expandedSet.set;
  }

  /** Whether a row (a source index) with kept children is shown open. */
  #isOpen(steps: TreeSteps<TData>, expanded: ReadonlySet<string>, row: number): boolean {
    return expanded.has(steps.tree.ids[row] ?? '') || steps.holdsMatch?.[row] === 1;
  }

  /** Whether a row (a source index) shows its children: it has kept ones and is open. */
  treeOpen(row: number): boolean {
    const steps = this.treeSteps();
    if (!steps || (steps.layout.keptChildren[row] ?? 0) === 0) return false;
    return this.#isOpen(steps, this.#expanded(), row);
  }

  #shownRows(steps: TreeSteps<TData>): readonly number[] {
    const expanded = this.#expanded();
    const prev = this.#shown;
    if (prev?.steps === steps && prev.expanded === expanded) return prev.rows;
    const rows = showOpen(steps.tree, steps.layout, (row) => this.#isOpen(steps, expanded, row));
    this.#shown = { steps, expanded, rows };
    return rows;
  }

  /** The index in the current order of a row (a source index), or -1 when it isn't shown. */
  orderIndexOf(row: number): number {
    const current = this.rows();
    if (this.#orderIndex?.rows !== current) {
      const at = new Int32Array(this.source().length).fill(-1);
      for (let k = 0; k < current.length; k++) at[current[k] ?? 0] = k;
      this.#orderIndex = { rows: current, at };
    }
    return this.#orderIndex.at[row] ?? -1;
  }

  #allRows(): readonly number[] {
    const { data, getRowId } = this.#options();
    const all = this.#all;
    if (all?.data !== data || all.getRowId !== getRowId) {
      const rows = new Array<number>(data.length);
      for (let i = 0; i < rows.length; i++) rows[i] = i;
      this.#all = { data, getRowId, rows };
      return rows;
    }
    return all.rows;
  }

  #filteredRows(): readonly number[] {
    const source = this.#allRows();
    const test = this.#predicate();
    if (!test) return source;
    const version = this.#version();
    const prev = this.#filtered;
    if (prev?.source === source && prev.test === test && prev.version === version) {
      return prev.rows;
    }
    const { data } = this.#options();
    const rows = source.filter((i) => test(data[i] as TData, i));
    this.#filtered = { source, test, version, rows };
    return rows;
  }

  /** The body rows in the current order (data indexes); `[]` with remote rows. */
  rows(): readonly number[] {
    const options = this.#options();
    if (options.remote) return [];
    const steps = this.treeSteps();
    if (steps) return this.#shownRows(steps);
    const source = this.#filteredRows();
    const { sorting } = options;
    const version = this.#version();
    const prev = this.#sorted;
    if (prev?.source === source && prev.sorting === sorting && prev.version === version) {
      return prev.rows;
    }
    const byId = this.#byId();
    const result = sortRows(options.data, source, sorting, (id) => byId.get(id));
    this.#sorted = { source, sorting, version, rows: result };
    return result;
  }

  /** The id of the row at a data index (a source index with a tree). */
  rowId(dataIndex: number): string {
    const tree = this.tree();
    return tree ? (tree.ids[dataIndex] ?? '') : this.#flatId(dataIndex);
  }

  /** The id of the row at a data index when there is no tree. */
  #flatId(dataIndex: number): string {
    const { data, getRowId } = this.#options();
    return getRowId ? getRowId(data[dataIndex] as TData, dataIndex) : String(dataIndex);
  }

  /** The row object at an index of the current order; `undefined` for a remote row not loaded. */
  rowAt(index: number): TData | undefined {
    const options = this.#options();
    if (options.remote) return options.remote.entryAt(index)?.row;
    const row = this.rows()[index];
    return row === undefined ? undefined : this.source()[row];
  }

  /** The index in the current order of a row id. */
  indexOf(rowId: string): number | undefined {
    const { remote } = this.#options();
    if (remote) return remote.indexOf(rowId);
    // A tree's ids are mapped once per tree, not once per shown order.
    const tree = this.tree();
    if (tree) {
      const row = tree.indexOf(rowId);
      if (row === undefined) return undefined;
      const index = this.orderIndexOf(row);
      return index === -1 ? undefined : index;
    }
    const current = this.rows();
    if (this.#indexById?.rows !== current) {
      this.#indexById = {
        rows: current,
        map: new Map(current.map((r, i) => [this.#flatId(r), i])),
      };
    }
    return this.#indexById.map.get(rowId);
  }

  /** Whether the row at an index of the current order can open a detail panel. */
  expandable(index: number): boolean {
    const options = this.#options();
    if (!options.detail) return false;
    const row = this.rowAt(index);
    return row !== undefined && (options.rowExpandable?.(row) ?? true);
  }

  /**
   * The displayed rows, kept while what they read is the same: with remote rows,
   * their `version` (rows load without a new order). A remote without one is built
   * again on each read, keeping the previous object when nothing differs.
   */
  display(): DisplayRows {
    const options = this.#options();
    const { remote } = options;
    const count = remote?.rowCount ?? this.rows().length;
    const key = remote
      ? remote.version === undefined
        ? undefined
        : [remote, remote.version, options.expanded, options.rowExpandable, options.detail]
      : [this.rows(), options.expanded, options.rowExpandable, options.detail];
    const prev = this.#display;
    if (key && prev?.key?.every((part, i) => part === key[i])) return prev.rows;
    const open: number[] = [];
    if (options.detail) {
      for (const id of options.expanded ?? []) {
        const index = this.indexOf(id);
        if (index !== undefined && this.expandable(index)) open.push(index);
      }
    }
    const next = new DisplayRows(count, open);
    const same =
      prev?.rows.count === next.count &&
      prev.rows.dataCount === next.dataCount &&
      prev.rows.open.every((index, i) => index === next.open[i]);
    this.#display = { key, rows: same ? prev.rows : next };
    return this.#display.rows;
  }
}
