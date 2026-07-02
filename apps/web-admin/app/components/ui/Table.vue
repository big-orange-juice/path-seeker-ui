<script setup lang="ts">
import ShadcnTable from '@/components/shadcn/table/Table.vue';

defineOptions({ inheritAttrs: false });

interface Props {
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
});
</script>

<template>
  <ShadcnTable :class="props.class" v-bind="$attrs">
    <slot />
  </ShadcnTable>
</template>
