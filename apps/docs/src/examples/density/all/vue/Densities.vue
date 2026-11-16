<script setup lang="ts">
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import { densities, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];
</script>

<template>
  <section v-for="density in densities" :key="density">
    <p>{{ density }}</p>
    <ArgusTable
      :aria-label="`Orders, ${density}`"
      style="block-size: 160px"
      :density="density"
      :columns="columns"
      :data="orders"
    />
  </section>
</template>
