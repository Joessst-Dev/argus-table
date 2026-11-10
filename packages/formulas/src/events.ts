import type { ColumnDef } from 'argus-table';

/**
 * What the formula editor proposes. The table doesn't change its columns
 * itself: set `columns` to `detail.columns` (or change your `<argus-column>`
 * markup) to apply it, and save it if you keep layouts.
 */
export interface FormulaColumnDetail<T = unknown> {
  /** The column added, changed (as it would be) or removed. */
  column: ColumnDef<T>;
  /**
   * The table's columns with the change applied, as the plugin received them
   * (`columns`, or the `<argus-column>` children). A rename also rewrites the
   * other formulas that named the column by its old header.
   */
  columns: ColumnDef<T>[];
}

export interface FormulaColumnChangeDetail<T = unknown> extends FormulaColumnDetail<T> {
  /** The column before the change. */
  previous: ColumnDef<T>;
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
  name: 'argus-formula-column-add' | 'argus-formula-column-change' | 'argus-formula-column-remove',
  detail: unknown,
): void {
  element.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}
