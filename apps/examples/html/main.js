import 'argus-table';
import '@argus-table/themes/default.css';
import './style.css';
import { createOrders } from './data.js';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' });

// A cell can return a string, a number, a DOM node or a Lit template.
function statusBadge(order) {
  const badge = document.createElement('span');
  badge.className = `status status-${order.status.toLowerCase()}`;
  badge.textContent = order.status;
  return badge;
}

const table = document.querySelector('#orders');
const selected = document.querySelector('#selected');

// Columns and data are properties, not attributes: they hold objects and functions.
table.columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start', cell: (o) => `#${o.id}` },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    sortable: true,
    cell: (o) => currency.format(o.total),
  },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, cell: statusBadge },
];
table.data = createOrders();
table.getRowId = (o) => o.id;

table.addEventListener('argus-row-click', (e) => {
  const order = e.detail.row;
  selected.textContent = `Selected order #${order.id} (${order.customer})`;
});
