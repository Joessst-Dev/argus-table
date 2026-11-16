import type { RowPin } from 'argus-table';
import type { EditingLabelsInput } from './labels.js';

/** The built-in editors. */
export type EditorKind = 'text' | 'number' | 'date' | 'select' | 'checkbox';

/** What a custom editor gets (`meta.edit.editor` as a function). */
export interface EditorContext<TData = unknown> {
  /** The value before the edit (what the column's `accessor` read). */
  value: unknown;
  row: TData;
  rowId: string;
  columnId: string;
  /** The editor's accessible name ("Quantity, row 12"): give it to the control that takes focus. */
  label: string;
  /** Commits a value: validated, then `argus-cell-edit` fires and focus goes back to the cell. */
  commit: (value: unknown) => void;
  /** Closes the editor without a change; focus goes back to the cell. */
  cancel: () => void;
}

/**
 * A custom editor: content for the cell while it is edited, like a column's
 * `cell` (a Lit template, a node, or a React, Vue or Angular component through
 * the wrappers). The plugin focuses its first focusable element; the editor
 * calls `commit(value)` or `cancel()`. Escape, and focus leaving it, cancel.
 */
export type CustomEditor<TData = unknown> = (context: EditorContext<TData>) => unknown;

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
   * The editor, or a function for a custom one. Without one, the column's
   * `filter` kind picks it: `'number'` → the number editor, `'date'` → the date
   * editor, `'set'` with `filterOptions` → a select of them, anything else → the
   * text editor. The checkbox editor toggles a boolean without an editing mode.
   */
  editor?: EditorKind | CustomEditor<TData> | undefined;
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
   * without it. (Typed `unknown` so that `ColumnDef<T>` stays assignable across
   * row types, as without this add-on.)
   */
  set?: ((row: TData, value: unknown) => unknown) | undefined;
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
