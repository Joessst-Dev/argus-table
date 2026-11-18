<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type ColumnDef, type ColumnFilterState } from '@argus-table/vue';
import { dataColumns, type Item } from '../../data';
import { createFormulaSource, describe } from '../../server';

const columns: ColumnDef<Item>[] = [
  ...dataColumns,
  {
    id: 'total',
    header: 'Line total',
    formula: 'ROUND([Unit price] * [Quantity] * (1 - [Discount]), 2)',
    width: 120,
    sortable: true,
    filter: 'number',
  },
  {
    id: 'size',
    header: 'Order size',
    formula: 'IF([Quantity] >= 10, "bulk", "single")',
    width: 120,
    sortable: true,
    filter: 'text',
  },
];
// `server: true`: the server sorts and filters by the formulas' trees.
const plugins = [formulas<Item>({ server: true }), headerMenu<Item>()];
// Starts filtered; the column menu changes it.
const filters = ref<ColumnFilterState>({ total: { kind: 'number', op: 'ge', value: 200 } });
const rowId = (item: Item) => item.id;

const table = useTemplateRef('table');
const last = ref('');
// Created once: getRows sends `formulaTrees(table)` with each request.
const source = createFormulaSource(
  () => table.value?.element,
  (request) => {
    last.value = describe(request);
  },
);
</script>

<template>
  <ArgusTable
    ref="table"
    aria-label="Order items"
    style="block-size: 320px"
    :columns="columns"
    :data-source="source"
    :get-row-id="rowId"
    :plugins="plugins"
    v-model:column-filters="filters"
  />
  <p>
    Last request: <output>{{ last }}</output>
  </p>
</template>
