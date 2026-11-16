import type { RowPin } from 'argus-table';
import type { EditingLabelsInput } from './labels.js';

/** The built-in editors. */
export type EditorKind = 'text' | 'number' | 'select';

/** A choice of the select editor. */
export interface SelectOption {
  /** The value a commit hands to `argus-cell-edit`. */
  value: unknown;
  /** What the option shows. */
  label: string;
}

/** How a column is edited: `meta: { edit: { … } }` on its definition. */
export interface ColumnEditOptions<TData = unknown> {
  /**
   * The editor. Without one, the column's `filter` kind picks it: `'number'` →
   * the number editor, `'set'` with `filterOptions` → a select of them, anything
   * else → the text editor.
   */
  editor?: EditorKind | undefined;
  /** The select editor's choices. Default: the column's `filterOptions`. */
  options?: readonly SelectOption[] | undefined;
  /** Whether a row's cell can be edited. Default: every row's. */
  editable?: ((row: TData) => boolean) | undefined;
  /**
   * The text and number editors' text to a value. Default: the text as it is
   * (text editor), or a number, `null` when empty (number editor).
   */
  parse?: ((text: string, row: TData) => unknown) | undefined;
  /** A message blocks the commit and shows next to the editor; `undefined` lets it through. */
  validate?: ((value: unknown, row: TData) => string | undefined) | undefined;
  /**
   * A copy of `row` with the column's value set, for `applyEdit()`. Needed when
   * the column's `accessor` is a function; a path (`'address.city'`) is set
   * without it.
   */
  set?: ((row: TData, value: unknown) => TData) | undefined;
}

declare module 'argus-table' {
  interface ColumnMeta<TData> {
    /**
     * Makes the column editable with `@argus-table/editing`: `true` for the
     * defaults, or how to edit it. Formula columns can't be edited.
     */
    edit?: boolean | ColumnEditOptions<TData>;
  }
}

/** `cellEditing()`'s options. */
export interface CellEditingOptions {
  /**
   * After Enter commits, the cell below becomes active (Shift+Enter: above),
   * as in a spreadsheet. `false` keeps the edited cell active. Default: `true`.
   */
  enterMoves?: boolean | undefined;
  /**
   * Typing a character on an editable cell starts editing from it, as in a
   * spreadsheet. `false`: only Enter, F2, Delete, Backspace and a double-click
   * do. Default: `true`.
   */
  typeToEdit?: boolean | undefined;
  /** Built-in text in another language; keys left out stay English. */
  labels?: EditingLabelsInput | undefined;
}

/** `detail` of `argus-cell-edit`: a committed edit, for the app to apply. */
export interface CellEditDetail<T = unknown> {
  /** The row object as the table has it (from `data`, or from `pinnedRows`). */
  row: T;
  /** The row's id (`getRowId`, or its index as a string). */
  rowId: string;
  /** The row's index in the current order, or in its pinned list. */
  index: number;
  /** The edited column. */
  columnId: string;
  /** The new value. */
  value: unknown;
  /** The value before the edit (what the column's `accessor` read). */
  previous: unknown;
  /** Set for a row from `pinnedRows`: its side. */
  pinned?: RowPin;
}

declare global {
  interface HTMLElementEventMap {
    'argus-cell-edit': CustomEvent<CellEditDetail>;
  }
}
