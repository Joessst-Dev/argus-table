<script setup lang="ts">
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { tasks, type Task } from '../../data';

const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', resizable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120, minWidth: 80, maxWidth: 240 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];
</script>

<template>
  <ArgusTable aria-label="Tasks" style="block-size: 320px" :columns="columns" :data="tasks" />
</template>
