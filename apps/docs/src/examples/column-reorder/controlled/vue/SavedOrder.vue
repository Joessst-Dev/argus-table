<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ArgusTable, type ColumnDef, type ColumnOrderState } from '@argus-table/vue';
import { tasks, type Task } from '../../data';

// Each flavour on the page saves its own.
const STORAGE_KEY = 'argus-docs:task-order:vue';

const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', reorderable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 130 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

const order = ref<ColumnOrderState>([]);
// localStorage exists only in the browser: read it once mounted, then save changes.
onMounted(() => {
  try {
    order.value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ColumnOrderState;
  } catch {
    order.value = [];
  }
  watch(order, (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  });
});
</script>

<template>
  <ArgusTable
    v-model:column-order="order"
    aria-label="Tasks"
    style="block-size: 320px"
    :columns="columns"
    :data="tasks"
  />
  <p>
    Saved order: <output>{{ JSON.stringify(order) }}</output>
  </p>
</template>
