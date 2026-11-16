<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable, type ColumnDef, type ColumnFilterState } from '@argus-table/vue';
import { createSource, describe, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, filter: 'text' },
  // The table can't see every value of a remote column: list the set filter's options.
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 120,
    filter: 'set',
    filterOptions: ['open', 'paid', 'shipped'],
  },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];
const filters: ColumnFilterState = { status: { kind: 'set', values: ['shipped'] } };

const last = ref('');
// Created once: a new source starts again from an empty cache.
const source = createSource((request) => {
  last.value = describe(request);
});
</script>

<template>
  <!-- The table doesn't filter a data source's rows: it sends the filters to getRows. -->
  <ArgusTable
    aria-label="Orders"
    style="block-size: 300px"
    :columns="columns"
    :data-source="source"
    :column-filters="filters"
    quick-filter="customer 9"
  />
  <p>
    Last request: <output>{{ last }}</output>
  </p>
</template>
