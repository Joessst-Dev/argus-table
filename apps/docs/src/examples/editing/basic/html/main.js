import 'argus-table';
import { applyEdit, cellEditing } from '@argus-table/editing';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#editing-basic-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  // meta.edit opts a column in; the editor follows its filter kind.
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    meta: { edit: true },
  },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 130,
    filter: 'set',
    filterOptions: ['open', 'paid', 'shipped'],
    meta: { edit: true },
  },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
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
