<script setup lang="ts">
// Detail panels from the `#detail` slot, with `v-model:expanded`.
import { ref } from 'vue';
import { ArgusTable } from '../index.js';
import Counter from './Counter.vue';
import { size, type Order } from './data.js';

const props = defineProps<{ rows: Order[]; open: string[] }>();
const expanded = ref<readonly string[]>(props.open);
const idOf = (order: Order) => order.id;
</script>

<template>
  <output class="expanded">{{ expanded.join(',') }}</output>
  <ArgusTable
    v-model:expanded="expanded"
    :data="rows"
    :style="size"
    :get-row-id="idOf"
    :columns="[{ id: 'customer', header: 'Customer', accessor: 'customer' }]"
  >
    <template #detail="{ row }">
      <p class="detail">{{ row.customer }}</p>
      <Counter />
    </template>
  </ArgusTable>
</template>
