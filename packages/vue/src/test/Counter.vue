<script setup lang="ts">
// A component with state of its own, to see that a panel keeps it.
import { ref } from 'vue';

const count = ref(0);
</script>

<template>
  <button type="button" class="counter" @click="count++">{{ count }}</button>
</template>
