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

/** @type {Map<string, { shown: HTMLInputElement, pin: HTMLSelectElement }>} */
const controls = new Map();

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
  shown.disabled = column.hideable === false;
  // Both are records by column id, over the columns' own `hidden` and `pin`.
  shown.addEventListener('change', () => {
    table.columnVisibility = { ...table.columnVisibility, [column.id]: shown.checked };
  });
  pin.addEventListener('change', () => {
    const choice = /** @type {PinChoice} */ (pin.value);
    table.columnPinning = { ...table.columnPinning, [column.id]: pinOf(choice) };
  });
  controls.set(column.id, { shown, pin });
  form.append(fieldset);
}

/** The controls show the state in effect: the records over the definitions. */
function showState() {
  for (const column of columns) {
    const control = controls.get(column.id);
    if (!control) continue;
    control.shown.checked = table.columnVisibility[column.id] ?? !column.hidden;
    const pin = table.columnPinning[column.id];
    control.pin.value = pin === undefined ? (column.pin ?? 'none') : pin || 'none';
  }
}

table.columnVisibility = {};
table.columnPinning = {};
showState();

// Users can change both too (the column menu): apply their proposals.
table.addEventListener('argus-column-visibility-change', (event) => {
  table.columnVisibility = event.detail.columnVisibility;
  showState();
});
table.addEventListener('argus-column-pinning-change', (event) => {
  table.columnPinning = event.detail.columnPinning;
  showState();
});
