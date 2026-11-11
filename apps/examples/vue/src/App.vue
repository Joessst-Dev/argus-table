<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { ArgusTable, type ColumnDef, type SelectionState } from '@argus-table/vue';
import { headerMenu } from '@argus-table/header-menu';
import { createOrders, currency, type Order } from './data';

// shallowRef: the table reads the rows, so Vue doesn't need to make them deeply reactive.
const orders = shallowRef(createOrders());
const search = ref('');
const selection = ref<SelectionState>([]);

// `filter` lets users filter a column from its menu: text, number, date or a set of values.
// The status cells come from the #cell-status slot below.
const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start', cell: (o) => `#${o.id}` },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true, filter: 'set' },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 130,
    align: 'end',
    sortable: true,
    filter: 'number',
    cell: (o) => currency.format(o.total),
  },
  { id: 'status', header: 'Status', accessor: 'status', width: 130, sortable: true, filter: 'set' },
];

// The column menu: sort, filter, pin and hide from the button in each header.
const plugins = [headerMenu<Order>()];

const getRowId = (order: Order) => order.id;

const status = computed(() => {
  const count = selection.value.length;
  if (count === 0) return 'Click a row or its checkbox to select it.';
  return `${String(count)} ${count === 1 ? 'order' : 'orders'} selected`;
});
</script>

<template>
  <h1>Orders</h1>
  <input v-model="search" type="search" placeholder="Search orders" aria-label="Search orders" />
  <!-- A click selects a row; Ctrl/Cmd+click adds one, Shift+click a range. -->
  <ArgusTable
    v-model:selection="selection"
    aria-label="Orders"
    :columns="columns"
    :data="orders"
    :get-row-id="getRowId"
    :plugins="plugins"
    :quick-filter="search"
    selection-mode="multi"
    selection-checkboxes
  >
    <!-- A slot per column id: row is an Order. -->
    <template #cell-status="{ row }">
      <span :class="`status status-${row.status.toLowerCase()}`">{{ row.status }}</span>
    </template>
  </ArgusTable>
  <p role="status">{{ status }}</p>
</template>
