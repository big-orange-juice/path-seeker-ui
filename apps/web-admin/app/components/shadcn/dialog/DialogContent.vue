<script setup lang="ts">
import { computed, inject, onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { dialogContextKey } from './context'
import { createDialogLayerHandle } from './layer'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{
  class?: string
  /**
   * 可选：强制指定 z-index。
   * 默认由全局层级栈按打开顺序自动递增，一般无需传入。
   * 仅在需要压过全局栈（如登录过期提示）时使用。
   */
  zIndex?: number
  /**
   * 是否在右上角显示统一关闭按钮。
   * 默认开启；登录过期等强制弹窗可关闭。
   */
  showClose?: boolean
}>(), {
  class: '',
  zIndex: undefined,
  showClose: true,
})

const dialog = inject(dialogContextKey)
if (!dialog) {
  throw new Error('DialogContent must be used inside Dialog')
}

const layer = createDialogLayerHandle()

const overlayZIndex = computed(() => {
  if (typeof props.zIndex === 'number' && Number.isFinite(props.zIndex)) {
    return props.zIndex
  }
  return layer.zIndex.value
})

const handleEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    return
  }
  // 仅最顶层 dialog 响应 Esc，避免一次关掉整条栈
  if (!layer.isTopmost.value) {
    return
  }
  // 大图预览打开时先交给预览层关闭，不连带关掉业务弹窗
  if (typeof document !== 'undefined' && document.querySelector('[data-image-lightbox]')) {
    return
  }
  event.stopPropagation()
  dialog.setOpen(false)
}

const bindEscape = () => {
  window.addEventListener('keydown', handleEscape, true)
}

const unbindEscape = () => {
  window.removeEventListener('keydown', handleEscape, true)
}

const closeDialog = () => {
  dialog.setOpen(false)
}

watch(
  () => dialog.open.value,
  (open) => {
    if (open) {
      layer.acquire()
      bindEscape()
      return
    }
    unbindEscape()
    layer.release()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  unbindEscape()
  layer.release()
})

/** 调用方已写 max-w 时不再套默认 1360，避免确认框被撑满 */
const contentClass = computed(() => {
  const extra = props.class || ''
  const hasMaxWidth = /\bmax-w-/.test(extra)

  return cn(
    // 高度上限由 .admin-dialog-overlay > [role=dialog] 统一按 --admin-ui-zoom 反算
    'warm-panel warm-outline relative w-full rounded-[0.95rem] border border-border/80 bg-[#111316]',
    !hasMaxWidth && 'max-w-[1360px]',
    extra,
  )
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <!--
        UI 缩放挂在 html 的 zoom 上时，fixed inset-0 会被一起放大而溢出视口。
        用 width/height = 100vw|/|--admin-ui-zoom 反算，使遮罩视觉上仍贴满屏幕；
        遮罩本身可滚动，避免大弹窗被裁切。
      -->
      <div
        v-if="dialog.open.value"
        class="admin-dialog-overlay fixed left-0 top-0 flex items-start justify-center overflow-x-hidden overflow-y-auto bg-black/65 px-4 py-6 backdrop-blur-sm sm:items-center"
        :style="{ zIndex: overlayZIndex }"
        data-dialog-overlay
      >
        <div
          role="dialog"
          aria-modal="true"
          :aria-labelledby="dialog.titleId.value"
          :aria-describedby="dialog.descriptionId.value"
          :class="contentClass"
        >
          <!-- 统一右上角关闭：所有业务弹窗默认具备 -->
          <button
            v-if="props.showClose"
            type="button"
            class="absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
            title="关闭"
            aria-label="关闭"
            @click="closeDialog"
          >
            <X class="h-4 w-4" :stroke-width="2" />
          </button>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
