import 'argus-table';
import { average, money, orders, totals } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#pinned-rows-top-and-bottom-table')
);
const top = /** @type {HTMLInputElement} */ (
  document.querySelector('#pinned-rows-top-and-bottom-top')
);
const bottom = /** @type {HTMLInputElement} */ (
  document.querySelector('#pinned-rows-top-and-bottom-bottom')
);
const log = /** @type {HTMLOutputElement} */ (
  document.querySelector('#pinned-rows-top-and-bottom-log')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
  },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'items', header: 'Items', accessor: 'items', width: 90, align: 'end', sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    sortable: true,
    cell: (order) => money(order.total),
  },
];

function pinRows() {
  table.pinnedRows = { top: top.checked ? [average] : [], bottom: bottom.checked ? [totals] : [] };
}

table.columns = columns;
table.data = orders;
table.getRowId = (/** @type {Order} */ order) => order.id;
pinRows();
top.addEventListener('change', pinRows);
bottom.addEventListener('change', pinRows);

// A click or Enter on a pinned row says which side it's on.
table.addEventListener('argus-row-click', (event) => {
  const { rowId, pinned } = event.detail;
  log.textContent = `argus-row-click: ${rowId}${pinned ? ` (pinned: ${pinned})` : ''}`;
});
