<script setup lang="ts">
import { ArgusColumn, ArgusColumnGroup, ArgusTable } from '@argus-table/vue';
import { orders } from '../../data';

const rows = orders.slice(0, 50);
</script>

<template>
  <ArgusTable aria-label="Declarative groups" style="block-size: 300px" :data="rows">
    <ArgusColumn column-id="id" header="Order" accessor="id" :width="100" />
    <!-- The header text names the group in text mode; the slot renders it. -->
    <ArgusColumnGroup group-id="who" header="Who">
      <ArgusColumn column-id="customer" header="Customer" accessor="customer" />
      <ArgusColumn column-id="city" header="City" accessor="city" :width="120" />
    </ArgusColumnGroup>
    <ArgusColumn column-id="total" header="Total" accessor="total" align="end" />

    <template #group-who>
      <strong>Who</strong>
    </template>
  </ArgusTable>
</template>
