<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { load, orders, store, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true, filter: 'set' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, filter: 'set' },
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
const rowId = (order: Order) => order.id;
// The column menu (sort, filter, pin, hide), created once.
const plugins = [headerMenu<Order>()];
const STORAGE_KEY = 'argus-docs:saved-state:vue';

const table = useTemplateRef('table');
const status = ref('');
const save = () => {
  store(STORAGE_KEY, table.value?.getState());
  status.value = 'Saved.';
};
const restore = () => {
  const saved = load(STORAGE_KEY);
  if (!saved) {
    status.value = 'Nothing saved yet.';
    return;
  }
  void table.value?.setState(saved).then(() => {
    status.value = 'Restored.';
  });
};
const forget = () => {
  store(STORAGE_KEY, undefined);
  status.value = 'Forgotten.';
};
</script>

<template>
  <p class="example-controls">
    <button type="button" @click="save">Save</button>
    <button type="button" @click="restore">Restore</button>
    <button type="button" @click="forget">Forget</button>
    <output aria-live="polite">{{ status }}</output>
  </p>
  <ArgusTable
    ref="table"
    aria-label="Orders"
    style="block-size: 320px"
    selection-mode="multi"
    :columns="columns"
    :data="orders"
    :get-row-id="rowId"
    :plugins="plugins"
  />
</template>
