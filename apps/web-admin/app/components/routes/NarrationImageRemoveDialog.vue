<script setup lang="ts">
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'

const props = defineProps<{
  open: boolean
  imageUrl: string
  pending: boolean
  error: string
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()
const updateOpen = (value: unknown) => {
  if (!props.pending) emit('update:open', Boolean(value))
}
</script>

<template>
  <Dialog :open="props.open" @update:open="updateOpen">
    <DialogContent class="max-w-[min(92vw,400px)] space-y-4 p-5" :show-close="!props.pending">
      <DialogHeader>
        <DialogTitle>移除配图</DialogTitle>
        <DialogDescription>确认从当前节点移除这张配图？原附件文件保留。</DialogDescription>
      </DialogHeader>
      <img v-if="props.imageUrl" :src="props.imageUrl" alt="待移除配图" class="h-40 w-full rounded-md object-contain">
      <p v-if="props.error" role="alert" class="text-sm text-destructive">{{ props.error }}</p>
      <DialogFooter>
        <Button variant="outline" size="sm" :disabled="props.pending" @click="updateOpen(false)">取消</Button>
        <Button variant="outline" size="sm" class="text-destructive" :disabled="props.pending" @click="emit('confirm')">
          {{ props.pending ? '移除中…' : '确认移除' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
