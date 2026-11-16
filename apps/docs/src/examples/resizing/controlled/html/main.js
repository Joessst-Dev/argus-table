import 'argus-table';
import { STORAGE_KEY, tasks } from '../../data.ts';

/** @typedef {import('../../data.ts').Task} Task */
/** @typedef {import('argus-table').ColumnSizingState} ColumnSizingState */
const table = /** @type {import('argus-table').ArgusTable<Task>} */ (
  document.querySelector('#resizing-controlled-table')
);
const output = /** @type {HTMLOutputElement} */ (
  document.querySelector('#resizing-controlled-output')
);

/** @type {import('argus-table').ColumnDef<Task>[]} */
const columns = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', resizable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120, minWidth: 80, maxWidth: 240 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

/** @returns {ColumnSizingState} */
function savedWidths() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** @param {ColumnSizingState} sizing */
function show(sizing) {
  table.columnSizing = sizing;
  output.textContent = JSON.stringify(sizing);
}

table.columns = columns;
table.data = tasks;
show(savedWidths());

// Controlled: apply each proposal and save it.
table.addEventListener('argus-column-sizing-change', (event) => {
  show(event.detail.columnSizing);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(event.detail.columnSizing));
});
