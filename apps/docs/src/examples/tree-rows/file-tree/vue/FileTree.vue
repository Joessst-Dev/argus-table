<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable, type TreeExpandedState } from '@argus-table/vue';
import { entriesOf, fileColumns, files, folderIds } from '../../data';

const treeExpanded = ref<TreeExpandedState>(['0']);
</script>

<template>
  <!-- The table has no "expand all" of its own: set treeExpanded. -->
  <p>
    <button type="button" @click="treeExpanded = folderIds">Expand all</button>
    <button type="button" @click="treeExpanded = []">Collapse all</button>
  </p>
  <!-- A folder's entries are its child rows, indented under it in the Name column. -->
  <ArgusTable
    v-model:tree-expanded="treeExpanded"
    aria-label="Files"
    style="block-size: 380px"
    :columns="fileColumns"
    :data="files"
    :get-sub-rows="entriesOf"
  />
</template>
