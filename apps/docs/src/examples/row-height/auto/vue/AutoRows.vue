<script setup lang="ts">
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { barHeight, orders, totals, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  { id: 'city', header: 'City', accessor: 'city', width: 110 },
  { id: 'status', header: 'Status', accessor: 'status', width: 100 },
  { id: 'total', header: 'Total', accessor: 'total', width: 100, align: 'end' },
  { id: 'note', header: 'Note', accessor: 'note', width: { flex: 1 }, minWidth: 180, wrap: true },
  // The cells come from the #cell-bar slot.
  { id: 'bar', header: 'Bar', width: 70 },
];
const pinnedRows = { bottom: [totals] };
</script>

<template>
  <ArgusTable
    aria-label="Orders with notes, rows fit their content"
    style="block-size: 400px"
    row-height="auto"
    :columns="columns"
    :data="orders"
    :pinned-rows="pinnedRows"
  >
    <!-- Content taller than a line: the row grows to fit it. -->
    <template #cell-bar="{ row }">
      <div class="bar" :style="{ blockSize: `${barHeight(row)}px` }" />
    </template>
  </ArgusTable>
</template>
