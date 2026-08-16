<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import RouteChatWorkspace from '@/components/routes/RouteChatWorkspace.vue';

interface Props {
  open: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  routeChanged: [routeId: string];
  routePublished: [routeId: string];
  /** AI 新建对话一轮 done 且已有 routeId */
  runCompleted: [routeId: string];
}>();

const chatWorkspaceRef = ref<InstanceType<typeof RouteChatWorkspace> | null>(null);

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const resetForm = () => {
  chatWorkspaceRef.value?.resetSession();
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetForm();
      return;
    }

    // 关闭时中断流式并清空表单/会话，避免下次打开残留上一次内容
    chatWorkspaceRef.value?.abortActiveRun();
    resetForm();
  },
);

</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[90vh] max-w-[min(96vw,1280px)] flex-col overflow-hidden p-0">
      <div class="flex h-14 shrink-0 items-center border-b border-border/70 px-5 pr-12">
        <DialogHeader class="min-w-0 space-y-0.5 text-left">
          <DialogTitle class="text-base">
            新增主题路线
          </DialogTitle>
          <DialogDescription class="text-xs">
            输入一句话主题，通过对话创建路线。
          </DialogDescription>
        </DialogHeader>
      </div>

      <div class="flex min-h-0 flex-1 flex-col">
        <RouteChatWorkspace
          ref="chatWorkspaceRef"
          :active="props.open"
          @route-changed="emit('routeChanged', $event)"
          @route-published="emit('routePublished', $event)"
          @run-completed="emit('runCompleted', $event)" />
      </div>

      <DialogFooter class="h-14 shrink-0 items-center border-t border-border/70 px-5">
        <Button
          variant="outline"
          type="button"
          class="h-8"
          @click="isOpen = false">
          关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
