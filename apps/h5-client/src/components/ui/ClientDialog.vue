<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from "@path-seeker/ui"

interface Props {
  open: boolean
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  pending?: boolean
  confirmDisabled?: boolean
  contentClass?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  description: "",
  confirmText: "确认",
  cancelText: "取消",
  showCancel: true,
  pending: false,
  confirmDisabled: false,
  contentClass: undefined,
})

const emit = defineEmits<{
  "update:open": [value: boolean]
  cancel: []
  confirm: []
}>()

function handleOpenChange(value: boolean) {
  emit("update:open", value)
}

function handleCancel() {
  emit("cancel")
  emit("update:open", false)
}

function handleConfirm() {
  emit("confirm")
}
</script>

<template>
  <Dialog :open="props.open" @update:open="handleOpenChange">
    <DialogContent :class="cn('rounded-[1rem] border-border bg-card p-0 shadow-soft', props.contentClass)">
      <div class="space-y-5 p-5">
        <DialogHeader v-if="props.title || props.description" class="space-y-2">
          <DialogTitle v-if="props.title" class="font-display text-xl text-foreground">{{ props.title }}</DialogTitle>
          <DialogDescription v-if="props.description" class="text-sm leading-6 text-muted-foreground">
            {{ props.description }}
          </DialogDescription>
        </DialogHeader>

        <slot />

        <DialogFooter class="gap-3 sm:gap-3">
          <Button v-if="props.showCancel" variant="outline" class="w-full sm:w-auto" :disabled="props.pending" @click="handleCancel()">
            {{ props.cancelText }}
          </Button>
          <Button class="w-full sm:w-auto" :disabled="props.pending || props.confirmDisabled" @click="handleConfirm()">
            {{ props.pending ? "处理中..." : props.confirmText }}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
