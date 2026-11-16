<script setup lang="ts">
import { shallowRef } from 'vue';
import { applyEdit, cellEditing, type CellEditDetail } from '@argus-table/editing';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { orders, validateTotal, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'status', header: 'Status', accessor: 'status', width: 130 },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    filter: 'number',
    meta: {
      edit: {
        // Shipped orders can't change; a message keeps the editor open.
        editable: (order) => order.status !== 'shipped',
        validate: validateTotal,
      },
    },
  },
];
const rowId = (order: Order) => order.id;
const plugins = [cellEditing<Order>()];

const data = shallowRef(orders);
// The table never changes data: apply each committed edit.
const onCellEdit = (event: CustomEvent<CellEditDetail<Order>>) => {
  data.value = applyEdit(data.value, event.detail, columns);
};
</script>

<template>
  <ArgusTable
    aria-label="Orders"
    style="block-size: 320px"
    :columns="columns"
    :data="data"
    :get-row-id="rowId"
    :plugins="plugins"
    @cell-edit="onCellEdit"
  />
</template>
