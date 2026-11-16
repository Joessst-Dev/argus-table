<script setup lang="ts">
import { h, shallowRef } from 'vue';
import { applyEdit, cellEditing, type CellEditDetail } from '@argus-table/editing';
import { ArgusTable, type VueColumnDef } from '@argus-table/vue';
import { priorities, tasks, type Task } from '../../data';

const columns: VueColumnDef<Task>[] = [
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
        // A custom editor: a VNode for the cell while it's edited. The plugin
        // focuses its first control; it commits or cancels itself.
        editor: ({ value, label, commit }) =>
          h(
            'div',
            { role: 'group', 'aria-label': label, style: { display: 'flex', gap: '4px' } },
            priorities.map((priority) =>
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': `Priority ${String(priority)}`,
                  'aria-pressed': priority === value,
                  onClick: () => {
                    commit(priority);
                  },
                },
                '!'.repeat(priority),
              ),
            ),
          ),
      },
    },
  },
];
const rowId = (task: Task) => task.id;
const plugins = [cellEditing<Task>()];

const data = shallowRef(tasks);
const onCellEdit = (event: CustomEvent<CellEditDetail<Task>>) => {
  data.value = applyEdit(data.value, event.detail, columns);
};
</script>

<template>
  <ArgusTable
    aria-label="Tasks"
    style="block-size: 320px"
    :columns="columns"
    :data="data"
    :get-row-id="rowId"
    :plugins="plugins"
    @cell-edit="onCellEdit"
  />
</template>
