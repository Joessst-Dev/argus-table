import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#sorting-basic-table')
);
const output = /** @type {HTMLOutputElement} */ (document.querySelector('#sorting-basic-output'));

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120, sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    cell: (order) => {
      const strong = document.createElement('strong');
      strong.textContent = order.total.toFixed(2);
      return strong;
    },
  },
];

table.columns = columns;
table.data = orders;
table.sorting = [{ id: 'total', desc: true }];

// Controlled: a click proposes the new order, and the page applies it.
table.addEventListener('argus-sorting-change', (event) => {
  table.sorting = event.detail.sorting;
  const [sort] = event.detail.sorting;
  output.textContent = sort ? `${sort.id} ${sort.desc ? 'descending' : 'ascending'}` : 'nothing';
});
