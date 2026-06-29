<script setup lang="ts">
import { computed, nextTick, shallowRef } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { PuzzleAnswerDraft, SortPuzzleDefinition } from "../../contracts"

interface Props {
  puzzle: SortPuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}

interface LayoutRect {
  id: string
  top: number
  height: number
  center: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const itemElements = new Map<string, HTMLElement>()
const draggingId = shallowRef("")
const startIndex = shallowRef(-1)
const hoverIndex = shallowRef(-1)
const dragDeltaY = shallowRef(0)
const startPointerY = shallowRef(0)
const layoutRects = shallowRef<LayoutRect[]>([])

const { root, animateSelector } = useRendererMotion(() => {
  gsap.from(".sort-card", {
    autoAlpha: 0,
    x: 24,
    duration: 0.38,
    ease: "power2.out",
    stagger: 0.06,
  })
})

const order = computed<string[]>(() => {
  const value = props.modelValue?.value

  if (Array.isArray(value)) {
    const candidate = value as unknown[]
    if (candidate.every((item) => typeof item === "string")) {
      return candidate as string[]
    }
  }

  return props.puzzle.questionPayload.items.map((item) => item.id)
})

const orderedItems = computed(() =>
  order.value
    .map((id) => props.puzzle.questionPayload.items.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
)

const slotHeight = computed(() => {
  if (layoutRects.value.length > 1) {
    return layoutRects.value[1].top - layoutRects.value[0].top
  }

  return layoutRects.value[0]?.height || 108
})

function registerItem(id: string) {
  return (element: Element | null) => {
    if (!(element instanceof HTMLElement)) {
      itemElements.delete(id)
      return
    }

    itemElements.set(id, element)
  }
}

function readClientY(event: TouchEvent) {
  return event.touches[0]?.clientY ?? event.changedTouches[0]?.clientY ?? 0
}

function snapshotLayout() {
  layoutRects.value = order.value
    .map((id) => {
      const element = itemElements.get(id)

      if (!element) {
        return null
      }

      const rect = element.getBoundingClientRect()
      return {
        id,
        top: rect.top,
        height: rect.height,
        center: rect.top + rect.height / 2,
      }
    })
    .filter((item): item is LayoutRect => Boolean(item))
}

function updateOrder(nextOrder: string[]) {
  emit("update:modelValue", {
    templateType: "sort",
    value: nextOrder,
  })
}

function handleDragStart(id: string, index: number, event: TouchEvent) {
  if (props.readonlyMode) {
    return
  }

  snapshotLayout()
  draggingId.value = id
  startIndex.value = index
  hoverIndex.value = index
  dragDeltaY.value = 0
  startPointerY.value = readClientY(event)
}

function handleDragMove(event: TouchEvent) {
  if (!draggingId.value || startIndex.value < 0) {
    return
  }

  const clientY = readClientY(event)
  dragDeltaY.value = clientY - startPointerY.value

  const draggedRect = layoutRects.value[startIndex.value]

  if (!draggedRect) {
    return
  }

  const activeCenter = draggedRect.center + dragDeltaY.value
  let nextIndex = startIndex.value
  let minDistance = Number.POSITIVE_INFINITY

  layoutRects.value.forEach((rect, index) => {
    const distance = Math.abs(rect.center - activeCenter)

    if (distance < minDistance) {
      minDistance = distance
      nextIndex = index
    }
  })

  hoverIndex.value = nextIndex
}

async function finishDrag() {
  if (!draggingId.value || startIndex.value < 0) {
    return
  }

  const fromIndex = startIndex.value
  const toIndex = hoverIndex.value

  if (toIndex !== fromIndex) {
    const next = [...order.value]
    const [current] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, current)
    updateOrder(next)

    await nextTick()
    animateSelector(
      ".sort-card",
      { y: 12, autoAlpha: 0.9 },
      { y: 0, autoAlpha: 1, duration: 0.28, stagger: 0.03, ease: "power2.out" },
    )
  }

  draggingId.value = ""
  startIndex.value = -1
  hoverIndex.value = -1
  dragDeltaY.value = 0
}

function handleDragCancel() {
  draggingId.value = ""
  startIndex.value = -1
  hoverIndex.value = -1
  dragDeltaY.value = 0
}

function cardStyle(id: string, index: number) {
  if (!draggingId.value || startIndex.value < 0 || hoverIndex.value < 0) {
    return {}
  }

  if (id === draggingId.value) {
    return {
      zIndex: "3",
      transform: `translateY(${dragDeltaY.value}px) scale(1.02)`,
      boxShadow: "0 18rpx 36rpx rgba(0, 0, 0, 0.24)",
    }
  }

  const height = slotHeight.value

  if (startIndex.value < hoverIndex.value && index > startIndex.value && index <= hoverIndex.value) {
    return {
      transform: `translateY(${-height}px)`,
    }
  }

  if (startIndex.value > hoverIndex.value && index >= hoverIndex.value && index < startIndex.value) {
    return {
      transform: `translateY(${height}px)`,
    }
  }

  return {}
}
</script>

<template>
  <view ref="root" class="sort-stage">
    <view class="sort-brief">
      <text class="sort-title">拖动排序</text>
      <text class="sort-copy">按你在展品前真正观察的先后顺序，把步骤拖回正确位置。</text>
    </view>

    <view class="sort-list">
      <view
        v-for="(item, index) in orderedItems"
        :key="item.id"
        :ref="registerItem(item.id)"
        class="sort-card"
        :class="{ 'is-dragging': draggingId === item.id, 'is-shifted': hoverIndex === index && draggingId !== item.id }"
        :style="cardStyle(item.id, index)"
        @touchstart.stop="handleDragStart(item.id, index, $event)"
        @touchmove.stop.prevent="handleDragMove($event)"
        @touchend.stop="finishDrag"
        @touchcancel.stop="handleDragCancel"
      >
        <view class="sort-index">{{ index + 1 }}</view>
        <view class="sort-copyblock">
          <text class="sort-label">{{ item.label }}</text>
          <text class="sort-hint">{{ index === 0 ? "从起点动作开始拖" : "拖到更合适的位置即可换序" }}</text>
        </view>
        <view class="sort-handle">
          <text class="handle-line"></text>
          <text class="handle-line"></text>
          <text class="handle-line"></text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.sort-stage {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.sort-brief {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 18rpx 18rpx 0;
}

.sort-title {
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.sort-copy {
  color: rgba(247, 239, 221, 0.56);
  font-size: 22rpx;
  line-height: 1.42;
}

.sort-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.sort-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 108rpx;
  padding: 16rpx;
  border-radius: 24rpx;
  background:
    radial-gradient(circle at 92% 16%, rgba(209, 178, 111, 0.12), transparent 26%),
    rgba(255, 255, 255, 0.045);
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.sort-card.is-dragging {
  background:
    radial-gradient(circle at 92% 16%, rgba(243, 217, 157, 0.2), transparent 28%),
    rgba(54, 43, 24, 0.92);
}

.sort-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 18rpx;
  background: rgba(209, 178, 111, 0.18);
  color: #fff8ea;
  font-size: 24rpx;
  font-weight: 900;
}

.sort-copyblock {
  flex: 1;
  min-width: 0;
}

.sort-label {
  color: #fff8ea;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.3;
}

.sort-hint {
  display: block;
  margin-top: 8rpx;
  color: rgba(247, 239, 221, 0.52);
  font-size: 20rpx;
  line-height: 1.34;
}

.sort-handle {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 6rpx 0;
}

.handle-line {
  width: 24rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: rgba(247, 239, 221, 0.34);
}
</style>
