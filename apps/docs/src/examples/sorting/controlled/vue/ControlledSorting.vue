<script setup lang="ts">
import { ref } from 'vue';
import {
  ArgusTable,
  type ColumnDef,
  type SortState,
  type SortingChangeDetail,
} from '@argus-table/vue';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120, sortable: true },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

const describe = (sorting: SortState) => {
  const [sort] = sorting;
  return sort ? `${sort.id} ${sort.desc ? 'descending' : 'ascending'}` : 'nothing';
};

// Bound one way (not v-model): the page decides which proposals to apply.
const sorting = ref<SortState>([{ id: 'total', desc: true }]);
const message = ref(describe(sorting.value));

function onSortingChange(event: CustomEvent<SortingChangeDetail>) {
  const [sort] = event.detail.sorting;
  // This page refuses one order; every other proposal is applied.
  if (sort?.id === 'customer' && sort.desc) {
    message.value = 'Refused: customer descending';
    return;
  }
  sorting.value = event.detail.sorting;
  message.value = describe(event.detail.sorting);
}
</script>

<template>
  <ArgusTable
    aria-label="Orders"
    style="block-size: 320px"
    :columns="columns"
    :data="orders"
    :sorting="sorting"
    @sorting-change="onSortingChange"
  />
  <p>
    <output>{{ message }}</output>
  </p>
</template>
