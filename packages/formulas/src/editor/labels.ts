import type { FormulasEditorLabels } from '../labels.js';

const TYPES = {
  number: 'number',
  text: 'text',
  boolean: 'TRUE or FALSE',
  date: 'date',
  unknown: 'depends on the row',
};

/** The editor's English text; it loads with the editor. */
export const EDITOR_LABELS: FormulasEditorLabels = {
  addTitle: 'Add formula column',
  editTitle: 'Edit formula column',
  viewTitle: 'Formula column',
  close: 'Close',
  columnName: 'Column name',
  formula: 'Formula',
  formulaPlaceholder: 'ROUND([Total] * 1.19, 2)',
  suggestions: 'Suggestions',
  suggestionColumn: 'column',
  suggestionFunction: 'function',
  suggestionValue: 'value',
  insertColumn: 'Insert column',
  allFunctions: 'All functions',
  functionGroup: ({ group }) => group,
  functionGroupList: ({ name }) => `${name} functions`,
  preview: ({ count }) => `Preview, first ${count === 1 ? 'row' : `${String(count)} rows`}`,
  noPreviewRows: 'No rows to preview yet.',
  newColumn: ({ name }) => `${name || 'New column'} (new)`,
  result: ({ type }) => `Result: ${TYPES[type]}`,
  cancel: 'Cancel',
  addColumn: 'Add column',
  save: 'Save',
  nameMissing: 'Give the column a name.',
  nameBrackets: 'A column name can’t contain [ or ].',
  nameTaken: ({ name }) => `Another column is already called ${name}.`,
  formulaMissing: 'Enter a formula.',
  rowValueTotal: ({ fn, column }) =>
    `${fn}([${column}]) uses one value, the row’s own. For the whole column, write [[${column}]].`,
};
