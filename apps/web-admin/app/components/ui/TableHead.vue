<script setup lang="ts">
import ShadcnTableHead from '@/components/shadcn/table/TableHead.vue';

interface Props {
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
});
</script>

<template>
  <ShadcnTableHead :class="props.class">
    <slot />
  </ShadcnTableHead>
</template>
