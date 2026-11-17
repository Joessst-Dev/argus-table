import 'argus-table';
import { columns, idOf, orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#detail-rows-form-table')
);

/**
 * A panel's form, made once per row and kept: rowDetail runs on every update, and
 * a new form each time would lose what was typed.
 * @type {Map<string, HTMLFormElement>}
 */
const forms = new Map();

/** @param {Order} order */
function formFor(order) {
  const form = document.createElement('form');
  form.className = 'order-form';
  form.innerHTML = `<label>Note for ${order.customer} <input name="note" /></label>
    <button type="submit">Save</button> <output></output>`;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const note = /** @type {HTMLInputElement} */ (form.elements.namedItem('note')).value;
    /** @type {HTMLOutputElement} */ (form.querySelector('output')).textContent = `Saved: ${note}`;
  });
  return form;
}

table.columns = columns;
table.data = orders;
table.getRowId = idOf;
table.rowDetail = (/** @type {import('argus-table').RowDetailContext<Order>} */ { row, rowId }) => {
  let form = forms.get(rowId);
  if (!form) forms.set(rowId, (form = formFor(row)));
  return form;
};
// Setting expanded makes the app its owner: apply what a chevron proposes.
table.expanded = ['o1'];
table.addEventListener('argus-expanded-change', (event) => {
  table.expanded = event.detail.expanded;
});
