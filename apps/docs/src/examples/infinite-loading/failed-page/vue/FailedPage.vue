<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable, type ColumnDef, type LoadErrorDetail } from '@argus-table/vue';
import { createSource, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];
// Created once: a new source starts again from an empty cache.
const source = createSource({ failOnce: true });

// A failed page fires argus-load-error, and its rows show a Retry button.
const log = ref('');
const onLoadError = (event: CustomEvent<LoadErrorDetail>) => {
  const { error, start, end } = event.detail;
  log.value = `argus-load-error: rows ${String(start)}–${String(end)}, ${String(error)}`;
};
</script>

<template>
  <ArgusTable
    aria-label="Orders"
    style="block-size: 340px"
    :columns="columns"
    :data-source="source"
    @load-error="onLoadError"
  />
  <p>
    <output role="status">{{ log }}</output>
  </p>
</template>
