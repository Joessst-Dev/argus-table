<script setup lang="ts">
import { ArgusColumn, ArgusTable } from '@argus-table/vue';
import { orders, type Order } from '../../data';

const rowId = (order: Order) => order.id;
</script>

<template>
  <ArgusTable aria-label="Orders" style="block-size: 320px" :data="orders" :get-row-id="rowId">
    <ArgusColumn column-id="id" header="Order" accessor="id" :width="90" pin="start" />
    <ArgusColumn
      column-id="customer"
      header="Customer"
      accessor="customer"
      :width="{ flex: 1 }"
      :min-width="160"
      sortable
    />
    <ArgusColumn column-id="city" header="City" accessor="city" :width="120" />
    <ArgusColumn column-id="status" header="Status" :width="110" />
    <ArgusColumn
      column-id="total"
      header="Total"
      accessor="total"
      :width="100"
      align="end"
      sortable
    />
    <ArgusColumn column-id="actions" header="Actions" :width="100" pin="end" :resizable="false" />

    <template #cell-status="{ row }">
      <strong>{{ row.status }}</strong>
    </template>
    <template #cell-actions>
      <button type="button">Open</button>
    </template>
  </ArgusTable>
</template>
