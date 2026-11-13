/**
 * The table's built-in text: labels screen readers read, the Retry button, the
 * empty state and announcements. Set any of them through `labels`; the rest stay
 * English. Text with values in it is a function of an object, so it can put them
 * in any order and pick a plural form (`Intl.PluralRules`). Numbers come
 * unformatted.
 */
export interface TableLabels {
  /** Shown when there are no rows and nothing is in the `empty` slot. Default: `No rows`. */
  noRows: string;
  /** Accessible name of a row's checkbox (`selectionCheckboxes`). Default: `Select row`. */
  selectRow: string;
  /** Accessible name of the select-all checkbox (`selectionCheckboxes`). Default: `Select all rows`. */
  selectAllRows: string;
  /** Accessible name of a column's resize handle. Default: `Resize column`. */
  resizeColumn: string;
  /** Accessible name of a column group's resize handle. Default: `Resize group`. */
  resizeGroup: string;
  /** Description of a filtered column's header (`aria-description`). Default: `Filtered`. */
  filtered: string;
  /** Text of the button in a row whose `dataSource` page failed. Default: `Retry`. */
  retry: string;
  /**
   * Accessible name of the Retry button: the rows of the failed page, counted from 1,
   * `last` included. Default: `Retry loading rows 51 to 100`.
   */
  retryRows: (rows: { first: number; last: number }) => string;
  /** Announced when a filter or `quickFilter` changes the rows. Default: `1 row`, `42 rows`. */
  rowCount: (rows: { count: number }) => string;
  /**
   * Announced when a column moves from the keyboard (Alt+Shift+Arrow): its header
   * text (or id), its new position counted from 1, and the number of columns.
   * Default: `Price moved to column 3 of 8`.
   */
  columnMoved: (move: { column: string; position: number; total: number }) => string;
  /**
   * Announced when a column group moves from the keyboard: its header text (or id),
   * the positions of its first and last columns, counted from 1 (the same for a
   * group of one), and the number of columns. Default: `Sales moved to columns 2 to 4 of 8`.
   */
  groupMoved: (move: { group: string; first: number; last: number; total: number }) => string;
}

const DEFAULT_LABELS: TableLabels = {
  noRows: 'No rows',
  selectRow: 'Select row',
  selectAllRows: 'Select all rows',
  resizeColumn: 'Resize column',
  resizeGroup: 'Resize group',
  filtered: 'Filtered',
  retry: 'Retry',
  retryRows: ({ first, last }) => `Retry loading rows ${String(first)} to ${String(last)}`,
  rowCount: ({ count }) => (count === 1 ? '1 row' : `${String(count)} rows`),
  columnMoved: ({ column, position, total }) =>
    `${column} moved to column ${String(position)} of ${String(total)}`,
  groupMoved: ({ group, first, last, total }) =>
    `${group} moved to ${
      first === last ? `column ${String(first)}` : `columns ${String(first)} to ${String(last)}`
    } of ${String(total)}`,
};

/**
 * The labels in effect: the ones set, over the English defaults. A key set to
 * `undefined` or `null` (a framework binding that went away) keeps the default.
 */
export function resolveLabels(labels: Partial<TableLabels>): TableLabels {
  // Typed as never null, but a framework binding can set one.
  const set = Object.entries(labels as Record<string, unknown>).filter(
    ([, value]) => value != null,
  );
  return { ...DEFAULT_LABELS, ...(Object.fromEntries(set) as Partial<TableLabels>) };
}
