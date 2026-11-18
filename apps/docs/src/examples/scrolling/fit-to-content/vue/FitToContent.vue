<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArgusTable } from '@argus-table/vue';
import { itemColumns, items } from '../../data';

const count = ref(4);
const data = computed(() => items(count.value));
</script>

<template>
  <p class="example-controls">
    <button type="button" @click="count++">Add row</button>
    <button type="button" @click="count = Math.max(0, count - 1)">Remove row</button>
  </p>
  <!-- As tall as its rows, up to 320px; past that it scrolls. -->
  <ArgusTable
    aria-label="Line items"
    style="block-size: auto; max-block-size: 320px"
    :columns="itemColumns"
    :data="data"
  />
</template>
