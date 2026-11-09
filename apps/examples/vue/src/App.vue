<script setup lang="ts">
import { shallowRef } from 'vue';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { createOrders, currency, statusBadge, type Order } from './data';

// shallowRef: the table reads the rows, so Vue doesn't need to make them deeply reactive.
const orders = shallowRef(createOrders());
const selected = shallowRef<Order>();

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start', cell: (o) => `#${o.id}` },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    sortable: true,
    cell: (o) => currency.format(o.total),
  },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, cell: statusBadge },
];

const getRowId = (order: Order) => order.id;
</script>

<template>
  <h1>Orders</h1>
  <!-- In @row-click, e.detail.row is an Order -->
  <ArgusTable
    aria-label="Orders"
    :columns="columns"
    :data="orders"
    :get-row-id="getRowId"
    @row-click="(e) => (selected = e.detail.row)"
  />
  <p role="status">
    {{ selected ? `Selected order #${selected.id} (${selected.customer})` : 'Click a row.' }}
  </p>
</template>
