// The details of the formula editor's events (`formulas()` from
// `@argus-table/formulas`), with Vue content. The table component binds them
// like its own events; the add-on isn't a dependency, so the types are written
// here, matching its `FormulaColumnDetail<T, TContent>` with Vue content.
import type { VueColumnDef } from './content.js';

/**
 * `detail` of `argus-formula-column-add` and `argus-formula-column-remove`:
 * what the formula editor proposes. The table doesn't change its columns
 * itself: set `columns` to `detail.columns` to apply it.
 */
export interface FormulaColumnDetail<T = unknown> {
  /** The column added, changed (as it would be) or removed. */
  column: VueColumnDef<T>;
  /**
   * The table's columns with the change applied, as the plugin received them.
   * A rename also rewrites the other formulas that named the column by its old header.
   */
  columns: readonly VueColumnDef<T>[];
}

/** `detail` of `argus-formula-column-change`: the proposal, and the column as it was. */
export interface FormulaColumnChangeDetail<T = unknown> extends FormulaColumnDetail<T> {
  /** The column before the change. */
  previous: VueColumnDef<T>;
}
