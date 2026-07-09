<script setup lang="ts">
import { computed, nextTick, shallowRef } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { PuzzleAnswerDraft, SortPuzzleDefinition } from "../../contracts"
import type { ComponentPublicInstance } from "vue"

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
    const current = layoutRects.value[0]
    const next = layoutRects.value[1]
    return current && next ? next.top - current.top : 108
  }

  return layoutRects.value[0]?.height || 108
})

function registerItem(id: string) {
  return (element: Element | ComponentPublicInstance | null) => {
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
    if (!current) {
      return
    }

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
      boxShadow: "0 18px 36px rgba(0, 0, 0, 0.24)",
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
  <div ref="root" class="sort-stage">
    <div class="sort-brief">
      <span class="sort-title">拖动排序</span>
      <span class="sort-copy">按你在展品前真正观察的先后顺序，把步骤拖回正确位置。</span>
    </div>

    <div class="sort-list">
      <div
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
        <div class="sort-index">{{ index + 1 }}</div>
        <div class="sort-copyblock">
          <span class="sort-label">{{ item.label }}</span>
          <span class="sort-hint">{{ index === 0 ? "从起点动作开始拖" : "拖到更合适的位置即可换序" }}</span>
        </div>
        <div class="sort-handle">
          <span class="handle-line"></span>
          <span class="handle-line"></span>
          <span class="handle-line"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sort-stage {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.sort-brief {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 18px 0;
}

.sort-title {
  color: #d1b26f;
  font-size: 22px;
  font-weight: 900;
}

.sort-copy {
  color: rgba(247, 239, 221, 0.56);
  font-size: 22px;
  line-height: 1.42;
}

.sort-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sort-card {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 108px;
  padding: 16px;
  border-radius: 24px;
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
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: rgba(209, 178, 111, 0.18);
  color: #fff8ea;
  font-size: 24px;
  font-weight: 900;
}

.sort-copyblock {
  flex: 1;
  min-width: 0;
}

.sort-label {
  color: #fff8ea;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.3;
}

.sort-hint {
  display: block;
  margin-top: 8px;
  color: rgba(247, 239, 221, 0.52);
  font-size: 20px;
  line-height: 1.34;
}

.sort-handle {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0;
}

.handle-line {
  width: 24px;
  height: 4px;
  border-radius: 999px;
  background: rgba(247, 239, 221, 0.34);
}
</style>
