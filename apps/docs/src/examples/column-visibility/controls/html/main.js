import 'argus-table';
import { pinOf, tasks } from '../../data.ts';

/** @typedef {import('../../data.ts').Task} Task */
/** @typedef {import('../../data.ts').PinChoice} PinChoice */
const table = /** @type {import('argus-table').ArgusTable<Task>} */ (
  document.querySelector('#column-visibility-controls-table')
);
const form = /** @type {HTMLFormElement} */ (
  document.querySelector('#column-visibility-controls-form')
);

/** @type {import('argus-table').ColumnDef<Task>[]} */
const columns = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start', hideable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: 180 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 110 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, hidden: true },
];
table.columns = columns;
table.data = tasks;

// A fieldset per column: a "Shown" checkbox and a pin select.
for (const column of columns) {
  const fieldset = document.createElement('fieldset');
  fieldset.innerHTML = `
    <legend></legend>
    <label><input type="checkbox" name="shown" /> Shown</label>
    <label>Pin
      <select name="pin">
        <option>none</option><option>start</option><option>end</option>
      </select>
    </label>`;
  const legend = /** @type {HTMLLegendElement} */ (fieldset.querySelector('legend'));
  const shown = /** @type {HTMLInputElement} */ (fieldset.querySelector('[name="shown"]'));
  const pin = /** @type {HTMLSelectElement} */ (fieldset.querySelector('[name="pin"]'));
  legend.textContent = typeof column.header === 'string' ? column.header : column.id;
  shown.checked = !column.hidden;
  shown.disabled = column.hideable === false;
  pin.value = column.pin ?? 'none';
  // Both are records by column id, over the columns' own `hidden` and `pin`.
  shown.addEventListener('change', () => {
    table.columnVisibility = { ...table.columnVisibility, [column.id]: shown.checked };
  });
  pin.addEventListener('change', () => {
    const choice = /** @type {PinChoice} */ (pin.value);
    table.columnPinning = { ...table.columnPinning, [column.id]: pinOf(choice) };
  });
  form.append(fieldset);
}
