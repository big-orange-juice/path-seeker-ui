<script setup lang="ts">
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import { useActionFeedback } from '@/composables/useActionFeedback';

const { state, close } = useActionFeedback();

const handleOpenChange = (open: unknown) => {
  if (!open) {
    close();
  }
};
</script>

<template>
  <Dialog :open="state.open" @update:open="handleOpenChange">
    <DialogContent
      :z-index="10500"
      class="max-w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
        <DialogTitle class="text-base font-semibold text-foreground">
          {{ state.title }}
        </DialogTitle>
        <DialogDescription
          v-if="state.description"
          class="text-sm leading-6 text-muted-foreground">
          {{ state.description }}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter class="px-5 pb-4 pt-3">
        <UiButton @click="close()">
          知道了
        </UiButton>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
