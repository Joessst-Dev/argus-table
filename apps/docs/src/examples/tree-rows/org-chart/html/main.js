import 'argus-table';
import { describeSelection, managerOf, people, personColumns, personId } from '../../data.ts';

/** @typedef {import('../../data.ts').Person} Person */
const table = /** @type {import('argus-table').ArgusTable<Person>} */ (
  document.querySelector('#tree-rows-org-chart-table')
);
const search = /** @type {HTMLInputElement} */ (
  document.querySelector('#tree-rows-org-chart-search')
);
const output = /** @type {HTMLOutputElement} */ (
  document.querySelector('#tree-rows-org-chart-output')
);

table.columns = personColumns;
table.data = people;
// Flat data: every person is in data, and names their manager by id.
table.getRowId = personId;
table.getParentId = managerOf;
table.treeExpanded = ['p1'];
table.addEventListener('argus-tree-expanded-change', (event) => {
  table.treeExpanded = event.detail.treeExpanded;
});
// select-branches: ticking a manager ticks everyone under them.
table.addEventListener('argus-selection-change', (event) => {
  output.textContent = describeSelection(event.detail.selection);
});
// Matches show in their place, under their managers, shown expanded.
search.addEventListener('input', () => {
  table.quickFilter = search.value;
});
