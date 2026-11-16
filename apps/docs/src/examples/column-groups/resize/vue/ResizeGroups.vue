<script setup lang="ts">
import { ref } from 'vue';
import {
  ArgusTable,
  type ColumnDef,
  type ColumnGroup,
  type ColumnSizingChangeDetail,
  type ColumnSizingState,
} from '@argus-table/vue';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 160, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 110 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

const groups: ColumnGroup[] = [
  // reorderable: false keeps the group in place; its columns still move within it.
  { id: 'who', header: 'Who', columns: ['customer', 'city'], reorderable: false },
  { id: 'state', header: 'Order state', columns: ['status', 'total'] },
];
const sizing = ref<ColumnSizingState>({});
// A group resize is a resize of its columns: one event per column.
const onResize = (event: CustomEvent<ColumnSizingChangeDetail>) => {
  sizing.value = event.detail.columnSizing;
};
</script>

<template>
  <ArgusTable
    aria-label="Resize groups"
    style="block-size: 300px"
    :columns="columns"
    :column-groups="groups"
    :data="orders"
    @column-sizing-change="onResize"
  />
  <p>
    columnSizing: <output>{{ JSON.stringify(sizing) }}</output>
  </p>
</template>
