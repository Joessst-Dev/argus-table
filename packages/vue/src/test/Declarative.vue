<script setup lang="ts">
// Template features the render-function tests can't reach: v-model, boolean
// attributes, v-for over <ArgusColumn>, a template ref, and (for vue-tsc) the
// types of events and exposed methods.
import { ref, useTemplateRef } from 'vue';
import { ArgusColumn, ArgusTable, type ArgusPlugin, type SortState } from '../index.js';
import { orders, size, type Order } from './data.js';

const ids = defineModel<string[]>('ids', { required: true });
const sorting = ref<SortState>([]);
const clicked = ref<Order[]>([]);
const table = useTemplateRef('table');
// Not reactive: a plugin's identity must stay the same between renders.
const plugins: ArgusPlugin<Order>[] = [
  { name: 'totals', columns: (defs) => [...defs, { id: 'x2', accessor: (o) => o.total * 2 }] },
];

function onRowClick(e: CustomEvent<{ row: Order }>) {
  // The row type comes from `data`: `e.detail.row.total` is a number.
  clicked.value.push(e.detail.row);
}

// vue-tsc types the template ref from what <ArgusTable> exposes.
function refresh(): Promise<void> | undefined {
  return table.value?.refresh();
}

defineExpose({ sorting, clicked, table, refresh });
</script>

<template>
  <ArgusTable
    ref="table"
    v-model:sorting="sorting"
    :data="orders"
    :style="size"
    aria-label="Orders"
    @row-click="onRowClick"
  >
    <ArgusColumn
      v-for="id in ids"
      :key="id"
      :column-id="id"
      :header="id.toUpperCase()"
      :accessor="id"
      :sortable="id === 'total' ? true : undefined"
      :width="id === 'customer' ? 'auto' : 100"
    />
    <ArgusColumn column-id="flag" header="Flag" :accessor="() => 'x'" sortable resizable />
  </ArgusTable>

  <!-- Type checks, for vue-tsc only. -->
  <template v-if="false">
    <!-- @vue-expect-error density is a keyword -->
    <ArgusTable density="cozy" />
    <!-- @vue-expect-error pin is 'start' or 'end' -->
    <ArgusColumn column-id="x" pin="left" />
    <ArgusTable :data="orders" @row-click="(e) => e.detail.row.total.toFixed()" />
    <!-- @vue-expect-error the row is an Order, which has no `name` -->
    <ArgusTable :data="orders" @row-click="(e) => e.detail.row.name" />
    <ArgusTable :data="orders" @update:sorting="(s) => s.map((i) => i.id)" />
    <ArgusTable @update:column-sizing="(s) => s['total']" @update:column-order="(o) => o.join()" />
    <ArgusTable selection-mode="multi" selection-checkboxes @update:selection="(s) => s.join()" />
    <ArgusTable
      @update:column-pinning="(p) => p['total'] === 'start'"
      @update:column-visibility="(v) => v['total'] === true"
      @column-pin="(e) => e.detail.pin"
      @column-hide="(e) => e.detail.hidden"
    />
    <ArgusColumn column-id="x" hidden :pinnable="false" :hideable="false" />
    <ArgusTable :data="orders" :plugins="plugins" />
    <!-- @vue-expect-error a plugin needs a name -->
    <ArgusTable :data="orders" :plugins="[{ keydown: () => true }]" />
    <!-- @vue-expect-error selection-mode is 'none', 'single' or 'multi' -->
    <ArgusTable selection-mode="many" />
  </template>
</template>
