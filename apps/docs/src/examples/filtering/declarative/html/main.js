import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#filtering-declarative-table')
);
table.data = orders.slice(0, 200);
/** @type {import('argus-table').ColumnFilterState} */
const filters = { city: { kind: 'set', values: ['Quito'] } };
table.columnFilters = filters;
