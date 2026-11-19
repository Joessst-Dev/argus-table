<script setup lang="ts">
// Tree rows from nested data, with `v-model:tree-expanded`.
import { ref } from 'vue';
import { ArgusTable } from '../index.js';
import { size } from './data.js';

interface Node {
  id: string;
  name: string;
  kids?: Node[];
}

const nodes: Node[] = [
  { id: 'a', name: 'A', kids: [{ id: 'a1', name: 'A1' }] },
  { id: 'b', name: 'B' },
];
const treeExpanded = ref<readonly string[]>([]);
const idOf = (node: Node) => node.id;
const kidsOf = (node: Node) => node.kids;
</script>

<template>
  <output class="tree-expanded">{{ treeExpanded.join(',') }}</output>
  <ArgusTable
    v-model:tree-expanded="treeExpanded"
    :data="nodes"
    :style="size"
    :get-row-id="idOf"
    :get-sub-rows="kidsOf"
    :columns="[{ id: 'name', header: 'Name', accessor: 'name' }]"
  />
</template>
