import 'argus-table';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { dataColumns, items } from '../../data.ts';

/** @typedef {import('../../data.ts').Item} Item */
const table = /** @type {import('argus-table').ArgusTable<Item>} */ (
  document.querySelector('#formulas-editing-table')
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
const plugins = [formulas({ editing: 'edit' }), headerMenu()];

table.columns = columns;
table.data = items;
table.plugins = plugins;
// The plugin never changes columns itself: it proposes them, and this code applies them.
for (const type of ['argus-formula-column-add', 'argus-formula-column-change', 'argus-formula-column-remove']) {
  table.addEventListener(type, (event) => {
    table.columns = /** @type {CustomEvent<{ columns: import('argus-table').ColumnDef<Item>[] }>} */ (event).detail.columns;
  });
}
