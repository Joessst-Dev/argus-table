import 'argus-table';
import { describeClick, orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#keyboard-navigation-table')
);
const log = /** @type {HTMLOutputElement} */ (document.querySelector('#keyboard-navigation-log'));

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

table.columns = columns;
table.data = orders;
// A click, or Enter on a focused cell.
table.addEventListener('argus-cell-click', (event) => {
  log.textContent = describeClick(event.detail);
});
