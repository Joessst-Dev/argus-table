// Shared by the labels example's four flavours: the orders, and every built-in
// text of the table and the four add-ons, in German. Text with values in it is a
// function, so it can use Intl.PluralRules and Intl.NumberFormat.
import type { TableLabels } from 'argus-table';
import type { EditingLabels } from '@argus-table/editing';
import type { ExportLabels } from '@argus-table/export';
import type { FormulasLabels } from '@argus-table/formulas';
import type { HeaderMenuLabels } from '@argus-table/header-menu';

export interface Order {
  id: string;
  customer: string;
  city: string;
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];

export const orders: Order[] = Array.from({ length: 1_000 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

const plural = new Intl.PluralRules('de');
const n = new Intl.NumberFormat('de');
/** `1 Zeile`, `1.234 Zeilen`. */
const count = (value: number, one: string, other: string) =>
  `${n.format(value)} ${plural.select(value) === 'one' ? one : other}`;

/** The table's text in German: every key, so a key added later fails the typecheck here. */
export const tableLabels = {
  noRows: 'Keine Zeilen',
  selectRow: 'Zeile auswählen',
  selectAllRows: 'Alle Zeilen auswählen',
  resizeColumn: 'Spaltenbreite ändern',
  resizeGroup: 'Gruppenbreite ändern',
  filtered: 'Gefiltert',
  retry: 'Erneut versuchen',
  retryRows: ({ first, last }) => `Zeilen ${n.format(first)} bis ${n.format(last)} erneut laden`,
  rowCount: ({ count: rows }) => count(rows, 'Zeile', 'Zeilen'),
  columnMoved: ({ column, position, total }) =>
    `${column} ist jetzt Spalte ${String(position)} von ${String(total)}`,
  groupMoved: ({ group, first, last, total }) =>
    first === last
      ? `${group} ist jetzt Spalte ${String(first)} von ${String(total)}`
      : `${group} ist jetzt in den Spalten ${String(first)} bis ${String(last)} von ${String(total)}`,
} satisfies TableLabels;

const rangeOperators = {
  eq: 'Gleich',
  ne: 'Ungleich',
  gt: 'Größer als',
  ge: 'Mindestens',
  lt: 'Kleiner als',
  le: 'Höchstens',
  between: 'Zwischen',
  empty: 'Ist leer',
  notEmpty: 'Ist nicht leer',
};

export const menuLabels = {
  columnMenu: 'Spaltenmenü',
  sortAscending: 'Aufsteigend sortieren',
  sortDescending: 'Absteigend sortieren',
  unsorted: 'Nicht sortiert',
  pinStart: 'Links fixieren',
  pinEnd: 'Rechts fixieren',
  unpin: 'Nicht fixieren',
  filter: 'Filtern…',
  clearFilter: 'Filter entfernen',
  fitWidth: 'Breite anpassen',
  hideColumn: 'Spalte ausblenden',
  hiddenColumns: 'Ausgeblendete Spalten',
  showColumn: ({ column }) => `${column} einblenden`,
  showAll: 'Alle einblenden',
  pinned: ({ column, pin }) =>
    pin === false
      ? `${column} gelöst`
      : `${column} ${pin === 'start' ? 'links' : 'rechts'} fixiert`,
  columnHidden: ({ column }) => `${column} ausgeblendet`,
  columnShown: ({ column }) => `${column} eingeblendet`,
  columnsShown: ({ count: columns }) => `${count(columns, 'Spalte', 'Spalten')} eingeblendet`,
  columnFitted: ({ column, width }) => `${column} ist jetzt ${n.format(width)} px breit`,
  filterDialog: ({ column }) => `${column} filtern`,
  condition: 'Bedingung',
  textOperators: {
    contains: 'Enthält',
    equals: 'Gleich',
    startsWith: 'Beginnt mit',
    empty: 'Ist leer',
    notEmpty: 'Ist nicht leer',
  },
  numberOperators: rangeOperators,
  dateOperators: {
    ...rangeOperators,
    eq: 'Am',
    ne: 'Nicht am',
    gt: 'Nach',
    ge: 'Am oder nach',
    lt: 'Vor',
    le: 'Am oder vor',
  },
  value: 'Wert',
  from: 'Von',
  to: 'Bis',
  searchValues: 'Werte suchen',
  selectAll: 'Alle auswählen',
  selectAllShown: 'Alle angezeigten auswählen',
  values: 'Werte',
  emptyValue: '(Leer)',
  noValues: 'Keine Werte',
  valuesLimited: ({ count: values }) => `Die ersten ${n.format(values)} Werte`,
  clear: 'Entfernen',
  done: 'Fertig',
} satisfies HeaderMenuLabels;

const GROUPS = {
  Math: 'Mathematik',
  Columns: 'Spalten',
  Logic: 'Logik',
  Text: 'Text',
  Date: 'Datum',
  Yours: 'Eigene',
};
const TYPES = {
  number: 'Zahl',
  text: 'Text',
  boolean: 'WAHR oder FALSCH',
  date: 'Datum',
  unknown: 'hängt von der Zeile ab',
};

export const formulaLabels = {
  formulaGroup: 'Formel',
  editFormula: 'Formel bearbeiten…',
  rename: 'Umbenennen…',
  deleteColumn: 'Spalte löschen',
  viewFormula: 'Formel ansehen…',
  addFormulaColumn: 'Formelspalte hinzufügen…',
  columnAdded: ({ column }) => `Formelspalte ${column} hinzugefügt`,
  columnChanged: ({ column }) => `${column} geändert`,
  columnDeleted: ({ column }) => `${column} gelöscht`,
  addTitle: 'Formelspalte hinzufügen',
  editTitle: 'Formelspalte bearbeiten',
  viewTitle: 'Formelspalte',
  close: 'Schließen',
  columnName: 'Spaltenname',
  formula: 'Formel',
  formulaPlaceholder: 'ROUND([Summe] * 1.19, 2)',
  suggestions: 'Vorschläge',
  suggestionColumn: 'Spalte',
  suggestionFunction: 'Funktion',
  suggestionValue: 'Wert',
  insertColumn: 'Spalte einfügen',
  allFunctions: 'Alle Funktionen',
  functionGroup: ({ group }) => GROUPS[group],
  functionGroupList: ({ name }) => `Funktionen: ${name}`,
  preview: ({ count: rows }) =>
    `Vorschau, ${rows === 1 ? 'erste Zeile' : `erste ${String(rows)} Zeilen`}`,
  noPreviewRows: 'Noch keine Zeilen für eine Vorschau.',
  newColumn: ({ name }) => `${name || 'Neue Spalte'} (neu)`,
  result: ({ type }) => `Ergebnis: ${TYPES[type]}`,
  cancel: 'Abbrechen',
  addColumn: 'Spalte hinzufügen',
  save: 'Speichern',
  nameMissing: 'Gib der Spalte einen Namen.',
  nameBrackets: 'Ein Spaltenname darf weder [ noch ] enthalten.',
  nameTaken: ({ name }) => `Es gibt schon eine Spalte ${name}.`,
  formulaMissing: 'Gib eine Formel ein.',
  rowValueTotal: ({ fn, column }) =>
    `${fn}([${column}]) nimmt nur den Wert der eigenen Zeile. Für die ganze Spalte schreib [[${column}]].`,
} satisfies FormulasLabels;

/** The export's text in German. */
export const exportLabels = {
  group: 'Exportieren',
  csv: 'CSV',
  xlsx: 'Excel (.xlsx)',
  pdf: 'PDF',
  page: ({ page, pages }) => `Seite ${String(page)} von ${String(pages)}`,
  exported: ({ rows }) => `${count(rows, 'Zeile', 'Zeilen')} exportiert`,
  failed: 'Export fehlgeschlagen',
} satisfies ExportLabels;

/** The editing add-on's text in German. */
export const editingLabels = {
  editor: ({ column, row }) => `${column}, Zeile ${String(row)}`,
  notANumber: 'Bitte eine Zahl eingeben',
  notEditable: ({ column }) => `${column} kann in dieser Zeile nicht bearbeitet werden`,
} satisfies EditingLabels;
