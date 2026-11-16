import 'argus-table';
import { describeSelection, MAX_SELECTED, orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#selection-controlled-table')
);
const output = /** @type {HTMLOutputElement} */ (
  document.querySelector('#selection-controlled-output')
);
const clear = /** @type {HTMLButtonElement} */ (
  document.querySelector('#selection-controlled-clear')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];

table.columns = columns;
table.data = orders;
table.getRowId = (/** @type {Order} */ order) => order.id;
// Controlled: the table only proposes; this code decides.
table.selection = [];

table.addEventListener('argus-selection-change', (event) => {
  const { selection } = event.detail;
  if (selection.length > MAX_SELECTED) {
    output.textContent = `Refused ${String(selection.length)} rows: at most ${String(MAX_SELECTED)}. ${describeSelection(table.selection ?? [])}`;
    return;
  }
  table.selection = selection;
  output.textContent = describeSelection(selection);
});
clear.addEventListener('click', () => {
  table.selection = [];
  output.textContent = describeSelection([]);
});
