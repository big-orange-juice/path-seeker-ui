<script setup lang="ts">
import { computed, nextTick, onUnmounted, shallowRef } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { ImagePuzzleDefinition, PuzzleAnswerDraft } from "../../contracts"

interface Props {
  puzzle: ImagePuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const boardRef = shallowRef<HTMLElement | null>(null)
const draggingFrom = shallowRef<number | null>(null)
const hoverTo = shallowRef<number | null>(null)
let activePointerId: number | null = null

function isStringOrder(value: PuzzleAnswerDraft["value"] | undefined): value is string[] {
  if (!Array.isArray(value)) {
    return false
  }
  return (value as unknown[]).every((item) => typeof item === "string")
}

/**
 * 入场只做位移/缩放，不碰 autoAlpha。
 * 旧实现 from(autoAlpha:0) 在父级重渲染、swap killTweens、或 context.revert
 * 时容易卡在半透明，表现为拼块（尤其 stagger 后半段）发黑发暗。
 */
const { root, animateSelector } = useRendererMotion(() => {
  const tiles = gsap.utils.toArray<HTMLElement>(".puzzle-tile")
  if (!tiles.length) {
    return
  }

  gsap.set(tiles, { autoAlpha: 1, opacity: 1, visibility: "visible" })
  gsap.fromTo(
    tiles,
    { scale: 0.94, y: 10 },
    {
      scale: 1,
      y: 0,
      duration: 0.28,
      stagger: 0.022,
      ease: "power2.out",
      overwrite: true,
      clearProps: "transform",
    },
  )
})

const currentOrder = computed<string[]>(() => {
  const value = props.modelValue?.value
  if (isStringOrder(value) && value.length > 0) {
    return value
  }
  return props.puzzle.questionPayload.pieces.map((piece) => piece.id)
})

const gridSize = computed(() => {
  const configured = Number(props.puzzle.questionPayload.gridSize || 0)
  if (configured >= 2) {
    return Math.min(4, configured)
  }
  const count = props.puzzle.questionPayload.pieces.length
  if (count >= 4) {
    return Math.max(2, Math.min(4, Math.round(Math.sqrt(count))))
  }
  return 3
})

const hasImage = computed(() => Boolean(String(props.puzzle.questionPayload.imageUrl || "").trim()))

const isSolved = computed(() => {
  const correct = props.puzzle.questionPayload.correctOrder
  if (!correct.length || !currentOrder.value.length) {
    return false
  }
  return (
    currentOrder.value.length === correct.length
    && currentOrder.value.every((id, index) => id === correct[index])
  )
})

const hintText = computed(() =>
  props.puzzle.questionPayload.trayTitle
  || props.puzzle.questionPayload.prompt
  || "将碎片拖回正确位置，完成纹样复原。",
)

function updateOrder(nextOrder: string[]) {
  emit("update:modelValue", {
    templateType: "image_puzzle",
    value: nextOrder,
  })
}

/** 拼块背景：编号块用 piece 在正确序中的行列切图 */
function tileFaceStyle(pieceId: string) {
  const correctIndex = props.puzzle.questionPayload.correctOrder.indexOf(pieceId)
  const total = gridSize.value
  const safeIndex = correctIndex >= 0 ? correctIndex : 0
  const row = Math.floor(safeIndex / total)
  const col = safeIndex % total

  if (!hasImage.value) {
    return {
      backgroundImage: "none",
      backgroundColor: "rgba(255, 255, 255, 0.055)",
    }
  }

  return {
    backgroundImage: `url(${props.puzzle.questionPayload.imageUrl})`,
    backgroundSize: `${total * 100}% ${total * 100}%`,
    backgroundPosition: `${total > 1 ? (col / (total - 1)) * 100 : 0}% ${total > 1 ? (row / (total - 1)) * 100 : 0}%`,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  }
}

function pieceNumber(pieceId: string) {
  const correctIndex = props.puzzle.questionPayload.correctOrder.indexOf(pieceId)
  if (correctIndex >= 0) {
    return correctIndex + 1
  }
  const piece = props.puzzle.questionPayload.pieces.find((item) => item.id === pieceId)
  const fromLabel = Number(piece?.label)
  if (Number.isFinite(fromLabel) && fromLabel > 0) {
    return fromLabel
  }
  return ""
}

function slotFromPoint(clientX: number, clientY: number): number | null {
  const board = boardRef.value
  if (!board) {
    return null
  }

  // 用元素命中，避免 transform 位移导致的错位
  const el = document.elementFromPoint(clientX, clientY)
  const tile = el?.closest?.("[data-slot]") as HTMLElement | null
  if (!tile || !board.contains(tile)) {
    return null
  }

  const slot = Number(tile.dataset.slot)
  return Number.isFinite(slot) ? slot : null
}

function onPointerDown(slot: number, event: PointerEvent) {
  if (props.readonlyMode || isSolved.value) {
    return
  }

  event.preventDefault()
  activePointerId = event.pointerId
  draggingFrom.value = slot
  hoverTo.value = slot

  const target = event.currentTarget as HTMLElement | null
  try {
    target?.setPointerCapture(event.pointerId)
  } catch {
    /* ignore */
  }
}

function onPointerMove(event: PointerEvent) {
  if (draggingFrom.value === null || activePointerId !== event.pointerId) {
    return
  }

  const slot = slotFromPoint(event.clientX, event.clientY)
  if (slot !== null) {
    hoverTo.value = slot
  }
}

async function onPointerUp(event: PointerEvent) {
  if (draggingFrom.value === null || activePointerId !== event.pointerId) {
    return
  }

  const from = draggingFrom.value
  const to = slotFromPoint(event.clientX, event.clientY)

  draggingFrom.value = null
  hoverTo.value = null
  activePointerId = null

  if (to === null || to === from || to < 0 || to >= currentOrder.value.length) {
    return
  }

  const next = [...currentOrder.value]
  const a = next[from]
  const b = next[to]
  if (!a || !b) {
    return
  }

  next[from] = b
  next[to] = a
  updateOrder(next)

  await nextTick()
  // 交换反馈同样不改 opacity，避免 kill 入场 tween 后遗留暗色
  animateSelector(
    ".puzzle-tile",
    { scale: 0.97 },
    {
      scale: 1,
      duration: 0.18,
      stagger: 0.012,
      ease: "power2.out",
      overwrite: "auto",
      clearProps: "transform",
    },
  )
}

function onPointerCancel(event: PointerEvent) {
  if (activePointerId !== null && event.pointerId !== activePointerId) {
    return
  }
  draggingFrom.value = null
  hoverTo.value = null
  activePointerId = null
}

onUnmounted(() => {
  draggingFrom.value = null
  hoverTo.value = null
  activePointerId = null
})
</script>

<template>
  <div ref="root" class="image-puzzle-stage">
    <p class="puzzle-hint">{{ hintText }}</p>

    <div
      ref="boardRef"
      class="puzzle-grid"
      :class="{ 'is-solved': isSolved }"
      :style="{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }"
    >
      <button
        v-for="(pieceId, index) in currentOrder"
        :key="`${pieceId}@${index}`"
        type="button"
        class="puzzle-tile"
        :class="{
          'is-dragging': draggingFrom === index,
          'is-target': hoverTo === index && draggingFrom !== null && draggingFrom !== index,
          'is-readonly': readonlyMode || isSolved,
          'has-image': hasImage,
        }"
        :data-slot="index"
        :data-piece-id="pieceId"
        :style="tileFaceStyle(pieceId)"
        :disabled="readonlyMode || isSolved"
        @pointerdown="onPointerDown(index, $event)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
      >
        <span v-if="!hasImage" class="tile-number">{{ pieceNumber(pieceId) }}</span>
      </button>
    </div>

    <p v-if="isSolved" class="puzzle-solved">已复原</p>
    <p v-else-if="!puzzle.questionPayload.pieces.length" class="puzzle-empty">
      暂无拼图碎片配置
    </p>
  </div>
</template>

<style scoped>
.image-puzzle-stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.puzzle-hint {
  margin: 0;
  color: rgba(247, 239, 221, 0.58);
  font-size: 13px;
  line-height: 1.5;
}

.puzzle-grid {
  display: grid;
  gap: 8px;
  width: 100%;
  /* 正方形棋盘，避免宽高比导致视觉错位 */
  aspect-ratio: 1;
  padding: 0;
}

.puzzle-tile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 14px;
  /* 保证可见：禁止入场/中断动画把 opacity 留在 0 */
  opacity: 1;
  visibility: visible;
  background-color: rgba(255, 255, 255, 0.08);
  background-repeat: no-repeat;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  color: inherit;
  touch-action: none;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  transition:
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}

.puzzle-tile.has-image {
  background-color: rgba(0, 0, 0, 0.22);
}

.puzzle-tile.is-readonly,
.puzzle-tile:disabled {
  cursor: default;
}

.puzzle-tile.is-dragging {
  cursor: grabbing;
  opacity: 0.88;
  box-shadow:
    inset 0 0 0 1.5px rgba(243, 217, 157, 0.5),
    0 0 0 1px rgba(209, 178, 111, 0.18);
}

.puzzle-tile.is-target {
  box-shadow: inset 0 0 0 1.5px rgba(243, 217, 157, 0.55);
  background-color: rgba(209, 178, 111, 0.1);
}

.tile-number {
  color: rgba(243, 217, 157, 0.88);
  font-size: clamp(1rem, 4.2vw, 1.2rem);
  font-weight: 600;
  letter-spacing: 0.02em;
  pointer-events: none;
  opacity: 1;
}

.puzzle-grid.is-solved .tile-number {
  color: rgba(209, 178, 111, 0.92);
}

.puzzle-solved {
  margin: 0;
  color: rgba(209, 178, 111, 0.85);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.puzzle-empty {
  margin: 0;
  color: rgba(247, 239, 221, 0.45);
  font-size: 12px;
  text-align: center;
}
</style>
