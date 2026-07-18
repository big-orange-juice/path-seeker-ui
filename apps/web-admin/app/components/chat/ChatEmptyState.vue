<script setup lang="ts">
interface Props {
  title?: string;
  description?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '开始对话',
  description: '用自然语言描述目标，助手会协助搜索资料并推进创建。',
});
</script>

<template>
  <div class="flex h-full min-h-[160px] flex-col items-center justify-center gap-1.5 px-6 text-center">
    <p class="text-sm text-muted-foreground">
      {{ props.title }}
    </p>
    <p v-if="props.description" class="max-w-[260px] text-xs leading-5 text-muted-foreground/70">
      {{ props.description }}
    </p>
  </div>
</template>
