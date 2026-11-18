import 'argus-table';
import { tasks } from '../../data.ts';

/** @typedef {import('../../data.ts').Task} Task */
const table = /** @type {import('argus-table').ArgusTable<Task>} */ (
  document.querySelector('#resizing-stretch-table')
);

// Fixed widths, narrower than the table: stretch-columns fills the rest.
/** @type {import('argus-table').ColumnDef<Task>[]} */
const columns = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', maxWidth: 70 },
  { id: 'title', header: 'Title', accessor: 'title', width: 200 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

table.columns = columns;
table.data = tasks;
