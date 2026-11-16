import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#declarative-columns-markup-table')
);
const status = /** @type {import('argus-table').ArgusColumn<Order>} */ (
  table.querySelector('argus-column[column-id="status"]')
);

// Content that depends on the row: the column's `cell` property.
status.cell = (/** @type {Order} */ order) => {
  const strong = document.createElement('strong');
  strong.textContent = order.status;
  return strong;
};
table.getRowId = (/** @type {Order} */ order) => order.id;
table.data = orders;
