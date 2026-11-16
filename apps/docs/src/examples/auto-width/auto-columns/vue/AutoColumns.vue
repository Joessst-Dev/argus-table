<script setup lang="ts">
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { products, type Product } from '../../data';

const columns: ColumnDef<Product>[] = [
  { id: 'sku', header: 'SKU', accessor: 'sku', width: 'auto', pin: 'start' },
  { id: 'name', header: 'Product', accessor: 'name', width: 'auto', maxWidth: 360 },
  { id: 'category', header: 'Category', accessor: 'category', width: 'auto' },
  { id: 'price', header: 'Price (EUR)', accessor: 'price', width: 80, align: 'end' },
];
</script>

<template>
  <ArgusTable aria-label="Products" style="block-size: 320px" :columns="columns" :data="products" />
</template>
