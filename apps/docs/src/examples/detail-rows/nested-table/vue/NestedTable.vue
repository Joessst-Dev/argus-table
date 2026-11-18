<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable } from '@argus-table/vue';
import { columns, idOf, lineColumns, linesOf, orders } from '../../data';

const expanded = ref<readonly string[]>(['o1', 'o3']);
</script>

<template>
  <ArgusTable
    v-model:expanded="expanded"
    aria-label="Orders"
    style="block-size: 440px"
    :columns="columns"
    :data="orders"
    :get-row-id="idOf"
  >
    <template #detail="{ row }">
      <!-- As tall as its rows, up to 240px; past that it scrolls. -->
      <ArgusTable
        :aria-label="`Lines of ${row.id}`"
        style="block-size: auto; max-block-size: 240px"
        :columns="lineColumns"
        :data="linesOf(row)"
      />
    </template>
  </ArgusTable>
</template>
