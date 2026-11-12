import type { ArgusTable } from './argus-table.js';
import type {
  ColumnDef,
  ColumnFilter,
  ColumnGroup,
  ColumnPin,
  FilterKind,
  FilterValue,
} from './types.js';

/**
 * An add-on for `<argus-table>`, set through its `plugins` property:
 * `table.plugins = [headerMenu()]`. Every member is optional except `name`.
 * Plugins run in array order. A plugin that throws is reported in the console
 * and skipped; it never breaks the table.
 */
export interface ArgusPlugin<T = unknown> {
  /** Names the plugin in error messages. */
  readonly name: string;
  /**
   * Runs when the plugin joins a connected table, and again each time the
   * table is connected after a disconnect. Returns a cleanup function, which
   * runs when the plugin leaves `plugins` or the table is disconnected.
   */
  connect?(host: PluginHost<T>): (() => void) | undefined;
  /**
   * Runs at the start of each update of the table, before the `columns` and
   * `columnGroups` transforms, with the names of the table's properties that
   * changed (`data`, `columnFilters`, `quickFilter`, `columnVisibility`, …).
   * Call `host.invalidateColumns()` here to have `columns` run again in this same
   * update, for columns that depend on more than the column definitions.
   */
  willUpdate?(changed: ReadonlySet<PropertyKey>, host: PluginHost<T>): void;
  /**
   * Changes the column definitions before the table reads them: add computed
   * columns, wrap `header` content, change defaults. Gets the output of the
   * plugin before it (the first one gets `columns` or the `<argus-column>`
   * children). Runs again only when those columns or `plugins` change, or after
   * `host.invalidateColumns()`; a `header` or `cell` function it returns still
   * runs on every render.
   */
  columns?(defs: readonly ColumnDef<T>[], host: PluginHost<T>): readonly ColumnDef<T>[];
  /**
   * Changes the column groups before the table reads them, as `columns` does the
   * columns: wrap a group's `header`, for example. Gets the output of the plugin
   * before it (the first one gets `columnGroups` or the `<argus-column-group>`
   * children). Runs again only when those groups or `plugins` change, or after
   * `host.invalidateColumns()`.
   */
  columnGroups?(groups: readonly ColumnGroup[], host: PluginHost<T>): readonly ColumnGroup[];
  /**
   * A key pressed on a focused header or cell, before the table handles it.
   * Return `true` to claim the key: the table then ignores it (call
   * `event.preventDefault()` yourself). Keys pressed in content inside a cell
   * don't come here, nor do keys on the checkbox column.
   */
  keydown?(event: KeyboardEvent, target: CellTarget, host: PluginHost<T>): boolean | undefined;
}

/** A header or cell of the grid, as plugins see it. */
export interface CellTarget {
  /** The header row, the pinned rows (`top`, `bottom`) or the body. */
  section: 'header' | 'top' | 'body' | 'bottom';
  columnId: string;
  /** The row's index in its section: in the current order for the body, in its list for a pinned row; `0` for the header. */
  rowIndex: number;
  /** The row's id; `undefined` for the header. */
  rowId: string | undefined;
}

/** A column as the table resolved it. */
export interface ColumnInfo {
  id: string;
  sortable: boolean;
  resizable: boolean;
  /** Whether the user may pin and unpin it (`pinnable`). */
  pinnable: boolean;
  /** Whether the user may hide it (`hideable`). */
  hideable: boolean;
  /** The pin in effect: `columnPinning`'s, else the column's own. */
  pin: ColumnPin | undefined;
  /** `true` while the column is hidden (`columnVisibility`, else the column's `hidden`). */
  hidden: boolean;
  /** Current width in px. */
  width: number;
  /** The sort direction, if the table is sorted by this column. */
  sorted: 'asc' | 'desc' | undefined;
  /**
   * The kind of filter users can set (the column's `filter`), or `undefined` when they
   * can't filter it. Optional, like any later addition.
   */
  filter?: FilterKind | undefined;
  /** The column's filter in `columnFilters`, if it has one. */
  filterValue?: ColumnFilter | undefined;
}

/**
 * What the table offers a plugin. Plugins get it; they don't implement it.
 * The table's public API (`sorting`, `columnSizing`, `autosizeColumns()`,
 * `updateComplete`) is on `element`.
 */
export interface PluginHost<T = unknown> {
  readonly element: ArgusTable<T>;
  /**
   * A column of `columns` (or the children) as resolved, after every plugin's
   * `columns`. Hidden columns too, with `hidden: true`.
   */
  column(id: string): ColumnInfo | undefined;
  /**
   * Every column, hidden ones included, in the column order (start-pinned,
   * scrolling, end-pinned), for lists such as "show hidden columns".
   */
  columns?(): ColumnInfo[];
  /** The header or cell an event happened in, if any. */
  cellOf(event: Event): CellTarget | undefined;
  /**
   * Sorts by a column, or (`null`) clears the sort if it is by that column.
   * Follows the `sorting` rules: when it is controlled, only
   * `argus-sort-change` fires with the proposed order. Does nothing for a
   * column that isn't sortable. Use this rather than setting `sorting`, which
   * would make it controlled.
   */
  setSort(columnId: string, direction: 'asc' | 'desc' | null): void;
  /**
   * Pins a column to a side, or (`false`) unpins it. Follows the `columnPinning`
   * rules: when it is controlled, only `argus-column-pin` fires with the proposed
   * pins. Does nothing for a column with `pinnable: false`, or without a change.
   */
  setPin?(columnId: string, pin: ColumnPin | false): void;
  /**
   * Hides or shows a column. Follows the `columnVisibility` rules: when it is
   * controlled, only `argus-column-hide` fires with the proposed visibility. Does
   * nothing without a change, when hiding a column with `hideable: false`, or
   * when hiding the last column shown.
   */
  setHidden?(columnId: string, hidden: boolean): void;
  /**
   * Sets a column's filter, or (`undefined`) clears it. Follows the `columnFilters`
   * rules: when it is controlled, only `argus-column-filter` fires with the proposed
   * filters. Does nothing without a change, or when setting a filter on a column
   * without `filter`.
   */
  setFilter?(columnId: string, filter: ColumnFilter | undefined): void;
  /**
   * The values a `'set'` filter on the column can offer: its `filterOptions`, else the
   * distinct values of the rows the other filters keep, sorted, at most `limit`
   * (default 1000; `truncated` when there are more). `undefined` with a `dataSource`
   * and no `filterOptions`, and for an unknown column.
   */
  filterValues?(
    columnId: string,
    limit?: number,
  ): { values: FilterValue[]; truncated: boolean } | undefined;
  /**
   * The indexes in `data` of the rows the column filters and the quick filter
   * keep, ascending (not in the sorted order), leaving out the filters on the
   * `except` columns and their text in the quick filter: for values computed over
   * the rows shown, such as a share of a total. `undefined` with a `dataSource`.
   * A column's `accessor` may call it while the table filters or sorts, as long as
   * that column is one of `except` (the table doesn't read it for this list).
   */
  filteredIndexes?(except?: readonly string[]): readonly number[] | undefined;
  /** Moves focus to a column's header, after the next update. */
  focusHeader(columnId: string): void;
  /** Says something to screen readers through a polite live region. */
  announce(message: string): void;
  /** Runs the plugins' `columns` and `columnGroups` again on the next update. */
  invalidateColumns(): void;
  /** Renders again: header and cell functions run with the plugin's new state. */
  requestUpdate(): void;
  /**
   * The body row at `index` in the current order (sorted, as shown), or
   * `undefined` past the end and for a `dataSource` row that isn't loaded.
   */
  row?(index: number): T | undefined;
  /**
   * Wraps a column's own header or cell content for a template of the plugin's: in
   * `html\`<b>${host.content(own)}</b>\``, framework content (React elements, Vue
   * VNodes) still reaches the table's `contentRenderer`, and plain content renders
   * as usual. Use it wherever a plugin nests what `header` or `cell` returned.
   */
  content?(value: unknown): unknown;
}
