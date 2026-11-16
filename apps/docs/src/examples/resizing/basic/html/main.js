import 'argus-table';
import { tasks } from '../../data.ts';

/** @typedef {import('../../data.ts').Task} Task */
const table = /** @type {import('argus-table').ArgusTable<Task>} */ (
  document.querySelector('#resizing-basic-table')
);

/** @type {import('argus-table').ColumnDef<Task>[]} */
const columns = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', resizable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120, minWidth: 80, maxWidth: 240 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

table.columns = columns;
table.data = tasks;
