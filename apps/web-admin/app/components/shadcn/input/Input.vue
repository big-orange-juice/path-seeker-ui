<script setup lang="ts">
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
  <input
    v-model="model"
    :type="props.type"
    :placeholder="props.placeholder"
    :class="[
      'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    ]"
    v-bind="$attrs"
  >
</template>
