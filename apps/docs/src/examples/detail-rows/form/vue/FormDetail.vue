<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ArgusTable } from '@argus-table/vue';
import { columns, idOf, orders } from '../../data';

const expanded = ref<readonly string[]>(['o1']);
// What's typed and saved, by order id.
const notes = reactive<Record<string, string>>({});
const saved = reactive<Record<string, string>>({});
</script>

<template>
  <ArgusTable
    v-model:expanded="expanded"
    aria-label="Orders"
    style="block-size: 380px"
    :columns="columns"
    :data="orders"
    :get-row-id="idOf"
  >
    <template #detail="{ row }">
      <form class="order-form" @submit.prevent="saved[row.id] = `Saved: ${notes[row.id] ?? ''}`">
        <label>Note for {{ row.customer }} <input v-model="notes[row.id]" name="note" /></label>
        <button type="submit">Save</button> <output>{{ saved[row.id] }}</output>
      </form>
    </template>
  </ArgusTable>
</template>
