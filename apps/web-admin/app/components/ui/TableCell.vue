<script setup lang="ts">
import ShadcnTableCell from '@/components/shadcn/table/TableCell.vue';

interface Props {
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
});
</script>

<template>
  <ShadcnTableCell :class="props.class">
    <slot />
  </ShadcnTableCell>
</template>
