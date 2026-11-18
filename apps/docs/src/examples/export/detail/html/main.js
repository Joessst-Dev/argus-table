import 'argus-table';
import { downloadTable, tableExport } from '@argus-table/export';
import { headerMenu } from '@argus-table/header-menu';
import { linesOf, orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
/** @typedef {import('../../data.ts').Line} Line */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#export-detail-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];

// Every exported order's lines: under it in Excel and PDF, one CSV line each.
/** @type {import('@argus-table/export').ExportDetail<Order, Line>} */
const detail = {
  columns: [
    { id: 'product', header: 'Product', width: 160 },
    { id: 'quantity', header: 'Qty', align: 'end', width: 60 },
    { id: 'price', header: 'Price', align: 'end', width: 80 },
  ],
  rows: (order) => linesOf(order),
};

table.columns = columns;
table.data = orders;
table.getRowId = (/** @type {Order} */ order) => order.id;
/** @type {import('argus-table').ArgusTable<Order>['rowDetail']} */
const rowDetail = ({ row }) =>
  linesOf(row)
    .map((line) => `${String(line.quantity)} × ${line.product}`)
    .join(', ');
// The column menu offers Export and Export with details.
/** @type {import('argus-table').ArgusPlugin<Order>[]} */
const plugins = [tableExport({ filename: 'orders', detail }), headerMenu()];

table.rowDetail = rowDetail;
table.plugins = plugins;

for (const format of /** @type {const} */ (['csv', 'xlsx'])) {
  document.querySelector(`#export-detail-${format}`)?.addEventListener('click', () => {
    void downloadTable(table, format);
  });
}
