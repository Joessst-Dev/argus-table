<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable, type CellClickDetail, type ColumnDef } from '@argus-table/vue';
import { describeClick, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

const log = ref('Click a cell.');
// A click, or Enter on a focused cell.
const onCellClick = (event: CustomEvent<CellClickDetail<Order>>) => {
  log.value = describeClick(event.detail);
};
</script>

<template>
  <ArgusTable
    aria-label="Orders"
    style="block-size: 320px"
    :columns="columns"
    :data="orders"
    @cell-click="onCellClick"
  />
  <p>
    <output aria-live="polite">{{ log }}</output>
  </p>
</template>
