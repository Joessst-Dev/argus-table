import 'argus-table';
import { columns, idOf, orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#detail-rows-basic-table')
);

table.columns = columns;
table.data = orders;
table.getRowId = idOf;
// A chevron column appears; a row's panel shows what rowDetail returns for it.
table.rowDetail = (/** @type {import('argus-table').RowDetailContext<Order>} */ { row }) => {
  const summary = document.createElement('p');
  summary.className = 'order-summary';
  summary.textContent = `${row.customer} in ${row.city}, ${row.status}: ${String(row.total)}`;
  return summary;
};
// Setting expanded makes the app its owner: apply what a chevron proposes.
table.expanded = ['o2'];
table.addEventListener('argus-expanded-change', (event) => {
  table.expanded = event.detail.expanded;
});
