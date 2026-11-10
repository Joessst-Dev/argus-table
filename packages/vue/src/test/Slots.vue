<script setup lang="ts">
// Cells and headers from slots: `#cell-<id>` gets the row and its context,
// `#header-<id>` the column id. The slots use the parent's state (`currency`),
// a component (`Badge`), and can come and go (`showTotal`).
import { ArgusColumn, ArgusTable } from '../index.js';
import Badge from './Badge.vue';
import { size, type Order } from './data.js';

defineProps<{ rows: Order[]; currency: string; showTotal: boolean; declarative?: boolean }>();
</script>

<template>
  <ArgusTable
    v-if="!declarative"
    :data="rows"
    :style="size"
    :columns="[
      { id: 'id', header: 'Order', accessor: 'id', width: 90 },
      { id: 'customer', header: 'Customer', accessor: 'customer', width: 200 },
      { id: 'total', header: 'Total', accessor: 'total', width: 160 },
    ]"
  >
    <template #cell-customer="{ row, rowId }">
      <Badge :label="row.customer" :data-row="rowId" />
    </template>
    <template v-if="showTotal" #cell-total="{ value }">{{ value }} {{ currency }}</template>
    <template #header-total="{ columnId }">
      <i class="slot-header">{{ columnId }} in {{ currency }}</i>
    </template>
  </ArgusTable>
  <ArgusTable v-else :data="rows" :style="size">
    <ArgusColumn v-for="id in ['id', 'customer']" :key="id" :column-id="id" :accessor="id" />
    <template #cell-customer="{ row }"><Badge :label="row.customer" /></template>
  </ArgusTable>
</template>
