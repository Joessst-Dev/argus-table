<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { products, type Product } from '../../data';

const columns: ColumnDef<Product>[] = [
  { id: 'sku', header: 'SKU', accessor: 'sku', width: 80, pin: 'start' },
  { id: 'name', header: 'Product', accessor: 'name', width: 80 },
  { id: 'category', header: 'Category', accessor: 'category', width: 80 },
  { id: 'price', header: 'Price (EUR)', accessor: 'price', width: 80, align: 'end' },
];

const table = useTemplateRef('table');
const resizes = ref(0);
</script>

<template>
  <p>
    <button type="button" @click="table?.autosizeColumns()">Fit all columns</button>
    Resizes: <output>{{ resizes }}</output>
  </p>
  <!-- A fit is a resize: it fires once for each column it changes. -->
  <ArgusTable
    ref="table"
    aria-label="Products"
    style="block-size: 320px"
    :columns="columns"
    :data="products"
    @column-sizing-change="resizes++"
  />
</template>
