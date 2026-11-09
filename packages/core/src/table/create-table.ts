import {
  columnPinningFeature,
  columnSizingFeature,
  constructTable,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type Column,
  type ColumnDef as TanStackColumnDef,
  type Row,
  type Table,
  type TableOptions,
} from '@tanstack/table-core';
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings';
import { moveColumn, normalizeOrder } from '../columns/column-order.js';
import { resolveColumns, type ResolvedColumn } from '../columns/resolve-columns.js';
import { sortedRowModel } from './sorted-row-model.js';
import type {
  CellContext,
  ColumnAlign,
  ColumnDef,
  ColumnOrderState,
  ColumnPin,
  ColumnSizingState,
  PinnedRows,
  RowPin,
  SortState,
} from '../types.js';

// The TanStack adapter. Everything TanStack stays in this module: callers only see
// the view types below, so TanStack can be upgraded or replaced without touching
// `argus-table`'s public API.

const features = tableFeatures({
  // Vanilla (framework-free) reactivity; required by `constructTable`.
  coreReactivityFeature: storeReactivityBindings(),
  columnPinningFeature,
  columnSizingFeature,
  rowSortingFeature,
  // Our own: TanStack's is very slow in Firefox at scale (see sorted-row-model.ts).
  sortedRowModel: sortedRowModel(),
  // Registered by name so `sortFn: 'auto'` can pick one by value type.
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});
type Features = typeof features;
type AnyRow = Record<string, unknown>;

/** Sort direction of a column, or `false` when it isn't sorted. */
export type SortDirection = 'asc' | 'desc' | false;

/** A column as the renderer sees it, in visual order: start-pinned, scrolling, end-pinned. */
export interface ColumnView<TData, TContent> {
  id: string;
  /** 1-based position in visual order, for `aria-colindex`. */
  colIndex: number;
  pin: ColumnPin | undefined;
  /**
   * Sticky inset in px: from the start edge for `'start'` columns, from the end edge
   * for `'end'` columns. For scrolling columns, the start within the scrolling area.
   */
  offset: number;
  /** `true` on the pinned column next to the scrolling area (one per pinned side). */
  pinEdge: boolean;
  /** Current width in px (a resized width wins over the column's own). */
  width: number;
  /** Share of free space, or `undefined` for a fixed width. A resized column stops flexing. */
  flex: number | undefined;
  /**
   * `true` for a `width: 'auto'` column that hasn't been resized: the table measures
   * its content and passes the width in as `autoWidths`.
   */
  auto: boolean;
  minWidth: number;
  maxWidth: number;
  sortable: boolean;
  resizable: boolean;
  reorderable: boolean;
  align: ColumnAlign;
  sorted: SortDirection;
  header: ColumnDef<TData, TContent>['header'];
  cell: ColumnDef<TData, TContent>['cell'];
  hasAccessor: boolean;
}

/** A row of the current (sorted) row model. */
export interface RowView<TData> {
  id: string;
  /** Index in the current row model, 0-based. */
  index: number;
  original: TData;
}

/**
 * Rows that live outside the model, loaded page by page (`dataSource`). The
 * source sorts them, so the model reads them as they are. `PageCache` implements it.
 */
export interface RemoteRows<TData> {
  readonly rowCount: number;
  /** The loaded row at an index, with its id; `undefined` while it isn't loaded. */
  entryAt(index: number): { id: string; row: TData } | undefined;
  /** The index of a loaded row's id, or `undefined`. */
  indexOf(rowId: string): number | undefined;
  /** The ids of every loaded row, in row order. */
  loadedIds(): string[];
}

export interface TableModelOptions<TData, TContent> {
  columns: readonly ColumnDef<TData, TContent>[];
  data: readonly TData[];
  /**
   * Remote rows. When set, rows come from here instead of `data`, and the model
   * doesn't sort them (the source does).
   */
  remote?: RemoteRows<TData> | undefined;
  /** Row id function. Default: the row's index in `data`, as a string. */
  getRowId: ((row: TData, index: number) => string) | undefined;
  /** Current sort state; its owner is the caller (see `controllable`). */
  sorting: SortState;
  /** Current resized widths; its owner is the caller. */
  columnSizing: ColumnSizingState;
  /**
   * Current column order; its owner is the caller. Each pin group follows it; an
   * empty array (the default) keeps the order of `columns`.
   */
  columnOrder?: ColumnOrderState | undefined;
  /**
   * Measured widths of `width: 'auto'` columns, in px by id. Clamped to the column's
   * bounds; a resized width wins. Ids of other columns are ignored.
   */
  autoWidths?: ColumnSizingState | undefined;
  /** Rows fixed above or below the body. They stay out of the row model: never sorted, not counted. */
  pinnedRows?: PinnedRows<TData> | undefined;
}

export interface TableModel<TData, TContent> {
  /** Updates any subset of the options. Unchanged references are ignored. */
  update(options: Partial<TableModelOptions<TData, TContent>>): void;
  /** Columns in visual order. */
  readonly columns: readonly ColumnView<TData, TContent>[];
  /** Number of rows in the current row model. */
  readonly rowCount: number;
  /** Sum of all column widths in px (flex columns count their minimum). */
  readonly totalWidth: number;
  /** The row at an index of the current row model; `undefined` for a remote row not loaded yet. */
  rowAt(index: number): RowView<TData> | undefined;
  /** The index of a row id in the current row model (after sorting), or `undefined`. */
  indexOf(rowId: string): number | undefined;
  /**
   * The ids of the rows that can be selected, in row order: every row of the row
   * model, or only the loaded ones for remote rows.
   */
  selectableIds(): string[];
  /** The value a column reads from the row at `index`. */
  valueAt(index: number, columnId: string): unknown;
  /** What a column's `cell` function receives for the row at `index`. */
  cellContext(index: number, columnId: string): CellContext<TData> | undefined;
  /**
   * The sort state that clicking this column's header would produce:
   * asc → desc → unsorted, one column at a time. `undefined` if it can't sort.
   */
  nextSorting(columnId: string): SortState | undefined;
  /**
   * The sizing state after setting a column to `width` px, clamped to its bounds.
   * `undefined` if the column can't be resized.
   */
  nextSizing(columnId: string, width: number): ColumnSizingState | undefined;
  /**
   * The full column order as the table shows it: start-pinned, scrolling and
   * end-pinned ids. `base` defaults to the current `columnOrder`.
   */
  orderOf(base?: readonly string[]): ColumnOrderState;
  /**
   * The order after moving a column to position `to` (0-based, in the whole order,
   * counted after the move), starting from `base` (default: the current order).
   * `undefined` if the column can't move, `to` is outside its pin group, or nothing changes.
   */
  nextOrder(columnId: string, to: number, base?: readonly string[]): ColumnOrderState | undefined;
  /** Number of rows pinned to a side. */
  pinnedCount(side: RowPin): number;
  /**
   * A pinned row, `index` counted within its side. Its id comes from `getRowId`,
   * else it is `'top-{index}'` or `'bottom-{index}'`, apart from the data rows' index ids.
   */
  pinnedRowAt(side: RowPin, index: number): RowView<TData> | undefined;
  /** The value a column reads from a pinned row. */
  pinnedValueAt(side: RowPin, index: number, columnId: string): unknown;
  /** What a column's `cell` function receives for a pinned row (with `pinned` set). */
  pinnedCellContext(side: RowPin, index: number, columnId: string): CellContext<TData> | undefined;
}

const defaultRowId = (_row: unknown, index: number) => String(index);

function toTanStack<TData, TContent>(
  column: ResolvedColumn<TData, TContent>,
): TanStackColumnDef<Features, AnyRow> {
  return {
    id: column.id,
    accessorFn: column.getValue as (row: AnyRow, index: number) => unknown,
    size: column.width,
    minSize: column.minWidth,
    maxSize: column.maxWidth,
    enableSorting: column.sortable,
    sortUndefined: 'last',
  };
}

/**
 * Creates the table model over TanStack Table. It owns no state: sorting, sizing and order
 * come in through `update()`, and `nextSorting()`, `nextSizing()` and `nextOrder()` only propose
 * changes, so the caller decides (controlled or uncontrolled) whether to apply them.
 */
export function createTableModel<TData, TContent>(
  initial: TableModelOptions<TData, TContent>,
): TableModel<TData, TContent> {
  let options = initial;
  let resolved = resolveColumns(options.columns);
  let byId = new Map(resolved.map((c) => [c.id, c]));
  // TanStack column defs by id, kept between updates that don't change `columns`.
  let tanStackById = new Map(resolved.map((c) => [c.id, toTanStack(c)]));
  let views: ColumnView<TData, TContent>[] | undefined;
  // TanStack's sizing state: measured auto widths under the resized ones. Kept stable
  // between updates that don't touch either.
  let sizing: ColumnSizingState | undefined;
  const sizingState = (): ColumnSizingState => {
    if (sizing) return sizing;
    const auto = options.autoWidths;
    if (!auto) return (sizing = options.columnSizing);
    const merged: ColumnSizingState = {};
    for (const column of resolved) {
      const px = auto[column.id];
      if (!column.auto || px === undefined || !Number.isFinite(px)) continue;
      merged[column.id] = Math.min(column.maxWidth, Math.max(column.minWidth, px));
    }
    return (sizing = { ...merged, ...options.columnSizing });
  };
  // The normalized order, kept stable between updates that touch neither columns nor order.
  let order: ColumnOrderState | undefined;
  const orderState = (): ColumnOrderState =>
    (order ??= normalizeOrder(options.columnOrder ?? [], resolved));
  const rowViews = new WeakMap<Row<Features, AnyRow>, RowView<TData>>();
  // Built lazily per row model (sorting or new data gives a new array).
  let indexById: { rows: readonly Row<Features, AnyRow>[]; map: Map<string, number> } | undefined;

  // The order reaches TanStack as the order of its column defs (the scrolling
  // columns follow it) and of the pinning arrays (the pinned ones do). Rebuilt only
  // when the order changes: a new columns array makes TanStack rebuild its columns,
  // though not its row models, which depend on data and sorting alone.
  let ordered:
    | {
        order: ColumnOrderState;
        columns: TanStackColumnDef<Features, AnyRow>[];
        pinning: { start: string[]; end: string[] };
      }
    | undefined;
  const orderedColumns = () => {
    const current = orderState();
    if (ordered?.order !== current) {
      const pinOf = (id: string) => byId.get(id)?.pin;
      ordered = {
        order: current,
        columns: current.flatMap((id) => tanStackById.get(id) ?? []),
        pinning: {
          start: current.filter((id) => pinOf(id) === 'start'),
          end: current.filter((id) => pinOf(id) === 'end'),
        },
      };
    }
    return ordered;
  };

  const tableOptions = (): TableOptions<Features, AnyRow> => ({
    features,
    columns: orderedColumns().columns,
    // Remote rows bypass TanStack's row models; it still handles columns and state.
    data: (options.remote ? [] : options.data) as AnyRow[],
    getRowId: (options.getRowId ?? defaultRowId) as (row: AnyRow, index: number) => string,
    state: {
      sorting: options.sorting,
      columnSizing: sizingState(),
      columnPinning: orderedColumns().pinning,
    },
    // State is owned by the caller; TanStack's own setters must not change it.
    onSortingChange: () => undefined,
    onColumnSizingChange: () => undefined,
    onColumnPinningChange: () => undefined,
  });

  const table: Table<Features, AnyRow> = constructTable(tableOptions());

  const rows = () => table.getRowModel().rows;
  const pinned = (side: RowPin): readonly TData[] => options.pinnedRows?.[side] ?? [];

  const buildViews = (): ColumnView<TData, TContent>[] => {
    const start = table.getStartLeafColumns();
    const center = table.getCenterLeafColumns();
    const end = table.getEndLeafColumns();
    const sorting = options.sorting;
    const view = (
      column: Column<Features, AnyRow>,
      colIndex: number,
      offset: number,
      pinEdge: boolean,
    ): ColumnView<TData, TContent> => {
      const def = byId.get(column.id);
      if (!def) throw new Error(`argus-table: unknown column '${column.id}'.`);
      const sort = sorting.find((s) => s.id === column.id);
      return {
        id: def.id,
        colIndex,
        pin: def.pin,
        offset,
        pinEdge,
        width: column.getSize(),
        flex: options.columnSizing[def.id] === undefined ? def.flex : undefined,
        auto: def.auto && options.columnSizing[def.id] === undefined,
        minWidth: def.minWidth,
        maxWidth: def.maxWidth,
        sortable: def.sortable,
        resizable: def.resizable,
        reorderable: def.reorderable,
        align: def.align,
        sorted: sort ? (sort.desc ? 'desc' : 'asc') : false,
        header: def.header,
        cell: def.cell,
        hasAccessor: def.hasAccessor,
      };
    };
    return [
      ...start.map((c, i) => view(c, i + 1, c.getStart('start'), i === start.length - 1)),
      ...center.map((c, i) => view(c, start.length + i + 1, c.getStart('center'), false)),
      ...end.map((c, i) =>
        view(c, start.length + center.length + i + 1, c.getAfter('end'), i === 0),
      ),
    ];
  };

  return {
    update(next) {
      const merged = { ...options, ...next };
      const changed = (Object.keys(next) as (keyof typeof next)[]).some(
        (key) => next[key] !== options[key],
      );
      if (!changed) return;
      if (next.columns && next.columns !== options.columns) {
        resolved = resolveColumns(next.columns);
        byId = new Map(resolved.map((c) => [c.id, c]));
        tanStackById = new Map(resolved.map((c) => [c.id, toTanStack(c)]));
      }
      if (
        merged.columns !== options.columns ||
        merged.columnSizing !== options.columnSizing ||
        merged.autoWidths !== options.autoWidths
      ) {
        sizing = undefined;
      }
      if (merged.columns !== options.columns || merged.columnOrder !== options.columnOrder) {
        order = undefined;
      }
      options = merged;
      views = undefined;
      table.setOptions((prev) => ({ ...prev, ...tableOptions() }));
    },

    get columns() {
      return (views ??= buildViews());
    },

    get rowCount() {
      return options.remote?.rowCount ?? rows().length;
    },

    get totalWidth() {
      return table.getTotalSize();
    },

    rowAt(index) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        return entry && { id: entry.id, index, original: entry.row };
      }
      const row = rows()[index];
      if (!row) return undefined;
      let view = rowViews.get(row);
      if (view?.index !== index) {
        view = { id: row.id, index, original: row.original as TData };
        rowViews.set(row, view);
      }
      return view;
    },

    indexOf(rowId) {
      if (options.remote) return options.remote.indexOf(rowId);
      const current = rows();
      if (indexById?.rows !== current) {
        indexById = { rows: current, map: new Map(current.map((r, i) => [r.id, i])) };
      }
      return indexById.map.get(rowId);
    },

    selectableIds() {
      if (options.remote) return options.remote.loadedIds();
      return rows().map((r) => r.id);
    },

    valueAt(index, columnId) {
      if (options.remote) {
        const entry = options.remote.entryAt(index);
        return entry && byId.get(columnId)?.getValue(entry.row, index);
      }
      return rows()[index]?.getValue(columnId);
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
      if (!row || !byId.has(columnId)) return undefined;
      return {
        row: row.original as TData,
        rowId: row.id,
        index,
        columnId,
        value: row.getValue(columnId),
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
      return base === undefined ? orderState() : normalizeOrder(base, resolved);
    },

    nextOrder(columnId, to, base) {
      return moveColumn(base ?? orderState(), resolved, columnId, to);
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
