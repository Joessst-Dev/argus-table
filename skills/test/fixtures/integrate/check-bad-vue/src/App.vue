<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable, type SortState } from '@argus-table/vue';

const rows = ref([{ id: '1', name: 'Ada' }]);
const sorting = ref<SortState>([]);
const cols = [{ id: 'name', header: 'Name', accessor: 'name', sortable: true }];
</script>

<template>
  <ArgusTable
    aria-label="People"
    :columns="[{ id: 'name', header: 'Name', accessor: 'name', sortable: true }]"
    :data="rows"
    :sorting="sorting"
    @sort-change="() => {}"
  />
  <ArgusTable aria-label="Static" columns="cols" :data="rows" />
  <argus-table aria-label="Raw"></argus-table>
</template>
