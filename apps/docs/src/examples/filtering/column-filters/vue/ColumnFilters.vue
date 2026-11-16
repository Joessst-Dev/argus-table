<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArgusTable, type ColumnDef, type ColumnFilterState } from '@argus-table/vue';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, filter: 'set' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, filter: 'set' },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
  },
];

const status = ref('open');
const total = ref<number | ''>(500);
// A filter per column id; a column left out isn't filtered.
const filters = computed<ColumnFilterState>(() => ({
  ...(status.value && { status: { kind: 'set', values: [status.value] } }),
  ...(total.value !== '' && { total: { kind: 'number', op: 'ge', value: total.value } }),
}));
</script>

<template>
  <p class="example-controls">
    <label>
      Status
      <select v-model="status">
        <option value="">any</option>
        <option>open</option>
        <option>paid</option>
        <option>shipped</option>
      </select>
    </label>
    <label>Total at least <input v-model="total" type="number" /></label>
  </p>
  <ArgusTable
    aria-label="Orders"
    style="block-size: 340px"
    :columns="columns"
    :data="orders"
    :column-filters="filters"
  />
</template>
