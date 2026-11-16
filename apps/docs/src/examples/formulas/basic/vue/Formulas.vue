<script setup lang="ts">
import { formulas } from '@argus-table/formulas';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { dataColumns, items, type Item } from '../../data';

const columns: ColumnDef<Item>[] = [
  ...dataColumns,
  // Columns by header or id, in brackets; a formula can read another (Gross reads Total).
  {
    id: 'total',
    header: 'Total',
    formula: '[Unit price] * [Quantity] * (1 - [Discount])',
    width: 110,
    sortable: true,
  },
  { id: 'gross', header: 'Gross', formula: 'ROUND([Total] * 1.19, 2)', width: 110, sortable: true },
  { id: 'stock', header: 'Stock', formula: 'IF([qty] < 10, "Low", "OK")', width: 90 },
  { id: 'month', header: 'Month', formula: 'TEXT([Ordered], "mmm yyyy")', width: 110 },
];
const plugins = [formulas<Item>()];
const data = items;
</script>

<template>
  <ArgusTable
    aria-label="Order items"
    style="block-size: 320px"
    :columns="columns"
    :data="data"
    :plugins="plugins"
  />
</template>
