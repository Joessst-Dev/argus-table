<script setup lang="ts">
import { ref } from 'vue';
import { ArgusColumn, ArgusTable } from '@argus-table/vue';
import { orders } from '../../data';

const showCity = ref(false);
</script>

<template>
  <label><input v-model="showCity" type="checkbox" /> Show City</label>
  <!-- The table follows its children. -->
  <ArgusTable aria-label="Orders" style="block-size: 280px" :data="orders">
    <ArgusColumn column-id="id" header="Order" accessor="id" :width="90" />
    <ArgusColumn column-id="customer" header="Customer" accessor="customer" :width="{ flex: 1 }" />
    <ArgusColumn v-if="showCity" column-id="city" header="City" accessor="city" :width="120" />
    <ArgusColumn column-id="total" header="Total" accessor="total" :width="100" align="end" />
  </ArgusTable>
</template>
