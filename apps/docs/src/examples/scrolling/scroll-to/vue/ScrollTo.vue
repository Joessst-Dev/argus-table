<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { ArgusTable, type ColumnDef, type ScrollAlign } from '@argus-table/vue';
import { aligns, months, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 160 },
  ...months,
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', pin: 'end' },
];
// Rows by id need getRowId.
const idOf = (order: Order) => order.id;

const table = useTemplateRef('table');
const rowId = ref('o50000');
const column = ref('m15');
const align = ref<ScrollAlign>('center');
const result = ref('');
// Both methods resolve true once the target is in view, false when there's none.
const show = (found: boolean) => {
  result.value = found ? 'Scrolled.' : 'Not found.';
};
const toRow = () => {
  result.value = 'Scrolling…';
  void table.value?.scrollToRow({ id: rowId.value }, { align: align.value }).then(show);
};
const toColumn = () => {
  result.value = 'Scrolling…';
  void table.value?.scrollToColumn(column.value, { align: align.value }).then(show);
};
</script>

<template>
  <p class="example-controls">
    <label>Order id <input v-model="rowId" size="8" /></label>
    <button type="button" @click="toRow">Scroll to row</button>
    <label>
      Column
      <select v-model="column">
        <option v-for="c in columns" :key="c.id" :value="c.id">{{ c.header }}</option>
      </select>
    </label>
    <button type="button" @click="toColumn">Scroll to column</button>
    <label>
      Align
      <select v-model="align">
        <option v-for="a in aligns" :key="a">{{ a }}</option>
      </select>
    </label>
    <output aria-live="polite">{{ result }}</output>
  </p>
  <ArgusTable
    ref="table"
    aria-label="Orders"
    style="block-size: 340px"
    :columns="columns"
    :data="orders"
    :get-row-id="idOf"
  />
</template>
