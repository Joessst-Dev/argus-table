// The detail of the editing add-on's event (`cellEditing()` from
// `@argus-table/editing`). The table component binds it like its own events;
// the add-on isn't a dependency, so the type is written here, matching its
// `CellEditDetail<T>`.
import type { RowPin } from 'argus-table';

/**
 * `detail` of `argus-cell-edit`: an edit committed in a cell, with a value
 * that differs from the one before. The table doesn't change its data: apply
 * the edit yourself, for example with `applyEdit()` from `@argus-table/editing`.
 */
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
