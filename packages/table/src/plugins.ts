import type { ArgusTable } from './argus-table.js';
import type { ColumnDef, ColumnPin } from './types.js';

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
   * Changes the column definitions before the table reads them: add computed
   * columns, wrap `header` content, change defaults. Gets the output of the
   * plugin before it (the first one gets `columns` or the `<argus-column>`
   * children). Runs again only when those columns or `plugins` change, or after
   * `host.invalidateColumns()`; a `header` or `cell` function it returns still
   * runs on every render.
   */
  columns?(defs: readonly ColumnDef<T>[], host: PluginHost<T>): readonly ColumnDef<T>[];
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
  pin: ColumnPin | undefined;
  /** Current width in px. */
  width: number;
  /** The sort direction, if the table is sorted by this column. */
  sorted: 'asc' | 'desc' | undefined;
}

/**
 * What the table offers a plugin. Plugins get it; they don't implement it.
 * The table's public API (`sorting`, `columnSizing`, `autosizeColumns()`,
 * `updateComplete`) is on `element`.
 */
export interface PluginHost<T = unknown> {
  readonly element: ArgusTable<T>;
  /** A column of `columns` (or the children) as resolved, after every plugin's `columns`. */
  column(id: string): ColumnInfo | undefined;
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
  /** Moves focus to a column's header, after the next update. */
  focusHeader(columnId: string): void;
  /** Says something to screen readers through a polite live region. */
  announce(message: string): void;
  /** Runs the plugins' `columns` again on the next update. */
  invalidateColumns(): void;
  /** Renders again: header and cell functions run with the plugin's new state. */
  requestUpdate(): void;
}
