<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable, type ColumnDef, type SelectionState } from '@argus-table/vue';
import { describeSelection, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];
// Selection is by row id.
const rowId = (order: Order) => order.id;
const selection = ref<SelectionState>([]);
</script>

<template>
  <ArgusTable
    v-model:selection="selection"
    aria-label="Orders"
    style="block-size: 320px"
    selection-mode="multi"
    :columns="columns"
    :data="orders"
    :get-row-id="rowId"
  />
  <p>
    <output>{{ describeSelection(selection) }}</output>
  </p>
</template>
