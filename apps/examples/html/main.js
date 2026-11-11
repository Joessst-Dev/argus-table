import 'argus-table';
import { headerMenu } from '@argus-table/header-menu';
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
const search = document.querySelector('#search');
const selected = document.querySelector('#selected');

// Columns and data are properties, not attributes: they hold objects and functions.
// `filter` lets users filter a column from its menu: text, number, date or a set of values.
table.columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start', cell: (o) => `#${o.id}` },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true, filter: 'set' },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 130,
    align: 'end',
    sortable: true,
    filter: 'number',
    cell: (o) => currency.format(o.total),
  },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 130,
    sortable: true,
    filter: 'set',
    cell: statusBadge,
  },
];
table.data = createOrders();
table.getRowId = (o) => o.id;

// The column menu: sort, filter, pin and hide from the button in each header.
table.plugins = [headerMenu()];

// The search box filters on every shown column.
search.addEventListener('input', () => {
  table.quickFilter = search.value;
});

// A click selects a row; Ctrl/Cmd+click adds one, Shift+click a range.
table.addEventListener('argus-row-select', (e) => {
  const count = e.detail.selection.length;
  if (count === 0) selected.textContent = 'Click a row or its checkbox to select it.';
  else selected.textContent = `${String(count)} ${count === 1 ? 'order' : 'orders'} selected`;
});
