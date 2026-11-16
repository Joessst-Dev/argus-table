import 'argus-table';
import { describeSelection, orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#selection-single-table')
);
const output = /** @type {HTMLOutputElement} */ (
  document.querySelector('#selection-single-output')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];

table.columns = columns;
table.data = orders;
// Selection is by row id.
table.getRowId = (/** @type {Order} */ order) => order.id;
table.addEventListener('argus-selection-change', (event) => {
  output.textContent = describeSelection(event.detail.selection);
});
