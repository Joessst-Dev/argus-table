import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, ColumnDef, TableLabels } from 'argus-table';
import 'argus-table';
import { tableExport, type ExportLabels } from '@argus-table/export';
import { formulas, type FormulasLabels } from '@argus-table/formulas';
import { headerMenu, type HeaderMenuLabels } from '@argus-table/header-menu';
import { orders, type Order } from './data.js';

const data = orders(1_000);

const plural = new Intl.PluralRules('de');
const n = new Intl.NumberFormat('de');
/** `1 Zeile`, `1.234 Zeilen`. */
const count = (value: number, one: string, other: string) =>
  `${n.format(value)} ${plural.select(value) === 'one' ? one : other}`;

/** The table's text in German: every key, so a key added later fails the typecheck here. */
const tableLabels = {
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

const menuLabels = {
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

const formulaLabels = {
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
const exportLabels = {
  group: 'Exportieren',
  csv: 'CSV',
  xlsx: 'Excel (.xlsx)',
  pdf: 'PDF',
  page: ({ page, pages }) => `Seite ${String(page)} von ${String(pages)}`,
  exported: ({ rows }) => `${count(rows, 'Zeile', 'Zeilen')} exportiert`,
  failed: 'Export fehlgeschlagen',
} satisfies ExportLabels;

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Bestellung', accessor: 'id', width: 120, pin: 'start' },
  {
    id: 'customer',
    header: 'Kunde',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'Stadt', accessor: 'city', width: 140, filter: 'set' },
  {
    id: 'total',
    header: 'Summe',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
  },
  {
    id: 'gross',
    header: 'Brutto',
    formula: 'ROUND([Summe] * 1.19, 2)',
    width: 110,
    sortable: true,
  },
];

// Kept between renders: new plugin instances would reconnect.
const plugins = [
  tableExport<Order>({ labels: exportLabels }),
  formulas<Order>({ editing: 'edit', labels: formulaLabels }),
  headerMenu<Order>({ labels: menuLabels }),
];

const meta = {
  title: 'Features/Labels',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

async function tableIn(canvasElement: HTMLElement): Promise<ArgusTable<Order>> {
  const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
  if (!table) throw new Error('no <argus-table>');
  await table.updateComplete;
  return table;
}

function headerOf(table: ArgusTable<Order>, id: string): HTMLElement {
  const header = table.shadowRoot?.querySelector<HTMLElement>(
    `[role="columnheader"][data-col="${id}"]`,
  );
  if (!header) throw new Error(`no header ${id}`);
  return header;
}

const items = (menu: HTMLElement) =>
  [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')].map((i) =>
    i.textContent.replace(/\s+/g, ' ').trim(),
  );

/**
 * The built-in text in another language: `labels` on the table, and a `labels`
 * option on `headerMenu()`, `formulas()` and `tableExport()`. Text with values in it is a
 * function, so it can use `Intl.PluralRules` and `Intl.NumberFormat`. Keys
 * left out stay English; this story sets them all, in German, to copy from.
 * The column headers are the app's own. Function names and error codes
 * (`#VALUE!`) in formulas stay as they are.
 */
export const German: Story = {
  render: () =>
    html`<argus-table
      lang="de"
      style="block-size: 420px"
      selection-mode="multi"
      selection-checkboxes
      .columns=${columns}
      .data=${data}
      .labels=${tableLabels}
      .plugins=${plugins}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const selectAll = table.shadowRoot?.querySelector('[part~="header-cell"] input');
    await expect(selectAll?.getAttribute('aria-label')).toBe('Alle Zeilen auswählen');
    await expect(
      headerOf(table, 'customer')
        .querySelector('[part~="resize-handle"]')
        ?.getAttribute('aria-label'),
    ).toBe('Spaltenbreite ändern');

    const button = headerOf(table, 'total')
      .querySelector('slot')
      ?.assignedElements()[0]
      ?.querySelector<HTMLElement>('.argus-header-menu-button');
    await expect(button?.getAttribute('aria-label')).toBe('Spaltenmenü');
    if (!button) return;
    await userEvent.click(button);
    const menu = await waitFor(() => {
      const open = table.querySelector<HTMLElement>('.argus-header-menu:popover-open');
      if (!open) throw new Error('menu not open');
      return open;
    });
    await expect(menu.textContent).toContain('Exportieren');
    await expect(items(menu)).toEqual(
      expect.arrayContaining([
        'Absteigend sortieren',
        'Filtern…',
        'Rechts fixieren',
        'Spalte ausblenden',
        'Formelspalte hinzufügen…',
        'Excel (.xlsx)',
      ]),
    );
    const sort = [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find(
      (i) => i.textContent.trim() === 'Absteigend sortieren',
    );
    if (sort) await userEvent.click(sort);
    await waitFor(() => expect(table.sorting).toEqual([{ id: 'total', desc: true }]));
  },
};
