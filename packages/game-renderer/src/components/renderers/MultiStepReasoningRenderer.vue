<script setup lang="ts">
import { computed, nextTick } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type {
  MultiStepReasoningPuzzleDefinition,
  PuzzleAnswerDraft,
  ReasoningAnswerValue,
} from "../../contracts"

interface Props {
  puzzle: MultiStepReasoningPuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const { root, animateSelector } = useRendererMotion(() => {
  const tl = gsap.timeline({ defaults: { ease: "power2.out" } })

  tl.from(".reasoning-slot", {
    autoAlpha: 0,
    y: 16,
    duration: 0.28,
    stagger: 0.04,
  })
    .from(
      ".evidence-card",
      {
        autoAlpha: 0,
        y: 20,
        duration: 0.28,
        stagger: 0.05,
      },
      "-=0.12",
    )
    .from(
      ".conclusion-card",
      {
        autoAlpha: 0,
        x: 18,
        duration: 0.26,
        stagger: 0.05,
      },
      "-=0.1",
    )
})

const currentValue = computed<ReasoningAnswerValue>(() => {
  const value = props.modelValue?.value

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "evidenceOrder" in value &&
    "conclusionId" in value
  ) {
    return value as ReasoningAnswerValue
  }

  return {
    evidenceOrder: [],
    conclusionId: null,
  }
})

const selectedEvidence = computed(() =>
  currentValue.value.evidenceOrder
    .map((id) => props.puzzle.questionPayload.evidence.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
)

const availableEvidence = computed(() =>
  props.puzzle.questionPayload.evidence.filter((item) => !currentValue.value.evidenceOrder.includes(item.id)),
)

const slotLabels = computed(
  () =>
    props.puzzle.questionPayload.slotLabels ||
    props.puzzle.questionPayload.correctEvidenceOrder.map((_, index) => `推理槽 ${index + 1}`),
)

const evidenceLimit = computed(() => props.puzzle.questionPayload.correctEvidenceOrder.length)
const chainReady = computed(() => currentValue.value.evidenceOrder.length === evidenceLimit.value)

function updateValue(next: ReasoningAnswerValue) {
  emit("update:modelValue", {
    templateType: "multi_step_reasoning",
    value: next,
  })
}

async function pushEvidence(evidenceId: string) {
  if (props.readonlyMode || currentValue.value.evidenceOrder.includes(evidenceId) || chainReady.value) {
    return
  }

  updateValue({
    evidenceOrder: [...currentValue.value.evidenceOrder, evidenceId],
    conclusionId: currentValue.value.conclusionId,
  })

  await nextTick()
  animateSelector(
    ".reasoning-slot.is-filled, .evidence-card",
    { y: 10, scale: 0.96 },
    { y: 0, scale: 1, duration: 0.28, stagger: 0.03, ease: "back.out(1.7)" },
  )
}

async function removeEvidence(index: number) {
  if (props.readonlyMode) {
    return
  }

  const nextEvidence = currentValue.value.evidenceOrder.filter((_, evidenceIndex) => evidenceIndex !== index)
  updateValue({
    evidenceOrder: nextEvidence,
    conclusionId: currentValue.value.conclusionId,
  })

  await nextTick()
  animateSelector(
    ".reasoning-slot, .evidence-card",
    { y: 8, autoAlpha: 0.92 },
    { y: 0, autoAlpha: 1, duration: 0.24, stagger: 0.02, ease: "power2.out" },
  )
}

async function selectConclusion(conclusionId: string) {
  if (props.readonlyMode) {
    return
  }

  updateValue({
    evidenceOrder: currentValue.value.evidenceOrder,
    conclusionId,
  })

  await nextTick()
  animateSelector(
    ".conclusion-card.is-active",
    { x: 12, scale: 0.96 },
    { x: 0, scale: 1, duration: 0.3, ease: "back.out(1.6)" },
  )
}
</script>

<template>
  <view ref="root" class="reasoning-lab">
    <view class="reasoning-board">
      <view class="board-head">
        <view>
          <text class="board-title">{{ puzzle.questionPayload.chainTitle || "推理链" }}</text>
          <text class="board-copy">先把证据按逻辑放进槽位，再决定哪条结论真正成立。</text>
        </view>
        <text class="board-progress">{{ selectedEvidence.length }}/{{ evidenceLimit }}</text>
      </view>

      <view class="slot-grid">
        <button
          v-for="(slotLabel, index) in slotLabels"
          :key="slotLabel"
          class="reasoning-slot"
          :class="{ 'is-filled': Boolean(selectedEvidence[index]) }"
          @click="removeEvidence(index)"
        >
          <text class="slot-step">0{{ index + 1 }}</text>
          <text class="slot-label">{{ slotLabel }}</text>
          <view v-if="selectedEvidence[index]" class="slot-card">
            <text class="slot-card-title">{{ selectedEvidence[index]?.label }}</text>
            <text v-if="selectedEvidence[index]?.note" class="slot-card-note">{{ selectedEvidence[index]?.note }}</text>
          </view>
          <text v-else class="slot-empty">从下方证据池点一条放进来</text>
        </button>
      </view>
    </view>

    <view class="evidence-pool">
      <text class="section-label">证据池</text>
      <view class="evidence-grid">
        <button
          v-for="item in availableEvidence"
          :key="item.id"
          class="evidence-card"
          @click="pushEvidence(item.id)"
        >
          <text v-if="item.tag" class="evidence-tag">{{ item.tag }}</text>
          <text class="evidence-title">{{ item.label }}</text>
          <text v-if="item.note" class="evidence-note">{{ item.note }}</text>
        </button>
      </view>
    </view>

    <view class="conclusion-board">
      <text class="section-label">{{ puzzle.questionPayload.conclusionTitle || "选择结论" }}</text>
      <view class="conclusion-list">
        <button
          v-for="item in puzzle.questionPayload.conclusions"
          :key="item.id"
          class="conclusion-card"
          :class="{ 'is-active': currentValue.conclusionId === item.id, 'is-locked': !chainReady }"
          @click="selectConclusion(item.id)"
        >
          <text class="conclusion-title">{{ item.label }}</text>
          <text v-if="item.summary" class="conclusion-summary">{{ item.summary }}</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.reasoning-lab {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.reasoning-board,
.evidence-pool,
.conclusion-board {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.reasoning-board {
  padding: 20rpx;
  border-radius: 26rpx;
  background:
    radial-gradient(circle at 90% 12%, rgba(209, 178, 111, 0.18), transparent 24%),
    rgba(209, 178, 111, 0.08);
  border: 1px solid rgba(209, 178, 111, 0.22);
}

.board-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.board-title,
.section-label {
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.board-copy {
  display: block;
  margin-top: 8rpx;
  color: rgba(247, 239, 221, 0.56);
  font-size: 21rpx;
  line-height: 1.4;
}

.board-progress {
  color: #fff8ea;
  font-size: 22rpx;
  font-weight: 900;
}

.slot-grid {
  display: grid;
  gap: 12rpx;
}

.reasoning-slot {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-height: 118rpx;
  padding: 16rpx;
  border: 1px dashed rgba(209, 178, 111, 0.28);
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.04);
  text-align: left;
}

.reasoning-slot.is-filled {
  border-style: solid;
  background: rgba(54, 43, 24, 0.92);
}

.slot-step {
  color: rgba(247, 239, 221, 0.42);
  font-size: 18rpx;
  font-weight: 900;
}

.slot-label {
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.slot-card-title {
  color: #fff8ea;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1.28;
}

.slot-card-note,
.slot-empty {
  display: block;
  margin-top: 6rpx;
  color: rgba(247, 239, 221, 0.54);
  font-size: 20rpx;
  line-height: 1.38;
}

.evidence-grid,
.conclusion-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.evidence-card,
.conclusion-card {
  padding: 18rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.045);
  text-align: left;
}

.evidence-tag {
  display: inline-flex;
  align-items: center;
  min-height: 38rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.14);
  color: #f3d99d;
  font-size: 18rpx;
  font-weight: 900;
}

.evidence-title,
.conclusion-title {
  color: #fff8ea;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.3;
}

.evidence-title {
  display: block;
  margin-top: 10rpx;
}

.evidence-note,
.conclusion-summary {
  display: block;
  margin-top: 8rpx;
  color: rgba(247, 239, 221, 0.56);
  font-size: 21rpx;
  line-height: 1.4;
}

.conclusion-card.is-active {
  background:
    radial-gradient(circle at 92% 14%, rgba(209, 178, 111, 0.18), transparent 24%),
    rgba(54, 43, 24, 0.92);
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.34);
}

.conclusion-card.is-locked {
  opacity: 0.88;
}
</style>
