import 'argus-table';
import { formulas } from '@argus-table/formulas';
import { dataColumns, items } from '../../data.ts';

/** @typedef {import('../../data.ts').Item} Item */
const table = /** @type {import('argus-table').ArgusTable<Item>} */ (
  document.querySelector('#formulas-basic-table')
);

/** @type {import('argus-table').ColumnDef<Item>[]} */
const columns = [
  ...dataColumns,
  // Columns by header or id, in brackets; a formula can read another (Gross reads Total).
  {
    id: 'total',
    header: 'Total',
    formula: '[Unit price] * [Quantity] * (1 - [Discount])',
    width: 110,
    sortable: true,
  },
  { id: 'gross', header: 'Gross', formula: 'ROUND([Total] * 1.19, 2)', width: 110, sortable: true },
  { id: 'stock', header: 'Stock', formula: 'IF([qty] < 10, "Low", "OK")', width: 90 },
  { id: 'month', header: 'Month', formula: 'TEXT([Ordered], "mmm yyyy")', width: 110 },
];

/** @type {import('argus-table').ArgusPlugin<Item>[]} */
const plugins = [formulas()];

table.columns = columns;
table.data = items;
table.plugins = plugins;
