<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import type { GuideRecord } from '@/types/guide'

interface Props {
  open: boolean
  guides: GuideRecord[]
  pending?: boolean
  selectedId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
  selectedId: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [guide: GuideRecord]
  search: [keyword: string]
}>()

const keyword = shallowRef('')

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      keyword.value = ''
    }
  },
)

const filteredGuides = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) {
    return props.guides
  }
  return props.guides.filter((item) => {
    const haystack = [
      item.name,
      item.guideCode,
      item.description,
      item.narrationStyle,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(text)
  })
})

const handleSelect = (guide: GuideRecord) => {
  emit('select', guide)
  isOpen.value = false
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[min(80vh,32rem)] max-w-[min(92vw,28rem)] flex-col overflow-hidden rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <div class="flex h-14 shrink-0 items-center border-b border-border/60 px-5 pr-12">
        <DialogHeader class="min-w-0 space-y-0.5 text-left">
          <DialogTitle class="text-base">
            选择导游
          </DialogTitle>
          <DialogDescription class="text-xs">
            为当前解说节点指定讲解导游。
          </DialogDescription>
        </DialogHeader>
      </div>

      <div class="shrink-0 border-b border-border/50 px-5 py-3">
        <Input
          v-model="keyword"
          placeholder="搜索导游名称"
          @keyup.enter="emit('search', keyword.trim())"
        />
      </div>

      <div class="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-3">
        <p v-if="pending" class="text-sm text-muted-foreground">
          正在加载导游列表…
        </p>
        <p v-else-if="!filteredGuides.length" class="text-sm text-muted-foreground">
          暂无可用导游。
        </p>
        <button
          v-for="guide in filteredGuides"
          :key="guide.id"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-secondary/30"
          :class="
            selectedId && selectedId === guide.id
              ? 'border-primary/50 bg-primary/10'
              : 'border-border/50 bg-background/30'
          "
          @click="handleSelect(guide)"
        >
          <img
            v-if="guide.avatarUrl"
            :src="guide.avatarUrl"
            alt=""
            class="h-9 w-9 shrink-0 rounded-md object-cover"
          >
          <div
            v-else
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary/50 text-xs text-muted-foreground"
          >
            {{ (guide.name || '?').slice(0, 1) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-foreground">
              {{ guide.name || '未命名导游' }}
            </p>
            <p class="truncate text-xs text-muted-foreground">
              {{ guide.description || guide.guideCode || '—' }}
            </p>
          </div>
        </button>
      </div>

      <DialogFooter class="h-14 shrink-0 items-center border-t border-border/60 px-5">
        <Button variant="outline" type="button" class="h-8" @click="isOpen = false">
          取消
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
