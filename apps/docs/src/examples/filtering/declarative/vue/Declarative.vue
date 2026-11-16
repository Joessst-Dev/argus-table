<script setup lang="ts">
import { ArgusColumn, ArgusTable, type ColumnFilterState } from '@argus-table/vue';
import { orders } from '../../data';

const rows = orders.slice(0, 200);
const filters: ColumnFilterState = { city: { kind: 'set', values: ['Quito'] } };
</script>

<template>
  <ArgusTable aria-label="Orders" style="block-size: 280px" :data="rows" :column-filters="filters">
    <ArgusColumn column-id="id" header="Order" accessor="id" :width="100" />
    <ArgusColumn column-id="customer" header="Customer" accessor="customer" filter="text" />
    <ArgusColumn column-id="city" header="City" accessor="city" filter="set" />
  </ArgusTable>
</template>
