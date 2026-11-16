<script setup lang="ts">
import { formulas } from '@argus-table/formulas';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { dataColumns, itemsOf, type Item } from '../../data';

const columns: ColumnDef<Item>[] = [
  ...dataColumns,
  { id: 'per', header: 'Per piece', formula: '[Unit price] / [Quantity]', width: 110 },
  {
    id: 'safe',
    header: 'Per piece (safe)',
    formula: 'IFERROR(ROUND([Unit price] / [Quantity], 2), "–")',
    width: 150,
  },
  { id: 'missing', header: 'Weight × 2', formula: '[Weight] * 2', width: 110 },
  { id: 'loop', header: 'Loop', formula: '[Loop] + 1', width: 90 },
  { id: 'unknown', header: 'Tax', formula: 'TAX([Unit price])', width: 90 },
];
const plugins = [formulas<Item>()];
const data = itemsOf(5);
</script>

<template>
  <ArgusTable
    aria-label="Order items"
    style="block-size: 320px; --argus-formula-error-fg: #b42318"
    :columns="columns"
    :data="data"
    :plugins="plugins"
  />
</template>
