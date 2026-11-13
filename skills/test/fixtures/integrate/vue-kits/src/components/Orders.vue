<script setup lang="ts">
import { ref } from 'vue';

const orders = ref([]);
const page = ref(1);
function onSelect(rows: unknown[]) {
  console.log(rows);
}
</script>

<template>
  <el-table :data="orders" row-key="id" stripe height="500" @selection-change="onSelect">
    <el-table-column type="selection" width="48" />
    <el-table-column prop="id" label="Order" fixed width="100" />
    <el-table-column prop="customer" label="Customer" sortable min-width="200" />
    <el-table-column prop="total" label="Total" sortable="custom" />
    <el-table-column label="Status">
      <template #default="scope">{{ scope.row.status }}</template>
    </el-table-column>
  </el-table>
  <el-pagination v-model:current-page="page" :total="1000" />
</template>
