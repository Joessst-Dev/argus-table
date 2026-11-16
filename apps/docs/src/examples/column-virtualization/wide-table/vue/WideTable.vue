<script setup lang="ts">
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { items, valueColumns, type Item } from '../../data';

const columns: ColumnDef<Item>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start' },
  { id: 'name', header: 'Name', accessor: 'name', width: 120, pin: 'start' },
  ...valueColumns,
  // The cells come from the #cell-actions slot.
  { id: 'actions', header: 'Actions', width: 90, pin: 'end' },
];
</script>

<template>
  <ArgusTable
    aria-label="Wide table"
    style="block-size: 340px"
    virtualize-columns
    :columns="columns"
    :data="items"
  >
    <template #cell-actions>
      <button type="button">Open</button>
    </template>
  </ArgusTable>
</template>
