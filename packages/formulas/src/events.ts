import type { CellContent, ColumnDef } from 'argus-table';

/** The editor proposes a new formula column. */
export const FORMULA_COLUMN_ADD = 'argus-formula-column-add';
/** The editor proposes a changed formula column (its formula, or a rename). */
export const FORMULA_COLUMN_CHANGE = 'argus-formula-column-change';
/** The editor proposes removing a formula column. */
export const FORMULA_COLUMN_REMOVE = 'argus-formula-column-remove';

/**
 * What the formula editor proposes. The table doesn't change its columns itself:
 * set `columns` to `detail.columns` (or change your `<argus-column>` markup) to
 * apply it, and save it if you keep layouts. `TContent` is what the columns'
 * `header` and `cell` return, as you set them: the table's own content, or a
 * wrapper's (as in `ReactColumnDef`).
 */
export interface FormulaColumnDetail<T = unknown, TContent = CellContent> {
  /** The column added, changed (as it would be) or removed. */
  column: ColumnDef<T, TContent>;
  /**
   * The table's columns with the change applied, as the plugin received them
   * (`columns`, or the `<argus-column>` children). A rename also rewrites the
   * other formulas that named the column by its old header.
   */
  columns: readonly ColumnDef<T, TContent>[];
}

/** `detail` of `argus-formula-column-change`: the proposal, and the column as it was. */
export interface FormulaColumnChangeDetail<
  T = unknown,
  TContent = CellContent,
> extends FormulaColumnDetail<T, TContent> {
  /** The column before the change. */
  previous: ColumnDef<T, TContent>;
}

declare global {
  interface HTMLElementEventMap {
    'argus-formula-column-add': CustomEvent<FormulaColumnDetail>;
    'argus-formula-column-change': CustomEvent<FormulaColumnChangeDetail>;
    'argus-formula-column-remove': CustomEvent<FormulaColumnDetail>;
  }
}

/** Fires one of the plugin's events on the table: bubbling and composed, like the table's own. */
export function fire(
  element: HTMLElement,
  name: typeof FORMULA_COLUMN_ADD | typeof FORMULA_COLUMN_CHANGE | typeof FORMULA_COLUMN_REMOVE,
  detail: unknown,
): void {
  element.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}
