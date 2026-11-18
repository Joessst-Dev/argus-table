<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { downloadTable, tableExport, type ExportDetail } from '@argus-table/export';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { linesOf, orders, type Line, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];

// Every exported order's lines: under it in Excel and PDF, one CSV line each.
const detail: ExportDetail<Order, Line> = {
  columns: [
    { id: 'product', header: 'Product', width: 160 },
    { id: 'quantity', header: 'Qty', align: 'end', width: 60 },
    { id: 'price', header: 'Price', align: 'end', width: 80 },
  ],
  rows: (order) => linesOf(order),
};
// The column menu offers Export and Export with details.
const plugins = [tableExport<Order>({ filename: 'orders', detail }), headerMenu<Order>()];
const idOf = (order: Order) => order.id;

const table = useTemplateRef('table');
const download = (format: 'csv' | 'xlsx') => {
  const element = table.value?.element;
  if (element) void downloadTable(element, format);
};
</script>

<template>
  <p>
    <button type="button" @click="download('csv')">CSV with lines</button>
    {{ ' ' }}
    <button type="button" @click="download('xlsx')">Excel with lines</button>
  </p>
  <ArgusTable
    ref="table"
    aria-label="Orders"
    style="block-size: 340px"
    :columns="columns"
    :data="orders"
    :get-row-id="idOf"
    :plugins="plugins"
  >
    <template #detail="{ row }">
      <ul>
        <li v-for="(line, i) in linesOf(row)" :key="i">{{ line.quantity }} × {{ line.product }}</li>
      </ul>
    </template>
  </ArgusTable>
</template>
