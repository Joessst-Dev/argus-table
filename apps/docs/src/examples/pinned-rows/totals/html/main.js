import 'argus-table';
import { money, orders, totals } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#pinned-rows-totals-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
    // The cell sees `pinned`, and shows a summary row its own way.
    cell: (order, { pinned }) => {
      if (!pinned) return order.customer;
      const strong = document.createElement('strong');
      strong.textContent = order.customer;
      return strong;
    },
  },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'items', header: 'Items', accessor: 'items', width: 90, align: 'end', sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    sortable: true,
    cell: (order) => money(order.total),
  },
];

table.columns = columns;
table.data = orders;
table.getRowId = (/** @type {Order} */ order) => order.id;
table.pinnedRows = { bottom: [totals] };
