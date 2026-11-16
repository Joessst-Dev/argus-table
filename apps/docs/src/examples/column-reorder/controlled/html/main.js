import 'argus-table';
import { tasks } from '../../data.ts';

// Each flavour on the page saves its own.
const STORAGE_KEY = 'argus-docs:task-order:html';

/** @typedef {import('../../data.ts').Task} Task */
/** @typedef {import('argus-table').ColumnOrderState} ColumnOrderState */
const table = /** @type {import('argus-table').ArgusTable<Task>} */ (
  document.querySelector('#column-reorder-controlled-table')
);
const output = /** @type {HTMLOutputElement} */ (
  document.querySelector('#column-reorder-controlled-output')
);

/** @type {import('argus-table').ColumnDef<Task>[]} */
const columns = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', reorderable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 130 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

/** @returns {ColumnOrderState} */
function savedOrder() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** @param {ColumnOrderState} order */
function show(order) {
  table.columnOrder = order;
  output.textContent = JSON.stringify(order);
}

table.columns = columns;
table.data = tasks;
show(savedOrder());

// Controlled: apply each move and save it.
table.addEventListener('argus-column-order-change', (event) => {
  show(event.detail.columnOrder);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(event.detail.columnOrder));
});
