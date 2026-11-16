<script setup lang="ts">
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  { id: 'city', header: 'City', accessor: 'city', width: 110 },
  { id: 'status', header: 'Status', accessor: 'status', width: 100 },
  { id: 'total', header: 'Total', accessor: 'total', width: 100, align: 'end' },
  { id: 'note', header: 'Note', accessor: 'note', width: { flex: 1 }, minWidth: 180, wrap: true },
];
</script>

<template>
  <ArgusTable
    aria-label="Orders with notes"
    style="block-size: 340px"
    :row-height="56"
    :columns="columns"
    :data="orders"
  />
</template>
