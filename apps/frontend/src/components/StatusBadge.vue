<script setup lang="ts">
defineProps<{ status: string }>();
</script>

<template>
  <span class="status-badge" :class="`status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`">{{ status }}</span>
</template>