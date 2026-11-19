import 'argus-table';
import { entriesOf, fileColumns, files, folderIds } from '../../data.ts';

/** @typedef {import('../../data.ts').Entry} Entry */
const table = /** @type {import('argus-table').ArgusTable<Entry>} */ (
  document.querySelector('#tree-rows-file-tree-table')
);
const expandAll = /** @type {HTMLButtonElement} */ (
  document.querySelector('#tree-rows-file-tree-expand')
);
const collapseAll = /** @type {HTMLButtonElement} */ (
  document.querySelector('#tree-rows-file-tree-collapse')
);

table.columns = fileColumns;
table.data = files;
// A folder's entries are its child rows, indented under it in the Name column.
table.getSubRows = entriesOf;
// Setting treeExpanded makes the app its owner: apply what a toggle or a key proposes.
table.treeExpanded = ['0'];
table.addEventListener('argus-tree-expanded-change', (event) => {
  table.treeExpanded = event.detail.treeExpanded;
});
// The table has no "expand all" of its own: set treeExpanded.
expandAll.addEventListener('click', () => {
  table.treeExpanded = folderIds;
});
collapseAll.addEventListener('click', () => {
  table.treeExpanded = [];
});
