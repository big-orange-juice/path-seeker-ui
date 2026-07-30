<script setup lang="ts">
/**
 * 主题路线列表行操作：主操作外露，次要操作收进「更多」。
 * 外露：状态流转（提交审核/上架/下线）+ 详情入口（编辑/查看/审核）
 * 更多：海报、删除
 *
 * 菜单 Teleport 到 body + fixed 定位，避免被表格 overflow-hidden 裁切，
 * 也不被后续表格行的绘制顺序压住。
 * 用 right 贴齐触发按钮右缘，首帧不依赖菜单实测宽度。
 */
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { onClickOutside } from '#imports'
import Button from '@/components/shadcn/button/Button.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import type { RouteWorkflowActions } from '@/constants/routeWorkflow'
import type { RouteRecord } from '@/types/route'

/** 压过表格行与面板，低于 Dialog 基线 1000 */
const MENU_Z_INDEX = 800

interface Props {
  record: RouteRecord
  actions: RouteWorkflowActions
  acting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  acting: false,
})

const emit = defineEmits<{
  detail: []
  poster: []
  publish: []
  unpublish: []
  submitAudit: []
  refreshRow: []
  remove: []
}>()

const menuOpen = shallowRef(false)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
/** 打开前先写入，避免 Teleport 首帧无坐标落在视口左侧 */
const menuStyle = shallowRef<Record<string, string>>({
  position: 'fixed',
  top: '0px',
  right: '0px',
  zIndex: String(MENU_Z_INDEX),
  minWidth: '7.5rem',
  visibility: 'hidden',
})

onClickOutside(
  rootRef,
  () => {
    menuOpen.value = false
  },
  { ignore: [menuRef] },
)

const isGenerating = computed(() => Boolean(props.record.isGenerating))

/** 主状态流转按钮（最多一个） */
const primaryAction = computed(() => {
  const a = props.actions
  if (a.canSubmitAudit) {
    return { key: 'submitAudit' as const, label: '提交审核', variant: 'default' as const }
  }
  if (a.canPublish) {
    return {
      key: 'publish' as const,
      label: props.record.publishStatus === 3 ? '重新上架' : '上架',
      variant: 'default' as const,
    }
  }
  if (a.canUnpublish) {
    return { key: 'unpublish' as const, label: '下线', variant: 'outline' as const }
  }
  return null
})

const openLabel = computed(() => props.actions.openLabel)
const canOpenDetail = computed(() => props.actions.canOpenDetail && Boolean(openLabel.value))

const openVariant = computed(() => {
  if (props.actions.canAudit) return 'default' as const
  if (props.actions.canEditContent) return 'outline' as const
  return 'ghost' as const
})

/** 更多菜单项：海报始终；删除按权限 */
const moreItems = computed(() => {
  const items: Array<{
    key: 'poster' | 'remove'
    label: string
    danger?: boolean
  }> = [{ key: 'poster', label: '海报' }]
  if (props.actions.canDelete) {
    items.push({ key: 'remove', label: '删除', danger: true })
  }
  return items
})

const showMore = computed(() => !isGenerating.value && moreItems.value.length > 0)

/**
 * 用 right 对齐触发按钮右缘，不依赖菜单 width，避免首开 left 算成 0。
 * visible=false 时先藏起来，量完再显示。
 */
const updateMenuPosition = (visible = true) => {
  const trigger = triggerRef.value
  if (!trigger || typeof window === 'undefined') {
    return
  }

  const rect = trigger.getBoundingClientRect()
  const gap = 4
  const padding = 8
  const right = Math.max(padding, window.innerWidth - rect.right)

  let top = rect.bottom + gap
  const estimatedHeight = menuRef.value?.offsetHeight || moreItems.value.length * 32 + 8
  if (top + estimatedHeight > window.innerHeight - padding && rect.top > estimatedHeight + gap) {
    top = rect.top - estimatedHeight - gap
  }

  menuStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    right: `${Math.round(right)}px`,
    left: 'auto',
    zIndex: String(MENU_Z_INDEX),
    minWidth: '7.5rem',
    visibility: visible ? 'visible' : 'hidden',
  }
}

const runPrimary = () => {
  const action = primaryAction.value
  if (!action || props.acting) return
  if (action.key === 'submitAudit') emit('submitAudit')
  else if (action.key === 'publish') emit('publish')
  else if (action.key === 'unpublish') emit('unpublish')
}

const runMore = (key: 'poster' | 'remove') => {
  if (props.acting) return
  menuOpen.value = false
  if (key === 'poster') emit('poster')
  else emit('remove')
}

const toggleMenu = async () => {
  if (props.acting) return
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }

  // 打开前先按 trigger 写入坐标并隐藏，挂载后再显示，消除首帧闪到左侧
  updateMenuPosition(false)
  menuOpen.value = true
  await nextTick()
  updateMenuPosition(false)
  requestAnimationFrame(() => {
    updateMenuPosition(true)
  })
}

const onViewportChange = () => {
  if (!menuOpen.value) return
  updateMenuPosition(true)
}

watch(menuOpen, (open) => {
  if (typeof window === 'undefined') return
  if (open) {
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
  } else {
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
  }
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>

<template>
  <div ref="rootRef" class="flex flex-wrap items-center justify-start gap-1.5">
    <template v-if="isGenerating">
      <Button
        variant="ghost"
        size="sm"
        class="h-7 px-2.5 text-xs"
        :disabled="acting"
        @click="emit('refreshRow')"
      >
        <AppIcon name="refresh-cw" class="h-3.5 w-3.5" :stroke-width="1.8" />
        刷新
      </Button>
      <Button
        v-if="actions.canDelete"
        variant="secondary"
        size="sm"
        class="h-7 px-2.5 text-xs"
        :disabled="acting"
        @click="emit('remove')"
      >
        删除
      </Button>
    </template>

    <template v-else>
      <Button
        v-if="primaryAction"
        :variant="primaryAction.variant"
        size="sm"
        class="h-7 px-2.5 text-xs"
        :disabled="acting"
        @click="runPrimary"
      >
        {{ primaryAction.label }}
      </Button>

      <Button
        v-if="canOpenDetail"
        :variant="openVariant"
        size="sm"
        class="h-7 px-2.5 text-xs"
        :disabled="acting"
        :title="
          actions.canAudit
            ? '打开路线内容只读审阅，底部可提交审核结论'
            : undefined
        "
        @click="emit('detail')"
      >
        {{ openLabel }}
      </Button>

      <div v-if="showMore" class="relative">
        <div ref="triggerRef" class="inline-flex">
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2.5 text-xs"
            :disabled="acting"
            title="更多操作"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            @click="toggleMenu"
          >
            更多操作
          </Button>
        </div>

        <Teleport to="body">
          <div
            v-if="menuOpen"
            ref="menuRef"
            class="overflow-hidden rounded-md border border-border/70 bg-[#17191d] py-1 shadow-lg"
            role="menu"
            :style="menuStyle"
          >
            <button
              v-for="item in moreItems"
              :key="item.key"
              type="button"
              role="menuitem"
              class="flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
              :class="item.danger ? 'text-destructive hover:text-destructive' : 'text-foreground'"
              :disabled="acting"
              @click="runMore(item.key)"
            >
              {{ item.label }}
            </button>
          </div>
        </Teleport>
      </div>
    </template>
  </div>
</template>
