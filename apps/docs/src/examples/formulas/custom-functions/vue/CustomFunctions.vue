<script setup lang="ts">
import { formulas } from '@argus-table/formulas';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { dataColumns, itemsOf, type Item } from '../../data';

const columns: ColumnDef<Item>[] = [
  ...dataColumns,
  { id: 'net', header: 'Net', formula: '[Unit price] * [Quantity]', width: 100 },
  // VAT is a function of your own; names are case-insensitive.
  { id: 'vat', header: 'VAT', formula: 'ROUND(vat([Net]), 2)', width: 100 },
];
const plugins = [
  formulas<Item>({
    functions: { VAT: { fn: (net) => Number(net) * 0.19, args: [1, 1], returns: 'number' } },
  }),
];
const data = itemsOf(20);
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
