import 'argus-table';
import { formulas } from '@argus-table/formulas';
import { dataColumns, itemsOf } from '../../data.ts';

/** @typedef {import('../../data.ts').Item} Item */
const table = /** @type {import('argus-table').ArgusTable<Item>} */ (
  document.querySelector('#formulas-custom-functions-table')
);

/** @type {import('argus-table').ColumnDef<Item>[]} */
const columns = [
  ...dataColumns,
  { id: 'net', header: 'Net', formula: '[Unit price] * [Quantity]', width: 100 },
  // VAT is a function of your own; names are case-insensitive.
  { id: 'vat', header: 'VAT', formula: 'ROUND(vat([Net]), 2)', width: 100 },
];

/** @type {import('argus-table').ArgusPlugin<Item>[]} */
const plugins = [
  formulas({
    functions: { VAT: { fn: (net) => Number(net) * 0.19, args: [1, 1], returns: 'number' } },
  }),
];

table.columns = columns;
table.data = itemsOf(20);
table.plugins = plugins;
