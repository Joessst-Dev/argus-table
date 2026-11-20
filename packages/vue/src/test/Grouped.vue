<script setup lang="ts">
// Grouped rows (`v-model:grouping`) with a `#row-group-<id>` slot for the totals.
import { ref } from 'vue';
import { ArgusTable } from '../index.js';
import { size, type Order } from './data.js';

defineProps<{ rows: Order[]; currency: string }>();
const grouping = ref<readonly string[]>(['bucket']);
const bucket = (order: Order) => (order.total < 50 ? 'low' : 'high');
</script>

<template>
  <ArgusTable
    v-model:grouping="grouping"
    :data="rows"
    :style="size"
    :columns="[
      { id: 'id', header: 'Order', accessor: 'id' },
      { id: 'bucket', header: 'Bucket', accessor: bucket, groupable: true },
      { id: 'total', header: 'Total', accessor: 'total', aggregate: 'sum' },
    ]"
  >
    <template #row-group-total="{ total, count }">
      <b class="sum">{{ total }} {{ currency }} / {{ count }}</b>
    </template>
  </ArgusTable>
</template>
