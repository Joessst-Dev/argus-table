import {
  cellOver,
  headerGroupRows,
  resolveColumnGroups,
  type GroupTree,
  type HeaderGroupCell,
} from '../columns/column-groups.js';
import { moveUnit, normalizeOrder, siblingUnits } from '../columns/column-order.js';
import { resolveColumns, type ResolvedColumn } from '../columns/resolve-columns.js';
import { distinctValues, rowPredicate } from '../filters/filter.js';
import { buildAllViews, buildViews, hiddenIn, pinIn, sizingOf } from './column-views.js';
import { RowPipeline } from './row-pipeline.js';
import type { RowTree } from './row-tree.js';
import { keepWithAncestors, type TreeLayout } from './tree-order.js';
import type { BranchCheck, BranchTree } from '../state/selection.js';
import type {
  CellContext,
  ColumnDef,
  ColumnOrderState,
  ColumnPin,
  ColumnSizingState,
  RowPin,
} from '../types.js';
import type { ColumnView, TableModel, TableModelOptions } from './model-types.js';

export * from './model-types.js';

/**
 * `branchCheck`'s marks of a subtree: some row the user can tick is selected
 * (`PICKED`) or isn't (`MISSED`), some row can be ticked (`LIVE`), some row is
 * blocked (`DEAD`: ticking it could select nothing), some row that can be
 * ticked doesn't count as checked (`UNMET`).
 */
const PICKED = 1;
const MISSED = 2;
const LIVE = 4;
const DEAD = 8;
const UNMET = 16;

/**
 * Ids of the columns kept from `before` whose accessor changed: a new function,
 * or a different path. A new column has nothing cached and isn't listed.
 */
function changedAccessors<TData, TContent>(
  before: readonly ColumnDef<TData, TContent>[],
  after: readonly ColumnDef<TData, TContent>[],
): string[] {
  const old = new Map(before.map((c) => [c.id, c.accessor]));
  return after.filter((c) => old.has(c.id) && old.get(c.id) !== c.accessor).map((c) => c.id);
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
  let resolved = resolveColumns(options.columns);
  let byId = new Map(resolved.map((c) => [c.id, c]));
  let views: ColumnView<TData, TContent>[] | undefined;
  const treeOf = () =>
    resolveColumnGroups(options.columnGroups, new Set(resolved.map((c) => c.id)));
  let tree: GroupTree<TContent> = treeOf();
  // The group header rows, kept while the tree and what they read of the views stay.
  let groupRows:
    | {
        views: readonly ColumnView<TData, TContent>[];
        tree: GroupTree<TContent>;
        key: string;
        rows: HeaderGroupCell<TContent>[][];
      }
    | undefined;
  // The pin and visibility in effect: the state's, else the column's own.
  const pinOf = (
    column: ResolvedColumn<TData, TContent>,
    pinning = options.columnPinning,
  ): ColumnPin | undefined => pinIn(column, pinning);
  const hiddenOf = (
    column: ResolvedColumn<TData, TContent>,
    visibility = options.columnVisibility,
  ): boolean => hiddenIn(column, visibility);
  const shown = (id: string) => {
    const column = byId.get(id);
    return column !== undefined && !hiddenOf(column);
  };
  // The sizing state in effect: measured auto widths and the widths of pinned flex columns
  // under the resized ones. Kept stable between updates that don't touch them.
  let sizing: ColumnSizingState | undefined;
  const sizingState = (): ColumnSizingState => (sizing ??= sizingOf(options, resolved));
  // What ordering needs, with the pin in effect.
  const orderable = () =>
    resolved.map((c) => ({ id: c.id, pin: pinOf(c), reorderable: c.reorderable }));
  // The normalized order, kept stable between updates that touch neither columns,
  // order nor pinning.
  let order: ColumnOrderState | undefined;
  const orderState = (): ColumnOrderState =>
    (order ??= normalizeOrder(options.columnOrder ?? [], orderable(), tree));
  // The row test of the filters, the quick filter and the shown columns (which the quick
  // filter reads). Remote rows are filtered by their source.
  // `except`: columns whose filter is left out; with `quick`, their text is left out
  // of the quick filter too.
  const predicateFor = (except?: ReadonlySet<string>, quick = false) =>
    options.remote
      ? undefined
      : rowPredicate(
          byId,
          options.columnFilters,
          options.quickFilter,
          resolved.filter((c) => c.hasAccessor && !hiddenOf(c) && !(quick && except?.has(c.id))),
          except,
        );
  let predicate = predicateFor();
  // Bumped when a column keeps its id but reads its values differently (a new
  // accessor): the rows, filters and sorting are the same, but which rows pass and
  // their order may not be.
  let valueVersion = 0;

  const pipeline = new RowPipeline<TData, TContent>(
    () => options,
    () => byId,
    () => predicate,
    () => valueVersion,
  );
  const rows = () => pipeline.rows();
  // The remote rows when they form a tree (`RemoteTree`).
  const remoteTree = () => (options.remote?.treeRow ? options.remote : undefined);
  const pinned = (side: RowPin): readonly TData[] => options.pinnedRows?.[side] ?? [];

  let allViews: ColumnView<TData, TContent>[] | undefined;

  // Branch selection, kept per tree layout (a filter or sort result).
  let branches: { layout: TreeLayout; tree: BranchTree } | undefined;
  let checks:
    | {
        layout: TreeLayout | undefined;
        selected: ReadonlySet<string>;
        check: (index: number) => BranchCheck;
        all: BranchCheck;
      }
    | undefined;
  // Every row's children in the whole tree (filters not applied), by source
  // index: `kids[start[i]]` up to `kids[start[i + 1]]`. Built per tree, the
  // first time a filter hides some row's children.
  let family: { tree: RowTree<TData>; start: Int32Array; kids: Int32Array } | undefined;
  const familyOf = (tree: RowTree<TData>) => {
    if (family?.tree !== tree) {
      const { parent, childCount } = tree;
      const n = parent.length;
      const start = new Int32Array(n + 1);
      for (let i = 0; i < n; i++) start[i + 1] = (start[i] ?? 0) + (childCount[i] ?? 0);
      const kids = new Int32Array(start[n] ?? 0);
      const fill = start.slice(0, n);
      for (let i = 0; i < n; i++) {
        const up = parent[i] ?? -1;
        if (up !== -1) kids[(fill[up] = (fill[up] ?? 0) + 1) - 1] = i;
      }
      family = { tree, start, kids };
    }
    return family;
  };
  // A row's children in the whole tree, when the filters hide some.
  const fullKids = (tree: RowTree<TData>, layout: TreeLayout, row: number) => {
    if ((layout.keptChildren[row] ?? 0) === (tree.childCount[row] ?? 0)) return undefined;
    const { start, kids } = familyOf(tree);
    return kids.subarray(start[row] ?? 0, start[row + 1] ?? 0);
  };
  // Whether a row has a child the filters hide that isn't selected.
  const missesHidden = (
    tree: RowTree<TData>,
    layout: TreeLayout,
    row: number,
    selected: ReadonlySet<string>,
  ) =>
    fullKids(tree, layout, row)?.some(
      (kid) => (layout.posInSet[kid] ?? 0) === 0 && !selected.has(tree.ids[kid] ?? ''),
    ) ?? false;

  /**
   * Each kept row's checkbox for a selection, and the select-all checkbox's,
   * in one pass over the kept rows, preorder backwards (every row comes after
   * its descendants). Kept per selection `Set` and layout.
   *
   * A row is blocked when ticking it could select nothing: its id isn't
   * selected, a descendant left unselected keeps it out (one the filters hide,
   * or a blocked one), and none of its kept descendants can be ticked. Blocked
   * rows count for nothing else: not as unselected rows of their ancestors'
   * branches, not for the select-all checkbox.
   */
  const checksFor = (selected: ReadonlySet<string>) => {
    const steps = pipeline.treeSteps();
    const layout = steps?.layout;
    if (checks?.selected === selected && checks.layout === layout) return checks;
    let check: (index: number) => BranchCheck = () => 'none';
    let all: BranchCheck = 'none';
    // Without a selection, only a filter can block rows.
    if (steps && (selected.size > 0 || steps.layout.order.length < steps.tree.ids.length)) {
      const { tree } = steps;
      const { parent, ids } = tree;
      const { order } = steps.layout;
      const marks = new Uint8Array(parent.length);
      for (let k = order.length - 1; k >= 0; k--) {
        const row = order[k] ?? 0;
        // Its kept descendants' marks, before its own joins them.
        const below = marks[row] ?? 0;
        const own = selected.has(ids[row] ?? '');
        // Its own id kept out by a descendant left unselected.
        const out = () =>
          below & (MISSED | DEAD) || missesHidden(tree, steps.layout, row, selected);
        let mark = below;
        if (!own && !(below & LIVE) && out()) mark |= DEAD;
        else {
          mark |= LIVE | (own ? PICKED : MISSED);
          // Checked (as `toggleBranch` decides): every row below that can be
          // ticked is, and its own id selected, or kept out with something
          // below to tick.
          if (below & UNMET || !(own || (below & LIVE && out()))) mark |= UNMET;
        }
        marks[row] = mark;
        const up = parent[row] ?? -1;
        if (up !== -1) marks[up] = (marks[up] ?? 0) | mark;
      }
      // The top-level kept rows' marks hold every row's.
      let top = 0;
      for (const row of steps.layout.children(-1)) top |= marks[row] ?? 0;
      check = (index) => {
        const row = rows()[index];
        const mark = row === undefined ? 0 : (marks[row] ?? 0);
        if (row !== undefined && !(mark & LIVE)) return 'blocked';
        return mark & PICKED ? (mark & MISSED ? 'some' : 'all') : 'none';
      };
      all = !(top & LIVE) ? 'blocked' : top & UNMET ? (top & PICKED ? 'some' : 'none') : 'all';
    }
    checks = { layout, selected, check, all };
    return checks;
  };

  return {
    update(next) {
      const merged = { ...options, ...next };
      const changed = (Object.keys(next) as (keyof typeof next)[]).some(
        (key) => next[key] !== options[key],
      );
      if (!changed) return;
      let reread: string[] = [];
      if (next.columns && next.columns !== options.columns) {
        reread = changedAccessors(options.columns, next.columns);
        resolved = resolveColumns(next.columns);
        byId = new Map(resolved.map((c) => [c.id, c]));
      }
      const columnsChanged = merged.columns !== options.columns;
      const pinningChanged = merged.columnPinning !== options.columnPinning;
      const groupsChanged = merged.columnGroups !== options.columnGroups;
      if (
        columnsChanged ||
        merged.columnSizing !== options.columnSizing ||
        merged.autoWidths !== options.autoWidths ||
        pinningChanged
      ) {
        sizing = undefined;
      }
      if (
        columnsChanged ||
        groupsChanged ||
        merged.columnOrder !== options.columnOrder ||
        pinningChanged
      ) {
        order = undefined;
      }
      const refilter =
        columnsChanged ||
        merged.columnFilters !== options.columnFilters ||
        merged.quickFilter !== options.quickFilter ||
        merged.columnVisibility !== options.columnVisibility ||
        merged.remote !== options.remote;
      options = merged;
      if (columnsChanged || groupsChanged) tree = treeOf();
      views = undefined;
      allViews = undefined;
      if (refilter) predicate = predicateFor();
      // Columns that now read differently: filter and sort again.
      if (reread.length && !options.remote) valueVersion++;
    },

    get columns() {
      return (views ??= buildViews(options, byId, orderState(), sizingState()));
    },

    get allColumns() {
      return (allViews ??= buildAllViews(options, byId, orderState(), sizingState(), this.columns));
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
      const current = this.columns;
      if (groupRows?.views === current && groupRows.tree === tree) return groupRows.rows;
      // Views are rebuilt on every update; the rows only change with what they read.
      const key = tree.groups.size
        ? current
            .map(
              (c) =>
                `${c.id}\u0000${String(c.pin)}\u0000${String(c.offset)}\u0000${String(c.pinEdge)}\u0000${String(c.reorderable)}\u0000${String(c.resizable)}`,
            )
            .join('\u0001')
        : '';
      if (groupRows?.tree !== tree || groupRows.key !== key) {
        groupRows = { views: current, tree, key, rows: headerGroupRows(tree, current) };
      } else {
        groupRows.views = current;
      }
      return groupRows.rows;
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
      const row = rows()[index];
      if (row === undefined) return undefined;
      return { id: pipeline.rowId(row), index, original: pipeline.source()[row] as TData };
    },

    get tree() {
      // Asked first: it warns about tree functions ignored with remote rows.
      return pipeline.tree() !== undefined || remoteTree() !== undefined;
    },

    treeRow(index) {
      if (options.remote) return options.remote.treeRow?.(index);
      const steps = pipeline.treeSteps();
      const row = steps && rows()[index];
      if (!steps || row === undefined) return undefined;
      const { tree, layout } = steps;
      const up = tree.parent[row] ?? -1;
      const hasChildren = (layout.keptChildren[row] ?? 0) > 0;
      // A shown row's parent is shown too (kept and open).
      const parent = up === -1 ? -1 : pipeline.orderIndexOf(up);
      return {
        depth: tree.depth[row] ?? 0,
        hasChildren,
        open: hasChildren && pipeline.treeOpen(row),
        forced: hasChildren && steps.holdsMatch?.[row] === 1,
        parent: parent === -1 ? undefined : parent,
        setSize: up === -1 ? steps.roots : (layout.keptChildren[up] ?? 0),
        posInSet: layout.posInSet[row] ?? 0,
      };
    },

    nextTreeExpanded(rowId, open, base = options.treeExpanded ?? []) {
      if (options.remote) {
        const remote = remoteTree();
        if (!remote || base.includes(rowId) === open) return undefined;
        // Closing needs no loaded row: an open id may be under a page not loaded.
        if (!open) return base.filter((id) => id !== rowId);
        return remote.canExpand?.(rowId) ? [...base, rowId] : undefined;
      }
      const tree = pipeline.tree();
      const row = tree?.indexOf(rowId);
      // Filters aren't applied: a controlled host's ids are never refused for one.
      if (!tree || row === undefined || (tree.childCount[row] ?? 0) === 0) return undefined;
      const has = base.includes(rowId);
      if (has === open) return undefined;
      return open ? [...base, rowId] : base.filter((id) => id !== rowId);
    },

    shownAncestor(rowId) {
      if (options.remote) return options.remote.shownAncestor?.(rowId);
      const tree = pipeline.tree();
      let row = tree?.indexOf(rowId);
      if (!tree || row === undefined) return undefined;
      while (row !== -1) {
        const index = pipeline.orderIndexOf(row);
        if (index !== -1) return index;
        row = tree.parent[row] ?? -1;
      }
      return undefined;
    },

    sourceRow(index) {
      return pipeline.source()[index];
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
      return rows().map((r) => pipeline.rowId(r));
    },

    branchSelectAll(current, selected = new Set(current)) {
      const steps = pipeline.treeSteps();
      if (!steps) return [...current];
      const { tree, layout } = steps;
      const { parent, ids } = tree;
      const { order } = layout;
      // Per kept row, 1 when its branch can't end up whole: a descendant the
      // filters hide isn't selected. Preorder backwards, children first.
      const broken = new Uint8Array(parent.length);
      const drop = new Set<string>();
      for (let k = order.length - 1; k >= 0; k--) {
        const row = order[k] ?? 0;
        if (!broken[row] && missesHidden(tree, layout, row, selected)) broken[row] = 1;
        if (!broken[row]) continue;
        const up = parent[row] ?? -1;
        if (up !== -1) broken[up] = 1;
        // Selected against the rules: normalized, as `withBranches` does.
        const id = ids[row] ?? '';
        if (selected.has(id)) drop.add(id);
      }
      const all = drop.size === 0 ? [...current] : current.filter((id) => !drop.has(id));
      for (const row of order) {
        const id = ids[row] ?? '';
        if (!broken[row] && !selected.has(id)) all.push(id);
      }
      return all;
    },

    branchTree() {
      const steps = pipeline.treeSteps();
      if (!steps) return undefined;
      const { tree, layout } = steps;
      if (branches?.layout === layout) return branches.tree;
      const idsOf = (kids: Int32Array): string[] => {
        const out = new Array<string>(kids.length);
        for (let k = 0; k < kids.length; k++) out[k] = tree.ids[kids[k] ?? 0] ?? '';
        return out;
      };
      const children = (id: string): string[] => {
        const row = tree.indexOf(id);
        // Rows the filters drop have no kept children.
        if (row === undefined || (layout.keptChildren[row] ?? 0) === 0) return [];
        return idsOf(layout.children(row));
      };
      const branchTree: BranchTree = {
        children,
        allChildren(id) {
          const row = tree.indexOf(id);
          const kids = row === undefined ? undefined : fullKids(tree, layout, row);
          return kids ? idsOf(kids) : children(id);
        },
        parent(id) {
          const row = tree.indexOf(id);
          // Only kept rows have a position among their siblings.
          if (row === undefined || (layout.posInSet[row] ?? 0) === 0) return undefined;
          const up = tree.parent[row] ?? -1;
          return up === -1 ? undefined : tree.ids[up];
        },
      };
      branches = { layout, tree: branchTree };
      return branchTree;
    },

    branchCheck(selected) {
      return checksFor(selected).check;
    },

    branchCheckAll(selected) {
      return checksFor(selected).all;
    },

    valueAt(index, columnId) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        return entry && byId.get(columnId)?.getValue(entry.row, index);
      }
      const row = rows()[index];
      return row === undefined
        ? undefined
        : byId.get(columnId)?.getValue(pipeline.source()[row] as TData, row);
    },

    readValue(row, columnId, index) {
      return byId.get(columnId)?.getValue(row, index);
    },

    cellContext(index, columnId) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        const column = byId.get(columnId);
        if (!entry || !column) return undefined;
        const context: CellContext<TData> = {
          row: entry.row,
          rowId: entry.id,
          index,
          columnId,
          value: column.getValue(entry.row, index),
        };
        // No `depth` key without a tree, as for `data`.
        const remote = remoteTree();
        if (remote) {
          context.depth = remote.depthAt?.(index) ?? remote.treeRow?.(index)?.depth ?? 0;
        }
        return context;
      }
      const row = rows()[index];
      const column = byId.get(columnId);
      if (row === undefined || !column) return undefined;
      const tree = pipeline.tree();
      const original = (tree ? tree.rows : options.data)[row] as TData;
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
      if (byId.get(columnId)?.sortable !== true) return undefined;
      const current = options.sorting.find((s) => s.id === columnId);
      if (!current) return [{ id: columnId, desc: false }];
      return current.desc ? [] : [{ id: columnId, desc: true }];
    },

    nextSizing(columnId, width) {
      const column = byId.get(columnId);
      if (!column?.resizable || !Number.isFinite(width)) return undefined;
      const clamped = Math.round(Math.min(column.maxWidth, Math.max(column.minWidth, width)));
      return { ...options.columnSizing, [columnId]: clamped };
    },

    orderOf(base) {
      return base === undefined ? orderState() : normalizeOrder(base, orderable(), tree);
    },

    siblingUnits(unit, base) {
      return siblingUnits(base ?? orderState(), orderable(), tree, unit, shown);
    },

    nextMove(unit, to, base) {
      return moveUnit(base ?? orderState(), orderable(), tree, unit, to, shown);
    },

    nextPinning(columnId, pin, base = options.columnPinning) {
      const column = byId.get(columnId);
      if (!column?.pinnable || (pinOf(column, base) ?? false) === pin) return undefined;
      return { ...base, [columnId]: pin };
    },

    nextVisibility(columnId, hidden, base = options.columnVisibility) {
      const column = byId.get(columnId);
      if (!column || hiddenOf(column, base) === hidden) return undefined;
      const othersShown = resolved.some((c) => c !== column && !hiddenOf(c, base));
      if (hidden && (!column.hideable || !othersShown)) return undefined;
      return { ...base, [columnId]: !hidden };
    },

    nextFilters(columnId, filter, base = options.columnFilters ?? {}) {
      const column = byId.get(columnId);
      if (!column) return undefined;
      const current = base[columnId];
      if (filter === undefined) {
        if (current === undefined) return undefined;
        const next = { ...base };
        Reflect.deleteProperty(next, columnId);
        return next;
      }
      if (column.filter === undefined) return undefined;
      if (current && JSON.stringify(current) === JSON.stringify(filter)) return undefined;
      return { ...base, [columnId]: filter };
    },

    filterValues(columnId, limit = 1000) {
      const column = byId.get(columnId);
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
      return pinned(side).length;
    },

    pinnedRowAt(side, index) {
      if (index < 0 || index >= pinned(side).length) return undefined;
      const row = pinned(side)[index] as TData;
      const id = options.getRowId ? options.getRowId(row, index) : `${side}-${String(index)}`;
      return { id, index, original: row };
    },

    pinnedValueAt(side, index, columnId) {
      if (index < 0 || index >= pinned(side).length) return undefined;
      return byId.get(columnId)?.getValue(pinned(side)[index] as TData, index);
    },

    pinnedCellContext(side, index, columnId) {
      const row = this.pinnedRowAt(side, index);
      const column = byId.get(columnId);
      if (!row || !column) return undefined;
      return {
        row: row.original,
        rowId: row.id,
        index,
        columnId,
        value: column.getValue(row.original, index),
        pinned: side,
      };
    },
  };
}
