<script setup lang="ts">
import { ref } from 'vue';
import { ArgusColumn, ArgusTable } from '@argus-table/vue';
import { tasks } from '../../data';

const ownerHidden = ref(true);
</script>

<template>
  <button type="button" @click="ownerHidden = !ownerHidden">
    {{ ownerHidden ? 'Show Owner' : 'Hide Owner' }}
  </button>
  <ArgusTable aria-label="Tasks" style="block-size: 280px" :data="tasks">
    <ArgusColumn
      column-id="id"
      header="#"
      accessor="id"
      :width="70"
      pin="start"
      :hideable="false"
    />
    <ArgusColumn column-id="title" header="Title" accessor="title" :width="{ flex: 2 }" />
    <!-- The standard `hidden` attribute hides a column. -->
    <ArgusColumn column-id="owner" header="Owner" accessor="owner" :hidden="ownerHidden" />
    <ArgusColumn column-id="status" header="Status" accessor="status" />
  </ArgusTable>
</template>
