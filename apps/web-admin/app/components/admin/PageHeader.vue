<script setup lang="ts">
interface Props {
  eyebrow: string;
  title: string;
  description: string;
}

defineProps<Props>();
</script>

<template>
  <section class="space-y-2">
    <p class="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{{ eyebrow }}</p>
    <h2 class="font-display text-[1.9rem] font-semibold tracking-tight text-foreground md:text-[2.2rem]">
      {{ title }}
    </h2>
    <p class="max-w-3xl text-sm leading-6 text-muted-foreground">
      {{ description }}
    </p>
  </section>
</template>
