import { cellOver } from '../columns/column-groups.js';
import { moveUnit, normalizeOrder, siblingUnits } from '../columns/column-order.js';
import { distinctValues, rowPredicate } from '../filters/filter.js';
import { BranchSelection } from './branch-selection.js';
import {
  nextFilters,
  nextPinning,
  nextSizing,
  nextSorting,
  nextVisibility,
} from './column-proposals.js';
import { ColumnState } from './column-state.js';
import { pinnedCellContext, pinnedCount, pinnedRowAt, pinnedValueAt } from './pinned-rows.js';
import { RowPipeline } from './row-pipeline.js';
import { ModelRows, type RowStructure } from './row-structure.js';
import { keepWithAncestors, type TreeLayout } from './tree-order.js';
import type { CellContext, GroupRowInfo } from '../types.js';
import type { TableModel, TableModelOptions } from './model-types.js';

export * from './model-types.js';

/**
 * Whether an update changes anything: a key of `next` whose value differs.
 */
function hasChanges<TData, TContent>(
  options: TableModelOptions<TData, TContent>,
  next: Partial<TableModelOptions<TData, TContent>>,
): boolean {
  return (Object.keys(next) as (keyof typeof next)[]).some((key) => next[key] !== options[key]);
}

/** Whether rows are filtered again: the filters, the quick filter or what it reads changed. */
function refilters<TData, TContent>(
  prev: TableModelOptions<TData, TContent>,
  next: TableModelOptions<TData, TContent>,
): boolean {
  return (
    next.columns !== prev.columns ||
    next.columnFilters !== prev.columnFilters ||
    next.quickFilter !== prev.quickFilter ||
    next.columnVisibility !== prev.columnVisibility ||
    next.remote !== prev.remote
  );
}

/**
 * Creates the table model. It owns no state: sorting, sizing, order, pinning and
 * visibility come in through `update()`, and the `next*()` methods only propose
 * changes, so the caller decides (controlled or uncontrolled) whether to apply them.
 *
 * Hidden columns stay in the model, so their values still sort and read; only the
 * views leave them out.
 */
export function createTableModel<TData, TContent>(
  initial: TableModelOptions<TData, TContent>,
): TableModel<TData, TContent> {
  let options = initial;
  const columns = new ColumnState<TData, TContent>(() => options);
  // The row test of the filters, the quick filter and the shown columns (which the quick
  // filter reads). Remote rows are filtered by their source.
  // `except`: columns whose filter is left out; with `quick`, their text is left out
  // of the quick filter too.
  const predicateFor = (except?: ReadonlySet<string>, quick = false) =>
    options.remote
      ? undefined
      : rowPredicate(
          columns.byId,
          options.columnFilters,
          options.quickFilter,
          columns.resolved.filter(
            (c) => c.hasAccessor && !columns.hiddenOf(c) && !(quick && except?.has(c.id)),
          ),
          except,
        );
  let predicate = predicateFor();
  // Bumped when a column keeps its id but reads its values differently (a new
  // accessor): the rows, filters and sorting are the same, but which rows pass and
  // their order may not be.
  let valueVersion = 0;

  const pipeline = new RowPipeline<TData, TContent>(
    () => options,
    () => columns.byId,
    () => predicate,
    () => valueVersion,
  );
  const rows = () => pipeline.rows();
  // How the shown rows are arranged: a remote that arranges its own (`RemoteTree`),
  // else the model's own reading of `data` or a flat remote.
  const local = new ModelRows<TData, TContent>(pipeline, () => options);
  const structure = (): RowStructure => options.remote?.structure ?? local;
  const branches = new BranchSelection(structure, () => Boolean(options.remote?.structure));
  /**
   * The source index of the local data row at a shown index; `-1` past the
   * rows, or for a group row (group rows come after the data rows and have no
   * row object).
   */
  const dataRow = (index: number): number => {
    const row = rows()[index];
    return row === undefined || row >= pipeline.source().length ? -1 : row;
  };

  // `groupedOrder()`'s rows, per layout.
  let groupedOrder:
    | {
        layout: TreeLayout;
        rows: readonly {
          index: number;
          id: string;
          depth: number;
          group: GroupRowInfo | undefined;
        }[];
      }
    | undefined;

  return {
    update(next) {
      if (!hasChanges(options, next)) return;
      const merged = { ...options, ...next };
      const reread = columns.update(next, merged);
      const refilter = refilters(options, merged);
      options = merged;
      if (refilter) predicate = predicateFor();
      // Columns that now read differently: filter and sort again.
      if (reread.length && !options.remote) valueVersion++;
    },

    get columns() {
      return columns.views();
    },

    get allColumns() {
      return columns.allViews();
    },

    get rowCount() {
      return options.remote?.rowCount ?? rows().length;
    },
    get rowOrder() {
      const { remote } = options;
      return remote ? (remote.order ?? remote) : rows();
    },

    get totalWidth() {
      return this.columns.reduce((sum, column) => sum + column.width, 0);
    },

    get headerGroups() {
      return columns.headerGroups();
    },

    get headerRows() {
      return this.headerGroups.length + 1;
    },

    headerCell(level, columnId) {
      return cellOver(this.headerGroups, level, columnId);
    },

    rowAt(index) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        return entry && { id: entry.id, index, original: entry.row };
      }
      const row = dataRow(index);
      if (row === -1) return undefined;
      return { id: pipeline.rowId(row), index, original: pipeline.source()[row] as TData };
    },

    get tree() {
      // Asked first: it warns about tree functions ignored with remote rows.
      return pipeline.shape() !== undefined || structure().tree;
    },

    treeRow(index) {
      return structure().treeRow(index);
    },

    nextTreeExpanded(rowId, open, base = options.treeExpanded ?? []) {
      if (!structure().mayToggle(rowId, open) || base.includes(rowId) === open) return undefined;
      return open ? [...base, rowId] : base.filter((id) => id !== rowId);
    },

    shownAncestor(rowId) {
      return structure().shownAncestor(rowId);
    },

    get rows() {
      return structure();
    },

    sourceRow(index) {
      // A data source's rows have no source indexes (`data` isn't read).
      return options.remote ? undefined : pipeline.source()[index];
    },

    groupedOrder() {
      const grouped = pipeline.groups();
      const layout = grouped && pipeline.treeSteps()?.layout;
      if (!grouped || !layout) return undefined;
      if (groupedOrder?.layout !== layout) {
        const rows = Array.from(layout.order, (row) => ({
          index: row,
          id: grouped.ids[row] ?? '',
          depth: grouped.depth[row] ?? 0,
          group: grouped.info(row),
        }));
        groupedOrder = { layout, rows };
      }
      return groupedOrder.rows;
    },

    indexOf(rowId) {
      return pipeline.indexOf(rowId);
    },

    get display() {
      return pipeline.display();
    },

    expandable(index) {
      return pipeline.expandable(index);
    },

    nextExpanded(rowId, open, base = options.expanded ?? []) {
      const index = pipeline.indexOf(rowId);
      if (index === undefined || !pipeline.expandable(index)) return undefined;
      const has = base.includes(rowId);
      if (has === open) return undefined;
      return open ? [...base, rowId] : base.filter((id) => id !== rowId);
    },

    selectableIds() {
      if (options.remote) return options.remote.loadedIds();
      const ids = rows().map((r) => pipeline.rowId(r));
      // Not group rows (after the data rows): their ids are never selected.
      const grouped = pipeline.groups();
      return grouped ? ids.filter((_, k) => (rows()[k] ?? 0) < grouped.size) : ids;
    },

    branchSelectAll(current, selected = new Set(current)) {
      return branches.selectAll(current, selected);
    },

    branchTree() {
      return branches.tree();
    },

    branchCheck(selected) {
      return branches.checks(selected).check;
    },

    branchCheckAll(selected) {
      return branches.checks(selected).all;
    },

    valueAt(index, columnId) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        return entry && columns.byId.get(columnId)?.getValue(entry.row, index);
      }
      const row = dataRow(index);
      if (row === -1) return undefined;
      return columns.byId.get(columnId)?.getValue(pipeline.source()[row] as TData, row);
    },

    readValue(row, columnId, index) {
      return columns.byId.get(columnId)?.getValue(row, index);
    },

    cellContext(index, columnId) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        const column = columns.byId.get(columnId);
        if (!entry || !column) return undefined;
        const context: CellContext<TData> = {
          row: entry.row,
          rowId: entry.id,
          index,
          columnId,
          value: column.getValue(entry.row, index),
        };
        // No `depth` key without a tree, as for `data`.
        const rows = structure();
        if (rows.tree) context.depth = rows.depthAt(index) ?? 0;
        return context;
      }
      const row = rows()[index];
      const column = columns.byId.get(columnId);
      const tree = pipeline.shape();
      // Without a tree or groups, straight from `data` (read per cell).
      const source = tree ? pipeline.source() : options.data;
      // A group row's cells are `groupCell`'s.
      if (row === undefined || !column || row >= source.length) return undefined;
      const original = source[row] as TData;
      const context: CellContext<TData> = {
        row: original,
        rowId: pipeline.rowId(row),
        index,
        columnId,
        value: column.getValue(original, row),
      };
      // No `depth` key without a tree: contexts stay as they were.
      if (tree) context.depth = tree.depth[row] ?? 0;
      return context;
    },

    nextSorting(columnId) {
      return nextSorting(columns.byId, options.sorting, columnId);
    },

    nextSizing(columnId, width) {
      return nextSizing(columns.byId, options.columnSizing, columnId, width);
    },

    orderOf(base) {
      return base === undefined
        ? columns.orderState()
        : normalizeOrder(base, columns.orderable(), columns.tree);
    },

    siblingUnits(unit, base) {
      const order = base ?? columns.orderState();
      return siblingUnits(order, columns.orderable(), columns.tree, unit, columns.shown);
    },

    nextMove(unit, to, base) {
      const order = base ?? columns.orderState();
      return moveUnit(order, columns.orderable(), columns.tree, unit, to, columns.shown);
    },

    nextPinning(columnId, pin, base = options.columnPinning) {
      return nextPinning(columns.byId, columnId, pin, base);
    },

    nextVisibility(columnId, hidden, base = options.columnVisibility) {
      return nextVisibility(columns.resolved, columns.byId, columnId, hidden, base);
    },

    nextFilters(columnId, filter, base = options.columnFilters ?? {}) {
      return nextFilters(columns.byId, columnId, filter, base);
    },

    filterValues(columnId, limit = 1000) {
      const column = columns.byId.get(columnId);
      if (!column) return undefined;
      if (column.filterOptions) return { values: [...column.filterOptions], truncated: false };
      if (options.remote) return undefined;
      // A tree's child rows offer their values too.
      return distinctValues(pipeline.source(), column, predicateFor(new Set([columnId])), limit);
    },

    indexesPassing(except) {
      if (options.remote) return undefined;
      const keep = predicateFor(new Set(except), true);
      const tree = pipeline.tree();
      if (tree) return keepWithAncestors(tree, keep).rows;
      const kept: number[] = [];
      const { data } = options;
      for (let i = 0; i < data.length; i++) {
        if (!keep || keep(data[i] as TData, i)) kept.push(i);
      }
      return kept;
    },

    pinnedCount(side) {
      return pinnedCount(options, side);
    },

    pinnedRowAt(side, index) {
      return pinnedRowAt(options, side, index);
    },

    pinnedValueAt(side, index, columnId) {
      return pinnedValueAt(options, columns.byId.get(columnId), side, index);
    },

    pinnedCellContext(side, index, columnId) {
      return pinnedCellContext(options, columns.byId.get(columnId), side, index, columnId);
    },
  };
}
