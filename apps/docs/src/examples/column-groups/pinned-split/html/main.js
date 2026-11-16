import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#column-groups-pinned-split-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 160, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 110 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
  { id: 'ref', header: 'Reference', accessor: (order) => `R-${order.id}`, width: 400 },
];

/** @type {import('argus-table').ColumnGroup[]} */
const groups = [
  // Order is pinned and Reference scrolls: the group shows on both sides.
  { id: 'ids', header: 'Ids', columns: ['id', 'ref'] },
  { id: 'who', header: 'Who', columns: ['customer', 'city'] },
  { id: 'state', header: 'Order state', columns: ['status', 'total'] },
];

table.columns = columns;
table.columnGroups = groups;
table.data = orders;
