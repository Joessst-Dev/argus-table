<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable } from '@argus-table/vue';
import { columns, idOf, orders } from '../../data';

const expanded = ref<readonly string[]>(['o2']);
</script>

<template>
  <!-- A chevron column appears; a row's panel shows the #detail slot. -->
  <ArgusTable
    v-model:expanded="expanded"
    aria-label="Orders"
    style="block-size: 380px"
    :columns="columns"
    :data="orders"
    :get-row-id="idOf"
  >
    <template #detail="{ row }">
      <p class="order-summary">
        {{ row.customer }} in {{ row.city }}, {{ row.status }}: {{ row.total }}
      </p>
    </template>
  </ArgusTable>
</template>
