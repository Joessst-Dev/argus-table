<script setup lang="ts">
import { ArgusTable } from '@argus-table/vue';
import { byRegionAndStatus, saleColumns, type Sale } from '../../data';
import { createSalesSource } from '../../server';

const idOf = (sale: Sale) => sale.id;
// Created once: a new source starts again, without the groups it loaded.
const source = createSalesSource();
</script>

<template>
  <!-- The server groups: getRows gets grouping and the groupPath of the level it fills. -->
  <ArgusTable
    aria-label="Sales on the server"
    style="block-size: 380px"
    :columns="saleColumns"
    :get-row-id="idOf"
    :grouping="byRegionAndStatus"
    :data-source="source"
  />
</template>
