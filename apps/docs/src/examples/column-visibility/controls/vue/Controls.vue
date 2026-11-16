<script setup lang="ts">
import { ref } from 'vue';
import {
  ArgusTable,
  type ColumnDef,
  type ColumnPinningState,
  type ColumnVisibilityState,
} from '@argus-table/vue';
import { pinOf, tasks, type PinChoice, type Task } from '../../data';

const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start', hideable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: 180 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 110 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, hidden: true },
];

// Records by column id, over the columns' own `hidden` and `pin`.
const visibility = ref<ColumnVisibilityState>({});
const pinning = ref<ColumnPinningState>({});

const shown = (column: ColumnDef<Task>) => visibility.value[column.id] ?? !column.hidden;
const pinChoice = (column: ColumnDef<Task>) => {
  const pin = pinning.value[column.id];
  return pin === undefined ? (column.pin ?? 'none') : pin || 'none';
};
const setShown = (column: ColumnDef<Task>, event: Event) => {
  visibility.value = {
    ...visibility.value,
    [column.id]: (event.target as HTMLInputElement).checked,
  };
};
const setPin = (column: ColumnDef<Task>, event: Event) => {
  const choice = (event.target as HTMLSelectElement).value as PinChoice;
  pinning.value = { ...pinning.value, [column.id]: pinOf(choice) };
};
</script>

<template>
  <form class="column-controls">
    <fieldset v-for="column in columns" :key="column.id">
      <legend>{{ column.header }}</legend>
      <label>
        <input
          type="checkbox"
          :checked="shown(column)"
          :disabled="column.hideable === false"
          @change="setShown(column, $event)"
        />
        Shown
      </label>
      <label>
        Pin
        <select :value="pinChoice(column)" @change="setPin(column, $event)">
          <option>none</option>
          <option>start</option>
          <option>end</option>
        </select>
      </label>
    </fieldset>
  </form>
  <ArgusTable
    v-model:column-visibility="visibility"
    v-model:column-pinning="pinning"
    aria-label="Tasks"
    style="block-size: 320px"
    :columns="columns"
    :data="tasks"
  />
</template>
