<script setup lang="ts">
import { ref } from 'vue';

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Email', key: 'email' },
  { title: 'Status', key: 'status', align: 'end' },
];
const items = ref([]);
const total = ref(0);
const selected = ref<string[]>([]);
async function load({ page, itemsPerPage, sortBy }: { page: number; itemsPerPage: number; sortBy: unknown }) {
  const res = await fetch(`/api/users?page=${page}&size=${itemsPerPage}&sort=${JSON.stringify(sortBy)}`);
  ({ items: items.value, total: total.value } = await res.json());
}
</script>

<template>
  <v-data-table-server
    v-model="selected"
    :headers="headers"
    :items="items"
    :items-length="total"
    :items-per-page="25"
    item-value="id"
    show-select
    @update:options="load"
  >
    <template #item.status="{ value }">
      <v-chip>{{ value }}</v-chip>
    </template>
  </v-data-table-server>
</template>
