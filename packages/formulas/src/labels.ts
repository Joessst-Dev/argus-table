/**
 * The column menu items and announcements of `formulas()`. Text with values in
 * it is a function of an object; `column` is the column's text header, or its id.
 */
export interface FormulasPluginLabels {
  /** Heading of the formula items in a formula column's menu. Default: `Formula`. */
  formulaGroup: string;
  /** Default: `Edit formula…`. */
  editFormula: string;
  /** Default: `Rename…`. */
  rename: string;
  /** Default: `Delete column`. */
  deleteColumn: string;
  /** With `editing: 'view'`. Default: `View formula…`. */
  viewFormula: string;
  /** Default: `Add formula column…`. */
  addFormulaColumn: string;
  /** Announced when the editor adds a column. Default: `Formula column Gross added`. */
  columnAdded: (change: { column: string }) => string;
  /** Announced when the editor changes a column. Default: `Gross changed`. */
  columnChanged: (change: { column: string }) => string;
  /** Announced when Delete column removes a column. Default: `Gross deleted`. */
  columnDeleted: (change: { column: string }) => string;
}

/**
 * The formula editor's text. The editor loads on first use, and its English
 * text with it. Function names, error codes such as `#VALUE!`, error messages
 * and the function descriptions stay English.
 */
export interface FormulasEditorLabels {
  /** Dialog title. Default: `Add formula column`. */
  addTitle: string;
  /** Default: `Edit formula column`. */
  editTitle: string;
  /** With `editing: 'view'`. Default: `Formula column`. */
  viewTitle: string;
  /** The dialog's close button, and the Close button of a read-only one. Default: `Close`. */
  close: string;
  /** Default: `Column name`. */
  columnName: string;
  /** Default: `Formula`. */
  formula: string;
  /** Placeholder of the formula field. Default: `ROUND([Total] * 1.19, 2)`. */
  formulaPlaceholder: string;
  /** Accessible name of the suggestion list. Default: `Suggestions`. */
  suggestions: string;
  /** What a suggestion is, after its name. Default: `column`. */
  suggestionColumn: string;
  /** Default: `function`. */
  suggestionFunction: string;
  /** `TRUE` and `FALSE`. Default: `value`. */
  suggestionValue: string;
  /** Label of the buttons that insert a column. Default: `Insert column`. */
  insertColumn: string;
  /** Shows the list of functions. Default: `All functions`. */
  allFunctions: string;
  /**
   * A group's heading in the list of functions: `Math`, `Columns`, `Logic`, `Text`,
   * `Date`, or `Yours` for the functions of `formulas({ functions })`. Default: the group.
   */
  functionGroup: (group: {
    group: 'Math' | 'Columns' | 'Logic' | 'Text' | 'Date' | 'Yours';
  }) => string;
  /** Accessible name of a group of functions, from its heading. Default: `Math functions`. */
  functionGroupList: (group: { name: string }) => string;
  /** Heading of the preview. Default: `Preview, first 5 rows`. */
  preview: (rows: { count: number }) => string;
  /** Shown when the table has no rows. Default: `No rows to preview yet.` */
  noPreviewRows: string;
  /** Header of the column being added in the preview; `name` is `''` until typed. Default: `Gross (new)`, `New column (new)`. */
  newColumn: (column: { name: string }) => string;
  /** The type of the formula's result. Default: `Result: number`, `Result: TRUE or FALSE`, `Result: depends on the row`. */
  result: (result: { type: 'number' | 'text' | 'boolean' | 'date' | 'unknown' }) => string;
  /** Default: `Cancel`. */
  cancel: string;
  /** Saves a new column. Default: `Add column`. */
  addColumn: string;
  /** Saves a changed column. Default: `Save`. */
  save: string;
  /** Default: `Give the column a name.` */
  nameMissing: string;
  /** Default: `A column name can’t contain [ or ].` */
  nameBrackets: string;
  /** Default: `Another column is already called Gross.` */
  nameTaken: (column: { name: string }) => string;
  /** Default: `Enter a formula.` */
  formulaMissing: string;
  /**
   * A note on a total of one value of the row, `SUM([qty])`, where the whole
   * column `[[qty]]` was likely meant. Default: `SUM([qty]) uses one value, the
   * row’s own. For the whole column, write [[qty]].`
   */
  rowValueTotal: (call: { fn: string; column: string }) => string;
}

/**
 * The built-in text of `formulas()`: its column menu items, announcements and
 * the editor. Keys left out stay English.
 */
export type FormulasLabels = FormulasPluginLabels & FormulasEditorLabels;

export const PLUGIN_LABELS: FormulasPluginLabels = {
  formulaGroup: 'Formula',
  editFormula: 'Edit formula…',
  rename: 'Rename…',
  deleteColumn: 'Delete column',
  viewFormula: 'View formula…',
  addFormulaColumn: 'Add formula column…',
  columnAdded: ({ column }) => `Formula column ${column} added`,
  columnChanged: ({ column }) => `${column} changed`,
  columnDeleted: ({ column }) => `${column} deleted`,
};

/**
 * The labels in effect: the ones given, over the defaults. A key set to
 * `undefined` or `null` keeps the default.
 */
export function resolveLabels<L extends object>(defaults: L, labels: Partial<FormulasLabels>): L {
  const given = Object.entries(labels as Record<string, unknown>).filter(
    ([key, value]) => key in defaults && value != null,
  );
  return { ...defaults, ...(Object.fromEntries(given) as Partial<L>) };
}
