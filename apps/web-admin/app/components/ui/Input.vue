<script setup lang="ts">
import ShadcnInput from '@/components/shadcn/input/Input.vue';

defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ default: '' });

interface Props {
  type?: string;
  placeholder?: string;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  class: '',
});
</script>

<template>
  <ShadcnInput
    v-model="model"
    :type="props.type"
    :placeholder="props.placeholder"
    :class="props.class"
    v-bind="$attrs" />
</template>
