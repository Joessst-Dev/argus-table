import 'argus-table';
import { tasks } from '../../data.ts';

/** @typedef {import('../../data.ts').Task} Task */
const table = /** @type {import('argus-table').ArgusTable<Task>} */ (
  document.querySelector('#column-reorder-basic-table')
);

/** @type {import('argus-table').ColumnDef<Task>[]} */
const columns = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', reorderable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 130 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

table.columns = columns;
table.data = tasks;
