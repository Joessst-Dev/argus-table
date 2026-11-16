<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ArgusTable, type ColumnDef, type ColumnSizingState } from '@argus-table/vue';
import { STORAGE_KEY, tasks, type Task } from '../../data';

const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', resizable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120, minWidth: 80, maxWidth: 240 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

const sizing = ref<ColumnSizingState>({});
// localStorage exists only in the browser: read it once mounted.
onMounted(() => {
  try {
    sizing.value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as ColumnSizingState;
  } catch {
    sizing.value = {};
  }
  watch(sizing, (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  });
});
</script>

<template>
  <ArgusTable
    v-model:column-sizing="sizing"
    aria-label="Tasks"
    style="block-size: 320px"
    :columns="columns"
    :data="tasks"
  />
  <p>
    Saved widths: <output>{{ JSON.stringify(sizing) }}</output>
  </p>
</template>
