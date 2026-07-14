<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';

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
  <div class="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 px-6 text-center">
    <div class="flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-muted/40">
      <AppIcon name="sparkles" class="h-5 w-5 text-primary" />
    </div>
    <div class="space-y-1">
      <p class="text-sm font-medium text-foreground">
        {{ props.title }}
      </p>
      <p class="max-w-[320px] text-xs leading-5 text-muted-foreground">
        {{ props.description }}
      </p>
    </div>
  </div>
</template>
