import 'argus-table';
import { applyEdit, cellEditing } from '@argus-table/editing';
import { priorities, tasks } from '../../data.ts';

/** @typedef {import('../../data.ts').Task} Task */
const table = /** @type {import('argus-table').ArgusTable<Task>} */ (
  document.querySelector('#editing-more-editors-table')
);

/**
 * A custom editor: content for the cell while it's edited. The plugin focuses its
 * first control; it commits or cancels itself.
 * @param {import('@argus-table/editing').EditorContext<Task>} context
 */
function priorityEditor({ value, label, commit }) {
  const group = document.createElement('div');
  group.role = 'group';
  group.ariaLabel = label;
  group.style.cssText = 'display: flex; gap: 4px';
  for (const priority of priorities) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '!'.repeat(priority);
    button.ariaLabel = `Priority ${String(priority)}`;
    button.ariaPressed = String(priority === value);
    button.addEventListener('click', () => {
      commit(priority);
    });
    group.append(button);
  }
  return group;
}

/** @type {import('argus-table').ColumnDef<Task>[]} */
const columns = [
  { id: 'title', header: 'Task', accessor: 'title', width: { flex: 1 }, meta: { edit: true } },
  // filter: 'date' gives the date editor; a Date stays a Date.
  {
    id: 'due',
    header: 'Due',
    accessor: 'due',
    width: 150,
    filter: 'date',
    cell: (task) => task.due?.toLocaleDateString('en') ?? '',
    meta: { edit: true },
  },
  // Toggled by a click, Space or Enter, with no editing mode.
  {
    id: 'done',
    header: 'Done',
    accessor: 'done',
    width: 80,
    meta: { edit: { editor: 'checkbox' } },
  },
  {
    id: 'priority',
    header: 'Priority',
    accessor: 'priority',
    width: 170,
    cell: (task) => '!'.repeat(task.priority),
    meta: { edit: { editor: priorityEditor } },
  },
];

/** @type {import('argus-table').ArgusPlugin<Task>} */
const editing = cellEditing();

table.columns = columns;
table.data = tasks;
table.getRowId = (/** @type {Task} */ task) => task.id;
table.plugins = [editing];
table.addEventListener('argus-cell-edit', (event) => {
  table.data = applyEdit(table.data, event.detail, columns);
});
