import 'argus-table';
import { formulas } from '@argus-table/formulas';
import { dataColumns, itemsOf } from '../../data.ts';

/** @typedef {import('../../data.ts').Item} Item */
const table = /** @type {import('argus-table').ArgusTable<Item>} */ (
  document.querySelector('#formulas-errors-table')
);

/** @type {import('argus-table').ColumnDef<Item>[]} */
const columns = [
  ...dataColumns,
  { id: 'per', header: 'Per piece', formula: '[Unit price] / [Quantity]', width: 110 },
  {
    id: 'safe',
    header: 'Per piece (safe)',
    formula: 'IFERROR(ROUND([Unit price] / [Quantity], 2), "–")',
    width: 150,
  },
  { id: 'missing', header: 'Weight × 2', formula: '[Weight] * 2', width: 110 },
  { id: 'loop', header: 'Loop', formula: '[Loop] + 1', width: 90 },
  { id: 'unknown', header: 'Tax', formula: 'TAX([Unit price])', width: 90 },
];

/** @type {import('argus-table').ArgusPlugin<Item>[]} */
const plugins = [formulas()];

table.columns = columns;
table.data = itemsOf(5);
table.plugins = plugins;
