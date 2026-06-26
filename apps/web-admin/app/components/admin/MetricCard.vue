<script setup lang="ts">
interface Props {
  label: string;
  value: string;
  note: string;
  icon: string;
}

defineProps<Props>();
</script>

<template>
  <UiCard class="p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-2">
        <p class="text-xs text-muted-foreground">{{ label }}</p>
        <p class="font-display text-[1.75rem] font-semibold leading-none text-foreground">{{ value }}</p>
        <p class="text-xs leading-5 text-muted-foreground">{{ note }}</p>
      </div>

      <div class="rounded-lg border border-border bg-secondary p-2 text-primary">
        <Icon :name="icon" class="h-4 w-4" />
      </div>
    </div>
  </UiCard>
</template>
