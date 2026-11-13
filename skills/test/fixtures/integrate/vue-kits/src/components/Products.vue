<script setup lang="ts">
import { ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

const products = ref([]);
const selection = ref([]);
</script>

<template>
  <DataTable
    v-model:selection="selection"
    :value="products"
    dataKey="id"
    paginator
    :rows="20"
    sortMode="multiple"
    scrollable
    scrollHeight="400px"
  >
    <Column selectionMode="multiple" />
    <Column field="code" header="Code" sortable frozen />
    <Column field="name" header="Name" sortable />
    <Column field="price" header="Price" sortable />
  </DataTable>
</template>
