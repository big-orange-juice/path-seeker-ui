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
  <div ref="root" class="reasoning-lab">
    <div class="reasoning-board">
      <div class="board-head">
        <div>
          <span class="board-title">{{ puzzle.questionPayload.chainTitle || "推理链" }}</span>
          <span class="board-copy">先把证据按逻辑放进槽位，再决定哪条结论真正成立。</span>
        </div>
        <span class="board-progress">{{ selectedEvidence.length }}/{{ evidenceLimit }}</span>
      </div>

      <div class="slot-grid">
        <button
          v-for="(slotLabel, index) in slotLabels"
          :key="slotLabel"
          class="reasoning-slot"
          :class="{ 'is-filled': Boolean(selectedEvidence[index]) }"
          @click="removeEvidence(index)"
        >
          <span class="slot-step">0{{ index + 1 }}</span>
          <span class="slot-label">{{ slotLabel }}</span>
          <div v-if="selectedEvidence[index]" class="slot-card">
            <span class="slot-card-title">{{ selectedEvidence[index]?.label }}</span>
            <span v-if="selectedEvidence[index]?.note" class="slot-card-note">{{ selectedEvidence[index]?.note }}</span>
          </div>
          <span v-else class="slot-empty">从下方证据池点一条放进来</span>
        </button>
      </div>
    </div>

    <div class="evidence-pool">
      <span class="section-label">证据池</span>
      <div class="evidence-grid">
        <button
          v-for="item in availableEvidence"
          :key="item.id"
          class="evidence-card"
          @click="pushEvidence(item.id)"
        >
          <span v-if="item.tag" class="evidence-tag">{{ item.tag }}</span>
          <span class="evidence-title">{{ item.label }}</span>
          <span v-if="item.note" class="evidence-note">{{ item.note }}</span>
        </button>
      </div>
    </div>

    <div class="conclusion-board">
      <span class="section-label">{{ puzzle.questionPayload.conclusionTitle || "选择结论" }}</span>
      <div class="conclusion-list">
        <button
          v-for="item in puzzle.questionPayload.conclusions"
          :key="item.id"
          class="conclusion-card"
          :class="{ 'is-active': currentValue.conclusionId === item.id, 'is-locked': !chainReady }"
          @click="selectConclusion(item.id)"
        >
          <span class="conclusion-title">{{ item.label }}</span>
          <span v-if="item.summary" class="conclusion-summary">{{ item.summary }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reasoning-lab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.reasoning-board,
.evidence-pool,
.conclusion-board {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reasoning-board {
  padding: 20px;
  border-radius: 26px;
  background:
    radial-gradient(circle at 90% 12%, rgba(209, 178, 111, 0.18), transparent 24%),
    rgba(209, 178, 111, 0.08);
  border: 1px solid rgba(209, 178, 111, 0.22);
}

.board-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.board-title,
.section-label {
  color: #d1b26f;
  font-size: 22px;
  font-weight: 900;
}

.board-copy {
  display: block;
  margin-top: 8px;
  color: rgba(247, 239, 221, 0.56);
  font-size: 21px;
  line-height: 1.4;
}

.board-progress {
  color: #fff8ea;
  font-size: 22px;
  font-weight: 900;
}

.slot-grid {
  display: grid;
  gap: 12px;
}

.reasoning-slot {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 118px;
  padding: 16px;
  border: 1px dashed rgba(209, 178, 111, 0.28);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.04);
  text-align: left;
}

.reasoning-slot.is-filled {
  border-style: solid;
  background: rgba(54, 43, 24, 0.92);
}

.slot-step {
  color: rgba(247, 239, 221, 0.42);
  font-size: 18px;
  font-weight: 900;
}

.slot-label {
  color: #d1b26f;
  font-size: 22px;
  font-weight: 900;
}

.slot-card-title {
  color: #fff8ea;
  font-size: 24px;
  font-weight: 900;
  line-height: 1.28;
}

.slot-card-note,
.slot-empty {
  display: block;
  margin-top: 6px;
  color: rgba(247, 239, 221, 0.54);
  font-size: 20px;
  line-height: 1.38;
}

.evidence-grid,
.conclusion-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.evidence-card,
.conclusion-card {
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.045);
  text-align: left;
}

.evidence-tag {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(209, 178, 111, 0.14);
  color: #f3d99d;
  font-size: 18px;
  font-weight: 900;
}

.evidence-title,
.conclusion-title {
  color: #fff8ea;
  font-size: 25px;
  font-weight: 900;
  line-height: 1.3;
}

.evidence-title {
  display: block;
  margin-top: 10px;
}

.evidence-note,
.conclusion-summary {
  display: block;
  margin-top: 8px;
  color: rgba(247, 239, 221, 0.56);
  font-size: 21px;
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
