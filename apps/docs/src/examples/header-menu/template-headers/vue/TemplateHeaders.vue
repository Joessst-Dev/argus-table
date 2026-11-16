<script setup lang="ts">
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  // The slot renders the header; this text names the column (the menu's "Show Customer").
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'status', header: 'Status', accessor: 'status', width: 120 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];
const plugins = [headerMenu<Order>()];
</script>

<template>
  <ArgusTable
    aria-label="Orders"
    style="block-size: 320px"
    :columns="columns"
    :data="orders"
    :plugins="plugins"
  >
    <template #header-customer>
      <span>Customer <small>(name)</small></span>
    </template>
  </ArgusTable>
</template>
