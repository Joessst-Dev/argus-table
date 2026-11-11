<script setup lang="ts">
// A column group's header from a `#group-<id>` slot, for a group from
// `column-groups` and for an `<ArgusColumnGroup>` child. The slot uses the
// parent's state (`currency`).
import { ArgusColumn, ArgusColumnGroup, ArgusTable } from '../index.js';
import { size, type Order } from './data.js';

defineProps<{ rows: Order[]; currency: string; declarative?: boolean }>();
</script>

<template>
  <ArgusTable
    v-if="!declarative"
    :data="rows"
    :style="size"
    :columns="[
      { id: 'id', header: 'Order', accessor: 'id', width: 90 },
      { id: 'total', header: 'Total', accessor: 'total', width: 160 },
    ]"
    :column-groups="[{ id: 'money', columns: ['total'] }]"
  >
    <template #group-money="{ groupId }">
      <i class="slot-group">{{ groupId }} in {{ currency }}</i>
    </template>
  </ArgusTable>
  <ArgusTable v-else :data="rows" :style="size">
    <ArgusColumn column-id="id" accessor="id" />
    <ArgusColumnGroup group-id="money">
      <ArgusColumn column-id="total" accessor="total" />
    </ArgusColumnGroup>
    <template #group-money="{ groupId }">
      <i class="slot-group">{{ groupId }} in {{ currency }}</i>
    </template>
  </ArgusTable>
</template>
