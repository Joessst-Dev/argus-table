<script setup lang="ts">
// A component in a cell: counts its mounts, and shows an injected value.
import { inject, onMounted, onUnmounted } from 'vue';
import { counts } from './counts.js';

defineProps<{ label: string }>();
const unit = inject<string>('unit', '');
const theme = inject<string>('theme', '');

onMounted(() => {
  counts.mounts++;
});
onUnmounted(() => {
  counts.unmounts++;
});
</script>

<template>
  <b class="badge">{{ label }}{{ unit }}{{ theme }}</b>
</template>
