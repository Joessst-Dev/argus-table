import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#filtering-column-filters-table')
);
const status = /** @type {HTMLSelectElement} */ (
  document.querySelector('#filtering-column-filters-status')
);
const total = /** @type {HTMLInputElement} */ (
  document.querySelector('#filtering-column-filters-total')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, filter: 'set' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, filter: 'set' },
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

/** A filter per column id; a column left out isn't filtered. */
function applyFilters() {
  /** @type {import('argus-table').ColumnFilterState} */
  const filters = {};
  if (status.value) filters.status = { kind: 'set', values: [status.value] };
  if (!Number.isNaN(total.valueAsNumber)) {
    filters.total = { kind: 'number', op: 'ge', value: total.valueAsNumber };
  }
  table.columnFilters = filters;
}

table.columns = columns;
table.data = orders;
applyFilters();
status.addEventListener('change', applyFilters);
total.addEventListener('input', applyFilters);
