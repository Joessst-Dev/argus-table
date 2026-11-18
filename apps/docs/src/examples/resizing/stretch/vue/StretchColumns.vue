<script setup lang="ts">
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { tasks, type Task } from '../../data';

// Fixed widths, narrower than the table: stretch-columns fills the rest.
const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', maxWidth: 70 },
  { id: 'title', header: 'Title', accessor: 'title', width: 200 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];
</script>

<template>
  <ArgusTable
    aria-label="Tasks"
    style="block-size: 320px"
    :columns="columns"
    :data="tasks"
    :stretch-columns="true"
  />
</template>
