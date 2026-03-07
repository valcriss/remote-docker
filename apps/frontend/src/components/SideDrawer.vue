<script setup lang="ts">
defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div v-if="open" class="drawer-backdrop" @click.self="emit('close')">
    <aside class="drawer">
      <header class="drawer-head">
        <h3>{{ title }}</h3>
        <button class="secondary" @click="emit('close')">Close</button>
      </header>
      <slot />
    </aside>
  </div>
</template>