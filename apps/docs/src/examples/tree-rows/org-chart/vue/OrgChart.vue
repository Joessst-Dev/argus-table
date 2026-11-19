<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable, type SelectionState, type TreeExpandedState } from '@argus-table/vue';
import { describeSelection, managerOf, people, personColumns, personId } from '../../data';

const treeExpanded = ref<TreeExpandedState>(['p1']);
const selection = ref<SelectionState>([]);
const search = ref('');
</script>

<template>
  <p>
    <label>Search people <input v-model="search" type="search" /></label>
  </p>
  <!-- Flat data: every person is in data, and names their manager by id. -->
  <!-- select-branches: ticking a manager ticks everyone under them. -->
  <ArgusTable
    v-model:tree-expanded="treeExpanded"
    v-model:selection="selection"
    aria-label="People"
    style="block-size: 380px"
    selection-mode="multi"
    selection-checkboxes
    select-branches
    :columns="personColumns"
    :data="people"
    :get-row-id="personId"
    :get-parent-id="managerOf"
    :quick-filter="search"
  />
  <p>
    <output>{{ describeSelection(selection) }}</output>
  </p>
</template>
