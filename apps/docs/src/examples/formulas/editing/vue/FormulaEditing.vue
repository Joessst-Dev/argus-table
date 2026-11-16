<script setup lang="ts">
import { ref } from 'vue';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type FormulaColumnDetail, type VueColumnDef } from '@argus-table/vue';
import { dataColumns, items, type Item } from '../../data';

const columns = ref<readonly VueColumnDef<Item>[]>([
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
]);
const plugins = [formulas<Item>({ editing: 'edit' }), headerMenu<Item>()];
const data = items;
// The plugin never changes columns itself: it proposes them, and this code applies them.
const apply = (event: CustomEvent<FormulaColumnDetail<Item>>) => {
  columns.value = event.detail.columns;
};
</script>

<template>
  <ArgusTable
    aria-label="Order items"
    style="block-size: 320px"
    :columns="columns"
    :data="data"
    :plugins="plugins"
    @formula-column-add="apply"
    @formula-column-change="apply"
    @formula-column-remove="apply"
  />
</template>
