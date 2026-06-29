<script setup lang="ts">
import { computed, nextTick, shallowRef } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { MatchPair, MatchPuzzleDefinition, PuzzleAnswerDraft } from "../../contracts"

interface Props {
  puzzle: MatchPuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const slotElements = new Map<string, HTMLElement>()
const cardElements = new Map<string, HTMLElement>()
const draggingLeftId = shallowRef("")
const dragX = shallowRef(0)
const dragY = shallowRef(0)
const startX = shallowRef(0)
const startY = shallowRef(0)
const hoverRightId = shallowRef("")

const { root, animateSelector } = useRendererMotion(() => {
  const tl = gsap.timeline({ defaults: { ease: "power2.out" } })

  tl.from(".evidence-card", {
    autoAlpha: 0,
    y: 18,
    duration: 0.28,
    stagger: 0.05,
  }).from(
    ".relation-slot",
    {
      autoAlpha: 0,
      y: 22,
      duration: 0.32,
      stagger: 0.06,
    },
    "-=0.14",
  )
})

const pairs = computed<MatchPair[]>(() => {
  const value = props.modelValue?.value

  if (Array.isArray(value)) {
    const candidate = value as unknown[]
    if (
      candidate.every(
        (item) => typeof item === "object" && item !== null && "leftId" in item && "rightId" in item,
      )
    ) {
      return candidate as MatchPair[]
    }
  }

  return []
})

const rightAssignments = computed(() =>
  Object.fromEntries(pairs.value.map((pair) => [pair.rightId, pair.leftId])) as Record<string, string>,
)

function registerSlot(id: string) {
  return (element: Element | null) => {
    if (!(element instanceof HTMLElement)) {
      slotElements.delete(id)
      return
    }

    slotElements.set(id, element)
  }
}

function registerCard(id: string) {
  return (element: Element | null) => {
    if (!(element instanceof HTMLElement)) {
      cardElements.delete(id)
      return
    }

    cardElements.set(id, element)
  }
}

function readTouchPoint(event: TouchEvent) {
  const point = event.touches[0] || event.changedTouches[0]
  return {
    x: point?.clientX || 0,
    y: point?.clientY || 0,
  }
}

function assignedRightId(leftId: string) {
  return pairs.value.find((pair) => pair.leftId === leftId)?.rightId || ""
}

function assignedRightLabel(leftId: string) {
  const rightId = assignedRightId(leftId)
  return props.puzzle.questionPayload.right.find((item) => item.id === rightId)?.label || ""
}

function updatePairs(nextPairs: MatchPair[]) {
  emit("update:modelValue", {
    templateType: "match",
    value: nextPairs,
  })
}

function assignPair(leftId: string, rightId: string) {
  const nextPairs = pairs.value.filter((pair) => pair.leftId !== leftId && pair.rightId !== rightId)
  nextPairs.push({ leftId, rightId })
  updatePairs(nextPairs)
}

function clearSlot(rightId: string) {
  if (props.readonlyMode) {
    return
  }

  updatePairs(pairs.value.filter((pair) => pair.rightId !== rightId))
}

function handleDragStart(leftId: string, event: TouchEvent) {
  if (props.readonlyMode) {
    return
  }

  const point = readTouchPoint(event)
  draggingLeftId.value = leftId
  startX.value = point.x
  startY.value = point.y
  dragX.value = 0
  dragY.value = 0
  hoverRightId.value = assignedRightId(leftId)
}

function handleDragMove(event: TouchEvent) {
  if (!draggingLeftId.value) {
    return
  }

  const point = readTouchPoint(event)
  dragX.value = point.x - startX.value
  dragY.value = point.y - startY.value

  const nextHover = props.puzzle.questionPayload.right.find((item) => {
    const element = slotElements.get(item.id)

    if (!element) {
      return false
    }

    const rect = element.getBoundingClientRect()
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  })

  hoverRightId.value = nextHover?.id || ""
}

async function finishDrag() {
  if (!draggingLeftId.value) {
    return
  }

  if (hoverRightId.value) {
    assignPair(draggingLeftId.value, hoverRightId.value)

    await nextTick()
    animateSelector(
      ".relation-slot.is-filled, .evidence-card.is-linked",
      { scale: 0.94, y: 10 },
      { scale: 1, y: 0, duration: 0.32, stagger: 0.04, ease: "back.out(1.7)" },
    )
  }

  draggingLeftId.value = ""
  hoverRightId.value = ""
  dragX.value = 0
  dragY.value = 0
}

function cancelDrag() {
  draggingLeftId.value = ""
  hoverRightId.value = ""
  dragX.value = 0
  dragY.value = 0
}

function evidenceStyle(leftId: string) {
  if (draggingLeftId.value !== leftId) {
    return {}
  }

  return {
    zIndex: "3",
    transform: `translate(${dragX.value}px, ${dragY.value}px) scale(1.03)`,
    boxShadow: "0 18rpx 36rpx rgba(0, 0, 0, 0.22)",
  }
}

function leftLabel(leftId: string) {
  return props.puzzle.questionPayload.left.find((item) => item.id === leftId)?.label || ""
}
</script>

<template>
  <view ref="root" class="match-stage">
    <view class="match-brief">
      <text class="match-title">关系操作台</text>
      <text class="match-copy">把上方证据拖到下方关系槽，看看哪一条线索真正对应哪种意义。</text>
    </view>

    <view class="evidence-pool">
      <view
        v-for="item in puzzle.questionPayload.left"
        :key="item.id"
        :ref="registerCard(item.id)"
        class="evidence-card"
        :class="{ 'is-dragging': draggingLeftId === item.id, 'is-linked': assignedRightLabel(item.id) }"
        :style="evidenceStyle(item.id)"
        @touchstart.stop="handleDragStart(item.id, $event)"
        @touchmove.stop.prevent="handleDragMove($event)"
        @touchend.stop="finishDrag"
        @touchcancel.stop="cancelDrag"
      >
        <text class="evidence-name">{{ item.label }}</text>
        <text class="evidence-state">{{ assignedRightLabel(item.id) || "拖到下方关系槽" }}</text>
      </view>
    </view>

    <view class="relation-grid">
      <button
        v-for="item in puzzle.questionPayload.right"
        :key="item.id"
        :ref="registerSlot(item.id)"
        class="relation-slot"
        :class="{ 'is-hover': hoverRightId === item.id, 'is-filled': Boolean(rightAssignments[item.id]) }"
        @click="clearSlot(item.id)"
      >
        <text class="slot-label">{{ item.label }}</text>
        <view v-if="rightAssignments[item.id]" class="slot-badge">
          <text class="slot-badge-copy">{{ leftLabel(rightAssignments[item.id]) }}</text>
        </view>
        <text v-else class="slot-empty">拖动证据放这里</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.match-stage {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.match-brief {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 18rpx 18rpx 0;
}

.match-title {
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.match-copy {
  color: rgba(247, 239, 221, 0.56);
  font-size: 22rpx;
  line-height: 1.42;
}

.evidence-pool {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.evidence-card {
  min-height: 128rpx;
  padding: 18rpx 18rpx 16rpx;
  border-radius: 24rpx;
  background:
    radial-gradient(circle at 88% 14%, rgba(209, 178, 111, 0.14), transparent 26%),
    rgba(255, 255, 255, 0.045);
  text-align: left;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.evidence-card.is-dragging {
  background:
    radial-gradient(circle at 88% 14%, rgba(243, 217, 157, 0.22), transparent 28%),
    rgba(54, 43, 24, 0.92);
}

.evidence-card.is-linked {
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.3);
}

.evidence-name {
  color: #fff8ea;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.28;
}

.evidence-state {
  display: block;
  margin-top: 10rpx;
  color: rgba(247, 239, 221, 0.54);
  font-size: 20rpx;
  line-height: 1.38;
}

.relation-grid {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.relation-slot {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-height: 120rpx;
  padding: 18rpx;
  border: 1px dashed rgba(209, 178, 111, 0.26);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.03);
  text-align: left;
}

.relation-slot.is-hover {
  border-style: solid;
  background: rgba(209, 178, 111, 0.1);
}

.relation-slot.is-filled {
  border-style: solid;
  background:
    radial-gradient(circle at 92% 14%, rgba(209, 178, 111, 0.12), transparent 24%),
    rgba(255, 255, 255, 0.045);
}

.slot-label {
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.slot-badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: 52rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.18);
}

.slot-badge-copy {
  color: #fff8ea;
  font-size: 23rpx;
  font-weight: 900;
}

.slot-empty {
  color: rgba(247, 239, 221, 0.46);
  font-size: 21rpx;
}
</style>
