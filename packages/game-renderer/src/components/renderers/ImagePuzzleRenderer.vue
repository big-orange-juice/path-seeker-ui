<script setup lang="ts">
import { computed, nextTick, shallowRef } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { ImagePuzzleDefinition, PuzzleAnswerDraft } from "../../contracts"
import type { ComponentPublicInstance } from "vue"

interface Props {
  puzzle: ImagePuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const tileElements = new Map<string, HTMLElement>()
const draggingId = shallowRef("")
const dragStartIndex = shallowRef(-1)
const dragTargetIndex = shallowRef(-1)
const dragOffsetX = shallowRef(0)
const dragOffsetY = shallowRef(0)
const startX = shallowRef(0)
const startY = shallowRef(0)

function isStringOrder(value: PuzzleAnswerDraft["value"] | undefined): value is string[] {
  if (!Array.isArray(value)) {
    return false
  }

  return (value as unknown[]).every((item) => typeof item === "string")
}

const { root, animateSelector } = useRendererMotion(() => {
  const tl = gsap.timeline({ defaults: { ease: "power2.out" } })

  tl.from(".reference-card", {
    autoAlpha: 0,
    y: 18,
    duration: 0.3,
  }).from(
    ".puzzle-tile",
    {
      autoAlpha: 0,
      scale: 0.92,
      duration: 0.3,
      stagger: 0.03,
    },
    "-=0.14",
  )
})

const currentOrder = computed<string[]>(() => {
  const value = props.modelValue?.value

  if (isStringOrder(value)) {
    return value
  }

  return props.puzzle.questionPayload.pieces.map((piece) => piece.id)
})

const gridSize = computed(() => Math.max(props.puzzle.questionPayload.gridSize || 2, 2))
const isSolved = computed(
  () => JSON.stringify(currentOrder.value) === JSON.stringify(props.puzzle.questionPayload.correctOrder),
)

function updateOrder(nextOrder: string[]) {
  emit("update:modelValue", {
    templateType: "image_puzzle",
    value: nextOrder,
  })
}

function registerTile(id: string) {
  return (element: Element | ComponentPublicInstance | null) => {
    if (!(element instanceof HTMLElement)) {
      tileElements.delete(id)
      return
    }

    tileElements.set(id, element)
  }
}

function readTouchPoint(event: TouchEvent) {
  const point = event.touches[0] || event.changedTouches[0]
  return {
    x: point?.clientX || 0,
    y: point?.clientY || 0,
  }
}

function tileStyle(pieceId: string, index: number) {
  const correctIndex = props.puzzle.questionPayload.correctOrder.indexOf(pieceId)
  const total = gridSize.value
  const row = Math.floor(correctIndex / total)
  const col = correctIndex % total
  const translateStyle =
    draggingId.value === pieceId
      ? `translate(${dragOffsetX.value}px, ${dragOffsetY.value}px) scale(1.04)`
      : dragTargetIndex.value === index && draggingId.value
        ? "scale(0.96)"
        : "translate(0, 0) scale(1)"

  return {
    backgroundImage: props.puzzle.questionPayload.imageUrl
      ? `linear-gradient(180deg, rgba(16, 18, 22, 0.12), rgba(16, 18, 22, 0.12)), url(${props.puzzle.questionPayload.imageUrl})`
      : "linear-gradient(135deg, rgba(209, 178, 111, 0.4), rgba(13, 15, 19, 0.92))",
    backgroundSize: `${total * 100}% ${total * 100}%`,
    backgroundPosition: `${total > 1 ? (col / (total - 1)) * 100 : 0}% ${total > 1 ? (row / (total - 1)) * 100 : 0}%`,
    transform: translateStyle,
    zIndex: draggingId.value === pieceId ? "3" : "1",
  }
}

function handleDragStart(pieceId: string, index: number, event: TouchEvent) {
  if (props.readonlyMode) {
    return
  }

  const point = readTouchPoint(event)
  draggingId.value = pieceId
  dragStartIndex.value = index
  dragTargetIndex.value = index
  startX.value = point.x
  startY.value = point.y
  dragOffsetX.value = 0
  dragOffsetY.value = 0
}

function handleDragMove(event: TouchEvent) {
  if (!draggingId.value) {
    return
  }

  const point = readTouchPoint(event)
  dragOffsetX.value = point.x - startX.value
  dragOffsetY.value = point.y - startY.value

  const hoveredId = currentOrder.value.find((pieceId) => {
    const element = tileElements.get(pieceId)

    if (!element) {
      return false
    }

    const rect = element.getBoundingClientRect()
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  })

  if (!hoveredId) {
    return
  }

  dragTargetIndex.value = currentOrder.value.findIndex((item) => item === hoveredId)
}

async function finishDrag() {
  if (!draggingId.value || dragStartIndex.value < 0) {
    return
  }

  if (dragTargetIndex.value >= 0 && dragTargetIndex.value !== dragStartIndex.value) {
    const next = [...currentOrder.value]
    const swapPiece = next[dragTargetIndex.value]
    const draggedPiece = next[dragStartIndex.value]
    if (!swapPiece || !draggedPiece) {
      return
    }

    next[dragTargetIndex.value] = draggedPiece
    next[dragStartIndex.value] = swapPiece
    updateOrder(next)

    await nextTick()
    animateSelector(
      ".puzzle-tile",
      { scale: 0.94, autoAlpha: 0.92 },
      { scale: 1, autoAlpha: 1, duration: 0.28, stagger: 0.02, ease: "back.out(1.6)" },
    )
  }

  draggingId.value = ""
  dragStartIndex.value = -1
  dragTargetIndex.value = -1
  dragOffsetX.value = 0
  dragOffsetY.value = 0
}

function cancelDrag() {
  draggingId.value = ""
  dragStartIndex.value = -1
  dragTargetIndex.value = -1
  dragOffsetX.value = 0
  dragOffsetY.value = 0
}

function tileMeta(index: number) {
  return props.puzzle.questionPayload.pieces.find((piece) => piece.id === currentOrder.value[index])
}
</script>

<template>
  <view ref="root" class="image-puzzle-stage">
    <view class="reference-card">
      <view>
        <text class="reference-title">{{ puzzle.questionPayload.revealTitle || "碎片复原" }}</text>
        <text class="reference-copy">{{ puzzle.questionPayload.trayTitle || "拖动拼块，交换位置，还原完整原图。" }}</text>
      </view>
      <text class="reference-state">{{ isSolved ? "已复原" : `${gridSize} × ${gridSize}` }}</text>
    </view>

    <view class="puzzle-grid" :style="{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }">
      <view
        v-for="(pieceId, index) in currentOrder"
        :key="pieceId"
        :ref="registerTile(pieceId)"
        class="puzzle-tile"
        :class="{ 'is-dragging': draggingId === pieceId, 'is-target': dragTargetIndex === index && draggingId && draggingId !== pieceId }"
        :style="tileStyle(pieceId, index)"
        @touchstart.stop="handleDragStart(pieceId, index, $event)"
        @touchmove.stop.prevent="handleDragMove($event)"
        @touchend.stop="finishDrag"
        @touchcancel.stop="cancelDrag"
      >
        <view class="tile-caption">
          <text class="tile-index">{{ index + 1 }}</text>
          <text class="tile-label">{{ tileMeta(index)?.label }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.image-puzzle-stage {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.reference-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  background:
    radial-gradient(circle at 92% 14%, rgba(209, 178, 111, 0.18), transparent 26%),
    rgba(255, 255, 255, 0.05);
}

.reference-title {
  color: #fff8ea;
  font-size: 26rpx;
  font-weight: 900;
}

.reference-copy {
  display: block;
  margin-top: 8rpx;
  color: rgba(247, 239, 221, 0.58);
  font-size: 22rpx;
  line-height: 1.42;
}

.reference-state {
  flex: 0 0 auto;
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.puzzle-grid {
  display: grid;
  gap: 10rpx;
}

.puzzle-tile {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1;
  border-radius: 20rpx;
  background-color: rgba(255, 255, 255, 0.06);
  background-repeat: no-repeat;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.puzzle-tile.is-dragging {
  box-shadow: 0 16rpx 32rpx rgba(0, 0, 0, 0.24);
}

.puzzle-tile.is-target {
  box-shadow: inset 0 0 0 2rpx rgba(243, 217, 157, 0.42);
}

.tile-caption {
  position: absolute;
  left: 10rpx;
  right: 10rpx;
  bottom: 10rpx;
  padding: 10rpx 12rpx;
  border-radius: 18rpx;
  background: rgba(11, 12, 15, 0.68);
  backdrop-filter: blur(8px);
}

.tile-index {
  color: #d1b26f;
  font-size: 18rpx;
  font-weight: 900;
}

.tile-label {
  display: block;
  margin-top: 4rpx;
  color: #fff8ea;
  font-size: 20rpx;
  line-height: 1.3;
  font-weight: 800;
}
</style>
