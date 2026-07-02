<script setup lang="ts">
import Select from '@/components/shadcn/select/Select.vue';
defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ default: '' });

interface Props {
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
});
</script>

<template>
  <Select v-model="model" :class="props.class" v-bind="$attrs">
    <slot />
  </Select>
</template>
