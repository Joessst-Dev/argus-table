<script setup lang="ts">
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import '../../styles.css';
import { orderColumns, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  ...orderColumns.filter((column) => column.id !== 'status'),
  // The cells and header come from the slots below; 'Actions' names the column.
  { id: 'status', header: 'Status', width: 120 },
  { id: 'actions', header: 'Actions', width: 90, pin: 'end' },
];
</script>

<template>
  <ArgusTable
    class="styling-slotted"
    aria-label="Orders"
    style="block-size: 320px"
    :columns="columns"
    :data="orders"
  >
    <!-- Content in the light DOM: the page's .badge classes apply. -->
    <template #cell-status="{ row }">
      <span :class="['badge', `badge-${row.status}`]">{{ row.status }}</span>
    </template>
    <!-- A label for screen readers only. -->
    <template #header-actions>
      <span class="visually-hidden">Actions</span>
    </template>
    <template #cell-actions="{ row }">
      <button type="button" :aria-label="`Open ${row.id}`">Open</button>
    </template>
  </ArgusTable>
</template>
