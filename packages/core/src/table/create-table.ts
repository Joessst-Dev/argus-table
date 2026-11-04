import {
  columnPinningFeature,
  columnSizingFeature,
  constructTable,
  createSortedRowModel,
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
import { resolveColumns, type ResolvedColumn } from '../columns/resolve-columns.js';
import type {
  CellContext,
  ColumnAlign,
  ColumnDef,
  ColumnPin,
  ColumnSizingState,
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
  sortedRowModel: createSortedRowModel(),
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
  minWidth: number;
  maxWidth: number;
  sortable: boolean;
  resizable: boolean;
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

export interface TableModelOptions<TData, TContent> {
  columns: readonly ColumnDef<TData, TContent>[];
  data: readonly TData[];
  /** Row id function. Default: the row's index in `data`, as a string. */
  getRowId: ((row: TData, index: number) => string) | undefined;
  /** Current sort state; its owner is the caller (see `controllable`). */
  sorting: SortState;
  /** Current resized widths; its owner is the caller. */
  columnSizing: ColumnSizingState;
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
  /** The row at an index of the current row model. */
  rowAt(index: number): RowView<TData> | undefined;
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
 * Creates the table model over TanStack Table. It owns no state: sorting and sizing
 * come in through `update()`, and `nextSorting()`/`nextSizing()` only propose
 * changes, so the caller decides (controlled or uncontrolled) whether to apply them.
 */
export function createTableModel<TData, TContent>(
  initial: TableModelOptions<TData, TContent>,
): TableModel<TData, TContent> {
  let options = initial;
  let resolved = resolveColumns(options.columns);
  let byId = new Map(resolved.map((c) => [c.id, c]));
  // Kept stable between updates: a new array would make TanStack rebuild columns and rows.
  let tanStackColumns = resolved.map(toTanStack);
  let views: ColumnView<TData, TContent>[] | undefined;
  const rowViews = new WeakMap<Row<Features, AnyRow>, RowView<TData>>();

  const tableOptions = (): TableOptions<Features, AnyRow> => ({
    features,
    columns: tanStackColumns,
    data: options.data as AnyRow[],
    getRowId: (options.getRowId ?? defaultRowId) as (row: AnyRow, index: number) => string,
    state: {
      sorting: options.sorting,
      columnSizing: options.columnSizing,
      columnPinning: {
        start: resolved.filter((c) => c.pin === 'start').map((c) => c.id),
        end: resolved.filter((c) => c.pin === 'end').map((c) => c.id),
      },
    },
    // State is owned by the caller; TanStack's own setters must not change it.
    onSortingChange: () => undefined,
    onColumnSizingChange: () => undefined,
    onColumnPinningChange: () => undefined,
  });

  const table: Table<Features, AnyRow> = constructTable(tableOptions());

  const rows = () => table.getRowModel().rows;

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
        minWidth: def.minWidth,
        maxWidth: def.maxWidth,
        sortable: def.sortable,
        resizable: def.resizable,
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
        tanStackColumns = resolved.map(toTanStack);
      }
      options = merged;
      views = undefined;
      table.setOptions((prev) => ({ ...prev, ...tableOptions() }));
    },

    get columns() {
      return (views ??= buildViews());
    },

    get rowCount() {
      return rows().length;
    },

    get totalWidth() {
      return table.getTotalSize();
    },

    rowAt(index) {
      const row = rows()[index];
      if (!row) return undefined;
      let view = rowViews.get(row);
      if (view?.index !== index) {
        view = { id: row.id, index, original: row.original as TData };
        rowViews.set(row, view);
      }
      return view;
    },

    valueAt(index, columnId) {
      return rows()[index]?.getValue(columnId);
    },

    cellContext(index, columnId) {
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
  };
}
