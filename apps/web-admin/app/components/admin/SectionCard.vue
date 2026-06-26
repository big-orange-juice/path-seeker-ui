<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
}

defineProps<Props>();
</script>

<template>
  <UiCard class="p-4 md:p-5">
    <div v-if="title || description" class="mb-4 space-y-1">
      <h3 class="text-sm font-semibold text-foreground">{{ title }}</h3>
      <p v-if="description" class="text-xs leading-5 text-muted-foreground">{{ description }}</p>
    </div>
    <slot />
  </UiCard>
</template>
