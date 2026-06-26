<script setup lang="ts">
const model = defineModel<string>({ default: '' });

interface Props {
  type?: string;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
});
</script>

<template>
  <input
    v-model="model"
    :type="props.type"
    :placeholder="props.placeholder"
    class="h-9 w-full rounded-md border border-border bg-secondary px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200 focus:border-primary/45 focus:bg-accent"
  >
</template>
