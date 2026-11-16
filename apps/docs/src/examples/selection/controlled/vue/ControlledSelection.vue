<script setup lang="ts">
import { ref } from 'vue';
import {
  ArgusTable,
  type ColumnDef,
  type SelectionChangeDetail,
  type SelectionState,
} from '@argus-table/vue';
import { describeSelection, MAX_SELECTED, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];
const rowId = (order: Order) => order.id;

const selection = ref<SelectionState>([]);
const refused = ref('');
// Controlled one way (not v-model): the table only proposes; this code decides.
const onSelectionChange = (event: CustomEvent<SelectionChangeDetail>) => {
  const proposed = event.detail.selection;
  if (proposed.length > MAX_SELECTED) {
    refused.value = `Refused ${String(proposed.length)} rows: at most ${String(MAX_SELECTED)}. `;
    return;
  }
  selection.value = proposed;
  refused.value = '';
};
const clear = () => {
  selection.value = [];
  refused.value = '';
};
</script>

<template>
  <p>
    <button type="button" @click="clear">Clear</button>
    <output>{{ refused }}{{ describeSelection(selection) }}</output>
  </p>
  <ArgusTable
    aria-label="Orders"
    style="block-size: 320px"
    selection-mode="multi"
    :columns="columns"
    :data="orders"
    :get-row-id="rowId"
    :selection="selection"
    @selection-change="onSelectionChange"
  />
</template>
