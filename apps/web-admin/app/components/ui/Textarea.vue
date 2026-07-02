<script setup lang="ts">
import ShadcnTextarea from '@/components/shadcn/textarea/Textarea.vue';

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
  <ShadcnTextarea v-model="model" :class="props.class" v-bind="$attrs" />
</template>
