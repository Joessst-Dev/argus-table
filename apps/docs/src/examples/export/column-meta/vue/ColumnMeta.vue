<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { downloadTable, tableExport } from '@argus-table/export';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  // The slot renders the header; this text names the column in the files.
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  // Left out of the files.
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 110,
    meta: { export: { exclude: true } },
  },
  // Shown with cents, exported as whole euros under another header.
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    cell: (order) => `${order.total.toFixed(2)} €`,
    meta: { export: { header: 'Total (EUR)', value: (value) => Math.round(Number(value)) } },
  },
];
const plugins = [tableExport<Order>({ filename: 'orders' })];

const table = useTemplateRef('table');
const download = () => {
  const element = table.value?.element;
  if (element) void downloadTable(element, 'csv');
};
</script>

<template>
  <p><button type="button" @click="download">Download CSV</button></p>
  <ArgusTable
    ref="table"
    aria-label="Orders"
    style="block-size: 300px"
    :columns="columns"
    :data="orders"
    :plugins="plugins"
  >
    <template #header-customer>
      <span><b>Customer</b> ✦</span>
    </template>
  </ArgusTable>
</template>
