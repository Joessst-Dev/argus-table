import 'argus-table';
import { createSource } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#infinite-loading-failed-page-table')
);
const log = /** @type {HTMLOutputElement} */ (
  document.querySelector('#infinite-loading-failed-page-log')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

table.columns = columns;
// Instead of data: the table asks the source for the pages in view.
table.dataSource = createSource({ failOnce: true });

// A failed page fires argus-load-error, and its rows show a Retry button.
table.addEventListener('argus-load-error', (event) => {
  const { error, start, end } = event.detail;
  log.textContent = `argus-load-error: rows ${String(start)}–${String(end)}, ${String(error)}`;
});
