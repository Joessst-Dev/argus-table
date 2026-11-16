import 'argus-table';
import { downloadTable, tableExport } from '@argus-table/export';
import { headerMenu } from '@argus-table/header-menu';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#export-basic-table')
);
const search = /** @type {HTMLInputElement} */ (document.querySelector('#export-basic-search'));
const selected = /** @type {HTMLInputElement} */ (document.querySelector('#export-basic-selected'));

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120, filter: 'set' },
  { id: 'status', header: 'Status', accessor: 'status', width: 110 },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
  },
];
/** @type {import('argus-table').ColumnGroup[]} */
const groups = [{ id: 'where', header: 'Delivery', columns: ['city', 'status'] }];

/** @type {import('argus-table').ArgusPlugin<Order>[]} */
const plugins = [tableExport({ filename: 'orders', title: 'Orders' }), headerMenu()];

table.columns = columns;
table.columnGroups = groups;
table.data = orders;
table.getRowId = (/** @type {Order} */ order) => order.id;
// With headerMenu(), every column menu offers the formats too.
table.plugins = plugins;

search.addEventListener('input', () => {
  table.quickFilter = search.value;
});
// What the table shows: its columns in order, its rows sorted and filtered.
for (const button of document.querySelectorAll('[data-format]')) {
  button.addEventListener('click', () => {
    const format = /** @type {import('@argus-table/export').ExportFormat} */ (
      /** @type {HTMLElement} */ (button).dataset.format
    );
    void downloadTable(table, format, { rows: selected.checked ? 'selected' : 'view' });
  });
}
