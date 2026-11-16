import 'argus-table';
import { createSource, describe } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#filtering-data-source-table')
);
const log = /** @type {HTMLOutputElement} */ (document.querySelector('#filtering-data-source-log'));

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, filter: 'text' },
  // The table can't see every value of a remote column: list the set filter's options.
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 120,
    filter: 'set',
    filterOptions: ['open', 'paid', 'shipped'],
  },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];

table.columns = columns;
// The table doesn't filter a data source's rows: it sends the filters to getRows.
/** @type {import('argus-table').ColumnFilterState} */
const filters = { status: { kind: 'set', values: ['shipped'] } };
table.columnFilters = filters;
table.dataSource = createSource((request) => {
  log.textContent = describe(request);
});
