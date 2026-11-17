<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer.name',
    width: { flex: 1 },
    sortable: true,
  },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];
const getRowId = (order: Order) => order.id;

const selected = ref<string>();
</script>

<template>
  <ArgusTable
    aria-label="Orders"
    style="block-size: 320px"
    :columns="columns"
    :data="orders"
    :get-row-id="getRowId"
    @row-click="selected = $event.detail.row.id"
  />
  <p>
    <output>{{ selected ? `Selected order ${selected}` : 'Click a row.' }}</output>
  </p>
</template>
