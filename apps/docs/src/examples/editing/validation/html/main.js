import 'argus-table';
import { applyEdit, cellEditing } from '@argus-table/editing';
import { orders, validateTotal } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#editing-validation-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'status', header: 'Status', accessor: 'status', width: 130 },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    filter: 'number',
    meta: {
      edit: {
        // Shipped orders can't change; a message keeps the editor open.
        editable: (order) => order.status !== 'shipped',
        validate: validateTotal,
      },
    },
  },
];

/** @type {import('argus-table').ArgusPlugin<Order>} */
const editing = cellEditing();

table.columns = columns;
table.data = orders;
table.getRowId = (/** @type {Order} */ order) => order.id;
table.plugins = [editing];
// The table never changes data: apply each committed edit.
table.addEventListener('argus-cell-edit', (event) => {
  table.data = applyEdit(table.data, event.detail, columns);
});
