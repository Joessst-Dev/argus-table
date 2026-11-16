<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArgusTable, type ColumnDef, type SortState } from '@argus-table/vue';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120, sortable: true },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

const sorting = ref<SortState>([{ id: 'total', desc: true }]);
const sortedBy = computed(() => {
  const [sort] = sorting.value;
  return sort ? `${sort.id} ${sort.desc ? 'descending' : 'ascending'}` : 'nothing';
});
</script>

<template>
  <ArgusTable
    v-model:sorting="sorting"
    aria-label="Orders"
    style="block-size: 320px"
    :columns="columns"
    :data="orders"
  >
    <template #cell-total="{ row }">
      <strong>{{ row.total.toFixed(2) }}</strong>
    </template>
  </ArgusTable>
  <p>
    Sorted by: <output>{{ sortedBy }}</output>
  </p>
</template>
