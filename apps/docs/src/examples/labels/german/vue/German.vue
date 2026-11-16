<script setup lang="ts">
import { shallowRef } from 'vue';
import { applyEdit, cellEditing, type CellEditDetail } from '@argus-table/editing';
import { tableExport } from '@argus-table/export';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type FormulaColumnDetail, type VueColumnDef } from '@argus-table/vue';
import {
  editingLabels,
  exportLabels,
  formulaLabels,
  menuLabels,
  orders,
  tableLabels,
  type Order,
} from '../../data';

const columns = shallowRef<readonly VueColumnDef<Order>[]>([
  { id: 'id', header: 'Bestellung', accessor: 'id', width: 120, pin: 'start' },
  {
    id: 'customer',
    header: 'Kunde',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
    meta: { edit: true },
  },
  { id: 'city', header: 'Stadt', accessor: 'city', width: 140, filter: 'set' },
  {
    id: 'total',
    header: 'Summe',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
  },
  {
    id: 'gross',
    header: 'Brutto',
    formula: 'ROUND([Summe] * 1.19, 2)',
    width: 110,
    sortable: true,
  },
]);

// Each add-on takes its own labels; keys left out stay English.
const plugins = [
  tableExport<Order>({ labels: exportLabels }),
  formulas<Order>({ editing: 'edit', labels: formulaLabels }),
  headerMenu<Order>({ labels: menuLabels }),
  cellEditing<Order>({ labels: editingLabels }),
];

// The add-ons propose; this code applies: edits to data, formula columns to columns.
const data = shallowRef(orders);
const onCellEdit = (event: CustomEvent<CellEditDetail<Order>>) => {
  data.value = applyEdit(data.value, event.detail, columns.value);
};
const applyColumns = (event: CustomEvent<FormulaColumnDetail<Order>>) => {
  columns.value = event.detail.columns;
};
</script>

<template>
  <ArgusTable
    lang="de"
    aria-label="Bestellungen"
    style="block-size: 320px"
    selection-mode="multi"
    selection-checkboxes
    :columns="columns"
    :data="data"
    :labels="tableLabels"
    :plugins="plugins"
    @cell-edit="onCellEdit"
    @formula-column-add="applyColumns"
    @formula-column-change="applyColumns"
    @formula-column-remove="applyColumns"
  />
</template>
