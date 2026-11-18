import {
  cellOver,
  headerGroupRows,
  resolveColumnGroups,
  type GroupTree,
  type HeaderGroupCell,
} from '../columns/column-groups.js';
import { moveUnit, normalizeOrder, siblingUnits } from '../columns/column-order.js';
import { resolveColumns, type ResolvedColumn } from '../columns/resolve-columns.js';
import { spreadWidth } from '../columns/spread-width.js';
import { distinctValues, rowPredicate } from '../filters/filter.js';
import { DisplayRows } from './display-rows.js';
import { sortRows } from './sorted-row-model.js';
import type {
  ColumnDef,
  ColumnOrderState,
  ColumnPin,
  ColumnSizingState,
  RowPin,
  SortState,
} from '../types.js';
import {
  EXPAND_COLUMN_ID,
  EXPAND_COLUMN_WIDTH,
  SELECTION_COLUMN_ID,
  SELECTION_COLUMN_WIDTH,
  type ColumnView,
  type TableModel,
  type TableModelOptions,
} from './model-types.js';

export * from './model-types.js';

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
 * A system column's view (the selection or the toggle column): pinned to the start
 * ahead of the data columns, fixed, and inert to sorting, sizing and moves.
 */
function systemView<TData, TContent>(
  kind: 'selection' | 'expand',
  colIndex: number,
  offset: number,
  pinEdge: boolean,
): ColumnView<TData, TContent> {
  const width = kind === 'selection' ? SELECTION_COLUMN_WIDTH : EXPAND_COLUMN_WIDTH;
  return {
    id: kind === 'selection' ? SELECTION_COLUMN_ID : EXPAND_COLUMN_ID,
    kind,
    colIndex,
    pin: 'start',
    offset,
    pinEdge,
    hidden: false,
    width,
    ownWidth: width,
    flex: undefined,
    auto: false,
    minWidth: width,
    maxWidth: width,
    sortable: false,
    resizable: false,
    reorderable: false,
    pinnable: false,
    hideable: false,
    filter: undefined,
    filtered: false,
    align: 'center',
    wrap: false,
    sorted: false,
    header: undefined,
    cell: undefined,
    meta: undefined,
    hasAccessor: false,
  };
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
  ): ColumnPin | undefined => {
    const state = pinning?.[column.id];
    if (state === 'start' || state === 'end') return state;
    return state === false ? undefined : column.pin;
  };
  const hiddenOf = (
    column: ResolvedColumn<TData, TContent>,
    visibility = options.columnVisibility,
  ): boolean => {
    const state = visibility?.[column.id];
    return typeof state === 'boolean' ? !state : column.hidden;
  };
  const shown = (id: string) => {
    const column = byId.get(id);
    return column !== undefined && !hiddenOf(column);
  };
  // The sizing state in effect: measured auto widths and the widths of pinned flex columns
  // under the resized ones. Kept stable between updates that don't touch them.
  let sizing: ColumnSizingState | undefined;
  const sizingState = (): ColumnSizingState => {
    if (sizing) return sizing;
    const auto = options.autoWidths;
    const merged: ColumnSizingState = {};
    let any = false;
    for (const column of resolved) {
      // A pinned column can't flex: it takes a fixed width for its sticky offsets.
      if (column.flex !== undefined && pinOf(column) !== undefined) {
        merged[column.id] = column.pinnedWidth;
        any = true;
      }
      const px = auto?.[column.id];
      if (!column.auto || px === undefined || !Number.isFinite(px)) continue;
      merged[column.id] = Math.min(column.maxWidth, Math.max(column.minWidth, px));
      any = true;
    }
    return (sizing = any ? { ...merged, ...options.columnSizing } : options.columnSizing);
  };
  // What ordering needs, with the pin in effect.
  const orderable = () =>
    resolved.map((c) => ({ id: c.id, pin: pinOf(c), reorderable: c.reorderable }));
  // The normalized order, kept stable between updates that touch neither columns,
  // order nor pinning.
  let order: ColumnOrderState | undefined;
  const orderState = (): ColumnOrderState =>
    (order ??= normalizeOrder(options.columnOrder ?? [], orderable(), tree));
  // Built lazily per row order (a sort, a filter or new data gives a new array).
  let indexById: { rows: readonly number[]; map: Map<string, number> } | undefined;

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

  // The rows are indexes into `data`: no object per row (ADR 0010). Each step keeps
  // its array while what it reads is the same, so `rowOrder` keeps its identity.
  // A new `getRowId` gives a new array too: the ids at each index changed.
  let all: { data: readonly TData[]; getRowId: unknown; rows: number[] } | undefined;
  const allRows = (): readonly number[] => {
    const { data, getRowId } = options;
    if (all?.data !== data || all.getRowId !== getRowId) {
      const rows = new Array<number>(data.length);
      for (let i = 0; i < rows.length; i++) rows[i] = i;
      all = { data, getRowId, rows };
    }
    return all.rows;
  };
  let filtered:
    | { source: readonly number[]; test: unknown; version: number; rows: readonly number[] }
    | undefined;
  const filteredRows = (): readonly number[] => {
    const source = allRows();
    const test = predicate;
    if (!test) return source;
    const prev = filtered;
    if (prev?.source === source && prev.test === test && prev.version === valueVersion) {
      return prev.rows;
    }
    const { data } = options;
    const rows = source.filter((i) => test(data[i] as TData, i));
    filtered = { source, test, version: valueVersion, rows };
    return rows;
  };
  let sorted:
    | { source: readonly number[]; sorting: SortState; version: number; rows: readonly number[] }
    | undefined;
  // The body rows in the current order. Remote rows aren't here: the model reads them
  // from `options.remote`.
  const rows = (): readonly number[] => {
    if (options.remote) return [];
    const source = filteredRows();
    const { sorting } = options;
    const prev = sorted;
    if (prev?.source === source && prev.sorting === sorting && prev.version === valueVersion) {
      return prev.rows;
    }
    const result = sortRows(options.data, source, sorting, (id) => byId.get(id));
    sorted = { source, sorting, version: valueVersion, rows: result };
    return result;
  };
  const rowIdOf = (dataIndex: number): string =>
    options.getRowId
      ? options.getRowId(options.data[dataIndex] as TData, dataIndex)
      : String(dataIndex);
  const pinned = (side: RowPin): readonly TData[] => options.pinnedRows?.[side] ?? [];

  /** The row object at an index of the current order; `undefined` for a remote row not loaded. */
  const rowObjectAt = (index: number): TData | undefined => {
    if (options.remote) return options.remote.entryAt(index)?.row;
    const row = rows()[index];
    return row === undefined ? undefined : options.data[row];
  };
  const expandableAt = (index: number): boolean => {
    if (!options.detail) return false;
    const row = rowObjectAt(index);
    return row !== undefined && (options.rowExpandable?.(row) ?? true);
  };
  const indexOfId = (rowId: string): number | undefined => {
    if (options.remote) return options.remote.indexOf(rowId);
    const current = rows();
    if (indexById?.rows !== current) {
      indexById = { rows: current, map: new Map(current.map((r, i) => [rowIdOf(r), i])) };
    }
    return indexById.map.get(rowId);
  };
  // The displayed rows, kept while what they read is the same: with remote rows,
  // their `version` (rows load without a new order). A remote without one is built
  // again on each read, keeping the previous object when nothing differs.
  let display: { key: readonly unknown[] | undefined; rows: DisplayRows } | undefined;
  const displayRows = (): DisplayRows => {
    const count = options.remote?.rowCount ?? rows().length;
    const { remote } = options;
    const key = remote
      ? remote.version === undefined
        ? undefined
        : [remote, remote.version, options.expanded, options.rowExpandable, options.detail]
      : [rows(), options.expanded, options.rowExpandable, options.detail];
    const prev = display;
    if (key && prev?.key?.every((part, i) => part === key[i])) return prev.rows;
    const open: number[] = [];
    if (options.detail) {
      for (const id of options.expanded ?? []) {
        const index = indexOfId(id);
        if (index !== undefined && expandableAt(index)) open.push(index);
      }
    }
    const next = new DisplayRows(count, open);
    const same =
      prev?.rows.count === next.count &&
      prev.rows.dataCount === next.dataCount &&
      prev.rows.open.every((index, i) => index === next.open[i]);
    display = { key, rows: same ? prev.rows : next };
    return display.rows;
  };

  // The width in effect: the sizing state's (resized, measured, pinned flex), else
  // the column's own, within its bounds.
  const widthOf = (id: string) => {
    const column = byId.get(id);
    if (!column) return 0;
    const state = sizingState();
    const px = Object.hasOwn(state, id) ? state[id] : undefined;
    return Math.min(Math.max(column.minWidth, px ?? column.width), column.maxWidth);
  };
  const view = (
    def: ResolvedColumn<TData, TContent>,
    colIndex: number,
    offset: number,
    pinEdge: boolean,
    stretched?: number,
  ): ColumnView<TData, TContent> => {
    const sort = options.sorting.find((s) => s.id === def.id);
    const pin = pinOf(def);
    const resized = options.columnSizing[def.id] !== undefined;
    return {
      id: def.id,
      kind: 'data',
      colIndex,
      pin,
      offset,
      pinEdge,
      hidden: colIndex === 0,
      width: stretched ?? widthOf(def.id),
      ownWidth: widthOf(def.id),
      flex: pin === undefined && !resized ? def.flex : undefined,
      auto: def.auto && !resized,
      minWidth: def.minWidth,
      maxWidth: def.maxWidth,
      sortable: def.sortable,
      resizable: def.resizable,
      reorderable: def.reorderable,
      pinnable: def.pinnable,
      hideable: def.hideable,
      filter: def.filter,
      filtered: options.columnFilters?.[def.id] !== undefined,
      align: def.align,
      wrap: def.wrap,
      sorted: sort ? (sort.desc ? 'desc' : 'asc') : false,
      header: def.header,
      cell: def.cell,
      meta: def.meta,
      hasAccessor: def.hasAccessor,
    };
  };

  // The scrolling columns' rendered widths when the table stretches them (`stretch`),
  // by id; columns not listed render at their own width.
  const stretchedWidths = (
    start: readonly ResolvedColumn<TData, TContent>[],
    center: readonly ResolvedColumn<TData, TContent>[],
    end: readonly ResolvedColumn<TData, TContent>[],
  ): Map<string, number> => {
    const stretch = options.stretch;
    if (!stretch || center.length === 0) return new Map();
    const sizing = options.columnSizing;
    const resized = (def: ResolvedColumn<TData, TContent>) => sizing[def.id] !== undefined;
    // An unresized flex column takes the free space through its grid track.
    if (center.some((def) => def.flex !== undefined && !resized(def))) return new Map();
    const systemPx =
      (options.selectionColumn ? SELECTION_COLUMN_WIDTH : 0) +
      (options.detail ? EXPAND_COLUMN_WIDTH : 0);
    const own = [...start, ...center, ...end].reduce((sum, def) => sum + widthOf(def.id), 0);
    // Whole px, so fractional own widths never overflow the width.
    const free = Math.floor(stretch.width - systemPx - own);
    if (free <= 0) return new Map();
    // The unresized columns share the space in proportion, up to their maxWidth.
    const spread = center
      .filter((def) => !resized(def))
      .map((def) => {
        const width = widthOf(def.id);
        return { id: def.id, width, minWidth: width, maxWidth: Math.max(width, def.maxWidth) };
      });
    const widths = spread.length
      ? spreadWidth(spread, spread.reduce((sum, c) => sum + c.width, 0) + free)
      : new Map<string, number>();
    let left = free - spread.reduce((sum, c) => sum + (widths.get(c.id) ?? c.width) - c.width, 0);
    // What they can't take goes to the last columns that can, skipping the ones
    // resized last (they keep the width they were given).
    const keep = new Set(stretch.keep);
    for (let i = center.length - 1; i >= 0 && left > 0; i--) {
      const def = center[i];
      if (!def || keep.has(def.id)) continue;
      const now = widths.get(def.id) ?? widthOf(def.id);
      const add = Math.min(left, Math.max(0, def.maxWidth - now));
      if (add > 0) widths.set(def.id, now + add);
      left -= add;
    }
    return widths;
  };

  const buildViews = (): ColumnView<TData, TContent>[] => {
    const groups: Record<ColumnPin | 'center', ResolvedColumn<TData, TContent>[]> = {
      start: [],
      center: [],
      end: [],
    };
    for (const id of orderState()) {
      const def = byId.get(id);
      if (def && !hiddenOf(def)) groups[pinOf(def) ?? 'center'].push(def);
    }
    const { start, center, end } = groups;
    // The system columns come first (the selection column, then the toggle column):
    // they shift every column on, and the start-pinned ones by their widths.
    const system: ('selection' | 'expand')[] = [];
    if (options.selectionColumn) system.push('selection');
    if (options.detail) system.push('expand');
    for (const id of [SELECTION_COLUMN_ID, EXPAND_COLUMN_ID]) {
      if (system.length && byId.has(id)) {
        throw new Error(`argus-table: the column id '${id}' is reserved.`);
      }
    }
    const lead = system.length;
    const stretched = stretchedWidths(start, center, end);
    const systemViews: ColumnView<TData, TContent>[] = [];
    let x = 0;
    for (const [i, kind] of system.entries()) {
      const v = systemView<TData, TContent>(kind, i + 1, x, i === lead - 1 && start.length === 0);
      systemViews.push(v);
      x += v.width;
    }
    // Offsets: start columns from the start edge (after the system columns), the
    // scrolling ones within the scrolling area, end columns from the end edge.
    const list = start.map((def, i) => {
      const v = view(def, lead + i + 1, x, i === start.length - 1);
      x += v.width;
      return v;
    });
    x = 0;
    for (const [i, def] of center.entries()) {
      const v = view(def, lead + start.length + i + 1, x, false, stretched.get(def.id));
      list.push(v);
      x += v.width;
    }
    const ends: ColumnView<TData, TContent>[] = [];
    x = 0;
    for (const [i, def] of [...end.entries()].reverse()) {
      const v = view(def, lead + start.length + center.length + i + 1, x, i === 0);
      ends.unshift(v);
      x += v.width;
    }
    list.push(...ends);
    list.unshift(...systemViews);
    return list;
  };

  let allViews: ColumnView<TData, TContent>[] | undefined;
  const buildAllViews = (shownViews: readonly ColumnView<TData, TContent>[]) => {
    const byShownId = new Map(shownViews.map((v) => [v.id, v]));
    return orderState().flatMap((id) => {
      const shownView = byShownId.get(id);
      if (shownView) return [shownView];
      const def = byId.get(id);
      return def ? [view(def, 0, 0, false)] : [];
    });
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
      return (views ??= buildViews());
    },

    get allColumns() {
      return (allViews ??= buildAllViews(this.columns));
    },

    get rowCount() {
      return options.remote?.rowCount ?? rows().length;
    },
    get rowOrder() {
      return options.remote ?? rows();
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
      return { id: rowIdOf(row), index, original: options.data[row] as TData };
    },

    indexOf(rowId) {
      return indexOfId(rowId);
    },

    get display() {
      return displayRows();
    },

    expandable(index) {
      return expandableAt(index);
    },

    nextExpanded(rowId, open, base = options.expanded ?? []) {
      const index = indexOfId(rowId);
      if (index === undefined || !expandableAt(index)) return undefined;
      const has = base.includes(rowId);
      if (has === open) return undefined;
      return open ? [...base, rowId] : base.filter((id) => id !== rowId);
    },

    selectableIds() {
      if (options.remote) return options.remote.loadedIds();
      return rows().map(rowIdOf);
    },

    valueAt(index, columnId) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        return entry && byId.get(columnId)?.getValue(entry.row, index);
      }
      const row = rows()[index];
      return row === undefined
        ? undefined
        : byId.get(columnId)?.getValue(options.data[row] as TData, row);
    },

    readValue(row, columnId, index) {
      return byId.get(columnId)?.getValue(row, index);
    },

    cellContext(index, columnId) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        const column = byId.get(columnId);
        if (!entry || !column) return undefined;
        return {
          row: entry.row,
          rowId: entry.id,
          index,
          columnId,
          value: column.getValue(entry.row, index),
        };
      }
      const row = rows()[index];
      const column = byId.get(columnId);
      if (row === undefined || !column) return undefined;
      const original = options.data[row] as TData;
      return {
        row: original,
        rowId: rowIdOf(row),
        index,
        columnId,
        value: column.getValue(original, row),
      };
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
      return distinctValues(options.data, column, predicateFor(new Set([columnId])), limit);
    },

    indexesPassing(except) {
      if (options.remote) return undefined;
      const keep = predicateFor(new Set(except), true);
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
