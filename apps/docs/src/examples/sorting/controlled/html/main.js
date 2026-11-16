import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#sorting-controlled-table')
);
const output = /** @type {HTMLOutputElement} */ (
  document.querySelector('#sorting-controlled-output')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120, sortable: true },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

table.columns = columns;
table.data = orders;
// Setting `sorting` makes it controlled: a click only proposes a new order.
table.sorting = [{ id: 'total', desc: true }];

table.addEventListener('argus-sorting-change', (event) => {
  const [sort] = event.detail.sorting;
  // This page refuses one order; every other proposal is applied.
  if (sort?.id === 'customer' && sort.desc) {
    output.textContent = 'Refused: customer descending';
    return;
  }
  table.sorting = event.detail.sorting;
  output.textContent = sort ? `${sort.id} ${sort.desc ? 'descending' : 'ascending'}` : 'nothing';
});
