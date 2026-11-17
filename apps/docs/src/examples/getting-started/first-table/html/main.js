import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#getting-started-first-table-table')
);
const output = /** @type {HTMLOutputElement} */ (
  document.querySelector('#getting-started-first-table-output')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer.name',
    width: { flex: 1 },
    sortable: true,
  },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

table.columns = columns;
table.data = orders;
table.getRowId = (/** @type {Order} */ order) => order.id;
table.addEventListener('argus-row-click', (event) => {
  const order = /** @type {Order} */ (event.detail.row);
  output.textContent = `Selected order ${order.id}`;
});
