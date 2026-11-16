import 'argus-table';
import { downloadTable, tableExport } from '@argus-table/export';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#export-column-meta-table')
);
const button = /** @type {HTMLButtonElement} */ (
  document.querySelector('#export-column-meta-download')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  // Content in the header; in text mode (exports, the menu) it gives a name.
  {
    id: 'customer',
    header: ({ text }) => {
      if (text) return 'Customer';
      const label = document.createElement('span');
      label.innerHTML = '<b>Customer</b> ✦';
      return label;
    },
    accessor: 'customer',
    width: { flex: 1 },
  },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  // Left out of the files.
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 110,
    meta: { export: { exclude: true } },
  },
  // Shown with cents, exported as whole euros under another header.
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    cell: (order) => `${order.total.toFixed(2)} €`,
    meta: { export: { header: 'Total (EUR)', value: (value) => Math.round(Number(value)) } },
  },
];

/** @type {import('argus-table').ArgusPlugin<Order>} */
const exporter = tableExport({ filename: 'orders' });

table.columns = columns;
table.data = orders;
table.plugins = [exporter];
button.addEventListener('click', () => {
  void downloadTable(table, 'csv');
});
