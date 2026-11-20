<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable } from '@argus-table/vue';
import { byRegion, byRegionAndStatus, saleColumns, sales, type Sale } from '../../data';

const byStatus = ref(false);
const idOf = (sale: Sale) => sale.id;
</script>

<template>
  <p>
    <label><input v-model="byStatus" type="checkbox" /> Group by status within each region</label>
  </p>
  <!-- One group row per region, with its count and the sum of its amounts. -->
  <ArgusTable
    aria-label="Sales"
    style="block-size: 380px"
    :columns="saleColumns"
    :data="sales"
    :get-row-id="idOf"
    :grouping="byStatus ? byRegionAndStatus : byRegion"
  />
</template>
