<script setup lang="ts">
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import '../../styles.css';
import { orderColumns, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [...orderColumns];
</script>

<template>
  <ArgusTable
    class="styling-striped"
    aria-label="Orders"
    style="block-size: 320px"
    :columns="columns"
    :data="orders"
  />
</template>
