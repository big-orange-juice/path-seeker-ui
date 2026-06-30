<script setup lang="ts">
import UiImageUpload from '@/components/ui/ImageUpload.vue';

interface Props {
  modelValue: string[];
  label?: string;
  hint?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: '地图上传',
  hint: '上传后在右侧预览。',
});

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();
</script>

<template>
  <UiImageUpload
    :model-value="props.modelValue"
    :label="props.label"
    :hint="props.hint"
    button-text="上传地图"
    item-label="地图"
    @update:model-value="emit('update:modelValue', $event)" />
</template>
