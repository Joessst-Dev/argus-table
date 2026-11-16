<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { items, months, shadows, type Item } from '../../data';

const columns: ColumnDef<Item>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start' },
  { id: 'name', header: 'Name', accessor: 'name', width: 140, pin: 'start' },
  ...months,
  // The cells come from the #cell-actions slot.
  { id: 'actions', header: 'Actions', width: 90, pin: 'end' },
];

const rtl = ref(false);
const shadow = ref<keyof typeof shadows>('Theme');
const style = computed(() => ({
  blockSize: '320px',
  '--argus-pinned-shadow': shadows[shadow.value] || undefined,
}));
</script>

<template>
  <p>
    <label><input v-model="rtl" type="checkbox" /> Right to left</label>
    <label>
      Edge shadow
      <select v-model="shadow">
        <option v-for="(_, name) in shadows" :key="name">{{ name }}</option>
      </select>
    </label>
  </p>
  <!-- 'start' follows the writing direction: the right side in RTL. -->
  <ArgusTable
    aria-label="Items"
    :dir="rtl ? 'rtl' : 'ltr'"
    :style="style"
    :columns="columns"
    :data="items"
  >
    <template #cell-actions>
      <button type="button">Open</button>
    </template>
  </ArgusTable>
</template>
