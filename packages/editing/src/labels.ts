/**
 * The editing add-on's built-in text: its editors' accessible names, its
 * validation messages and its announcements. Set any of them through
 * `cellEditing({ labels })`; the rest stay English. Text with values in it is a
 * function of an object (ADR 0005). `column` is the column's text header, or its
 * id; `row` is the row's position in its section, from 1.
 */
export interface EditingLabels {
  /** Accessible name of an open editor. Default: `Quantity, row 12`. */
  editor: (cell: { column: string; row: number }) => string;
  /** Shown when the number editor holds something that isn't a number. Default: `Enter a number`. */
  notANumber: string;
  /** Announced when a key or a double-click asks to edit a cell whose row can't be edited. Default: `Quantity can't be edited in this row`. */
  notEditable: (cell: { column: string }) => string;
}

/** What `cellEditing({ labels })` takes: any of the labels. */
export type EditingLabelsInput = Partial<EditingLabels>;

const DEFAULTS: EditingLabels = {
  editor: ({ column, row }) => `${column}, row ${String(row)}`,
  notANumber: 'Enter a number',
  notEditable: ({ column }) => `${column} can't be edited in this row`,
};

/** The labels in effect: the given ones over the English defaults. */
export function resolveLabels(labels: EditingLabelsInput | undefined): EditingLabels {
  return { ...DEFAULTS, ...labels };
}
