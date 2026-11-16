import 'argus-table';
import { tasks } from '../../data.ts';

/** @typedef {import('../../data.ts').Task} Task */
const table = /** @type {import('argus-table').ArgusTable<Task>} */ (
  document.querySelector('#column-visibility-declarative-table')
);
const toggle = /** @type {HTMLButtonElement} */ (
  document.querySelector('#column-visibility-declarative-toggle')
);
const owner = /** @type {HTMLElement} */ (table.querySelector('argus-column[column-id="owner"]'));
table.data = tasks;

// The standard `hidden` attribute hides a column.
toggle.addEventListener('click', () => {
  owner.hidden = !owner.hidden;
  toggle.textContent = owner.hidden ? 'Show Owner' : 'Hide Owner';
});
