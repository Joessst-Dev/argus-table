<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3';

const columnDefs = [
  { field: 'make', sortable: true, filter: true },
  { field: 'price', editable: true },
];
const rowData = [{ make: 'Tesla', price: 64950 }];
</script>

<template>
  <ag-grid-vue :columnDefs="columnDefs" :rowData="rowData" style="height: 500px" />
</template>
