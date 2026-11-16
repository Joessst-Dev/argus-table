import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#column-groups-resize-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 160, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 110 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

/** @type {import('argus-table').ColumnGroup[]} */
const groups = [
  // reorderable: false keeps the group in place; its columns still move within it.
  { id: 'who', header: 'Who', columns: ['customer', 'city'], reorderable: false },
  { id: 'state', header: 'Order state', columns: ['status', 'total'] },
];

table.columns = columns;
table.columnGroups = groups;
table.data = orders;
const output = /** @type {HTMLOutputElement} */ (
  document.querySelector('#column-groups-resize-output')
);
// A group resize is a resize of its columns: one event per column.
table.addEventListener('argus-column-sizing-change', (event) => {
  output.textContent = JSON.stringify(event.detail.columnSizing);
});
