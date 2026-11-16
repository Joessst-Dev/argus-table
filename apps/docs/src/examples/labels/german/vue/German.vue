<script setup lang="ts">
import { cellEditing } from '@argus-table/editing';
import { tableExport } from '@argus-table/export';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import {
  editingLabels,
  exportLabels,
  formulaLabels,
  menuLabels,
  orders,
  tableLabels,
  type Order,
} from '../../data';

const columns: ColumnDef<Order>[] = [
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
];
// Each add-on takes its own labels; keys left out stay English.
const plugins = [
  tableExport<Order>({ labels: exportLabels }),
  formulas<Order>({ editing: 'edit', labels: formulaLabels }),
  headerMenu<Order>({ labels: menuLabels }),
  cellEditing<Order>({ labels: editingLabels }),
];
</script>

<template>
  <ArgusTable
    lang="de"
    aria-label="Bestellungen"
    style="block-size: 320px"
    selection-mode="multi"
    selection-checkboxes
    :columns="columns"
    :data="orders"
    :labels="tableLabels"
    :plugins="plugins"
  />
</template>
