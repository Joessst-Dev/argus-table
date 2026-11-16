<script setup lang="ts">
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { money, orders, totals, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
  },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'items', header: 'Items', accessor: 'items', width: 90, align: 'end', sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    sortable: true,
    cell: (order) => money(order.total),
  },
];
const rowId = (order: Order) => order.id;
const pinnedRows = { bottom: [totals] };
</script>

<template>
  <ArgusTable
    aria-label="Orders"
    style="block-size: 340px"
    :columns="columns"
    :data="orders"
    :get-row-id="rowId"
    :pinned-rows="pinnedRows"
  >
    <!-- The slot sees `pinned`, and shows a summary row its own way. -->
    <template #cell-customer="{ row, pinned }">
      <strong v-if="pinned">{{ row.customer }}</strong>
      <template v-else>{{ row.customer }}</template>
    </template>
  </ArgusTable>
</template>
