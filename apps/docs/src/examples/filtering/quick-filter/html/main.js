import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#filtering-quick-filter-table')
);
const search = /** @type {HTMLInputElement} */ (
  document.querySelector('#filtering-quick-filter-search')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, filter: 'set' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, filter: 'set' },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
  },
];

table.columns = columns;
table.data = orders;
// Rows that contain every word in one of their shown columns, ignoring case.
search.addEventListener('input', () => {
  table.quickFilter = search.value;
});
