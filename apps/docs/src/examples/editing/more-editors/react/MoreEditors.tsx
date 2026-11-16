import { useState } from 'react';
import { applyEdit, cellEditing } from '@argus-table/editing';
import { ArgusTable, type ReactColumnDef } from '@argus-table/react';
import { priorities, tasks, type Task } from '../../data';

const columns: ReactColumnDef<Task>[] = [
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
    meta: {
      edit: {
        // A custom editor: JSX for the cell while it's edited. The plugin focuses
        // its first control; it commits or cancels itself.
        editor: ({ value, label, commit }) => (
          <div role="group" aria-label={label} style={{ display: 'flex', gap: 4 }}>
            {priorities.map((priority) => (
              <button
                key={priority}
                type="button"
                aria-label={`Priority ${String(priority)}`}
                aria-pressed={priority === value}
                onClick={() => {
                  commit(priority);
                }}
              >
                {'!'.repeat(priority)}
              </button>
            ))}
          </div>
        ),
      },
    },
  },
];
const rowId = (task: Task) => task.id;
const plugins = [cellEditing<Task>()];

export default function MoreEditors() {
  const [data, setData] = useState(tasks);
  return (
    <ArgusTable
      aria-label="Tasks"
      style={{ blockSize: 320 }}
      columns={columns}
      data={data}
      getRowId={rowId}
      plugins={plugins}
      onCellEdit={(e) => {
        setData((rows) => applyEdit(rows, e.detail, columns));
      }}
    />
  );
}
