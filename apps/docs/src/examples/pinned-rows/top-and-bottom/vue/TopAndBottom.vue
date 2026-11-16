<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArgusTable, type ColumnDef, type RowClickDetail } from '@argus-table/vue';
import { average, money, orders, totals, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
  },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'items', header: 'Items', accessor: 'items', width: 90, align: 'end', sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    sortable: true,
    cell: (order) => money(order.total),
  },
];
const idOf = (order: Order) => order.id;

const top = ref(true);
const bottom = ref(true);
const pinnedRows = computed(() => ({
  top: top.value ? [average] : [],
  bottom: bottom.value ? [totals] : [],
}));

// A click or Enter on a pinned row says which side it's on.
const log = ref('Click a row.');
const onRowClick = (event: CustomEvent<RowClickDetail<Order>>) => {
  const { rowId, pinned } = event.detail;
  log.value = `argus-row-click: ${rowId}${pinned ? ` (pinned: ${pinned})` : ''}`;
};
</script>

<template>
  <p>
    <label><input v-model="top" type="checkbox" /> Average row on top</label>
    <label><input v-model="bottom" type="checkbox" /> Totals row at the bottom</label>
  </p>
  <ArgusTable
    aria-label="Orders"
    style="block-size: 340px"
    :columns="columns"
    :data="orders"
    :get-row-id="idOf"
    :pinned-rows="pinnedRows"
    @row-click="onRowClick"
  />
  <p>
    <output aria-live="polite">{{ log }}</output>
  </p>
</template>
