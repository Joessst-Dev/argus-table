import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#row-height-wrapped-text-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  { id: 'city', header: 'City', accessor: 'city', width: 110 },
  { id: 'status', header: 'Status', accessor: 'status', width: 100 },
  { id: 'total', header: 'Total', accessor: 'total', width: 100, align: 'end' },
  { id: 'note', header: 'Note', accessor: 'note', width: { flex: 1 }, minWidth: 180, wrap: true },
];

table.columns = columns;
table.data = orders;
