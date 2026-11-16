<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { downloadTable, tableExport, type ExportFormat } from '@argus-table/export';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type ColumnDef, type ColumnGroup } from '@argus-table/vue';
import { formats, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120, filter: 'set' },
  { id: 'status', header: 'Status', accessor: 'status', width: 110 },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
  },
];
const groups: ColumnGroup[] = [{ id: 'where', header: 'Delivery', columns: ['city', 'status'] }];
const rowId = (order: Order) => order.id;
// With headerMenu(), every column menu offers the formats too.
const plugins = [tableExport<Order>({ filename: 'orders', title: 'Orders' }), headerMenu<Order>()];

const table = useTemplateRef('table');
const search = ref('');
const selectedOnly = ref(false);
// What the table shows: its columns in order, its rows sorted and filtered.
const download = (format: ExportFormat) => {
  const element = table.value?.element;
  if (element) void downloadTable(element, format, { rows: selectedOnly.value ? 'selected' : 'view' });
};
</script>

<template>
  <div role="toolbar" aria-label="Export" class="example-controls">
    <label>Search <input v-model="search" type="search" /></label>
    <label><input v-model="selectedOnly" type="checkbox" /> Selected rows only</label>
    <button v-for="f in formats" :key="f.format" type="button" @click="download(f.format)">
      {{ f.label }}
    </button>
  </div>
  <ArgusTable
    ref="table"
    aria-label="Orders"
    style="block-size: 320px"
    selection-mode="multi"
    selection-checkboxes
    :columns="columns"
    :column-groups="groups"
    :data="orders"
    :get-row-id="rowId"
    :plugins="plugins"
    :quick-filter="search"
  />
</template>
