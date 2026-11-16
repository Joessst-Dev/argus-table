import 'argus-table';
import { headerMenu } from '@argus-table/header-menu';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#header-menu-controlled-sorting-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'status', header: 'Status', accessor: 'status', width: 120 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

/** @type {import('argus-table').ArgusPlugin<Order>} */
const menu = headerMenu();

table.columns = columns;
table.data = orders;
table.plugins = [menu];

// Controlled: the menu, like a header click, only proposes an order.
const output = /** @type {HTMLOutputElement} */ (
  document.querySelector('#header-menu-controlled-sorting-output')
);
table.sorting = [];
table.addEventListener('argus-sorting-change', (event) => {
  output.textContent = `Proposed: ${JSON.stringify(event.detail.sorting)}`;
});
