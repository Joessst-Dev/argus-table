import 'argus-table';
import { orders } from '../../data.ts';

const example = document.querySelector('[data-example="sorting/basic"][data-flavour="html"]');
/** @type {import('argus-table').ArgusTable<import('../../data.ts').Order>} */
const table = example.querySelector('argus-table');
const output = example.querySelector('output');

table.columns = [
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
table.data = orders;
table.sorting = [{ id: 'total', desc: true }];

// Controlled: a click proposes the new order, and the page applies it.
table.addEventListener('argus-sorting-change', (event) => {
  table.sorting = event.detail.sorting;
  const [sort] = event.detail.sorting;
  output.textContent = sort ? `${sort.id} ${sort.desc ? 'descending' : 'ascending'}` : 'nothing';
});
