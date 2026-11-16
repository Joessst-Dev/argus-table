<script setup lang="ts">
import { ref } from 'vue';
import {
  ArgusTable,
  type ColumnDef,
  type SortingChangeDetail,
  type SortState,
} from '@argus-table/vue';
import { headerMenu } from '@argus-table/header-menu';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'status', header: 'Status', accessor: 'status', width: 120 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];
// Created once: a new plugin would reconnect and close an open menu.
const plugins = [headerMenu<Order>()];
const sorting: SortState = [];
const proposed = ref('nothing yet');
const onSortingChange = (event: CustomEvent<SortingChangeDetail>) => {
  proposed.value = JSON.stringify(event.detail.sorting);
};
</script>

<template>
  <!-- Controlled: the menu, like a header click, only proposes an order. -->
  <ArgusTable
    aria-label="Orders"
    style="block-size: 320px"
    :columns="columns"
    :data="orders"
    :plugins="plugins"
    :sorting="sorting"
    @sorting-change="onSortingChange"
  />
  <p><output>Proposed: {{ proposed }}</output></p>
</template>
