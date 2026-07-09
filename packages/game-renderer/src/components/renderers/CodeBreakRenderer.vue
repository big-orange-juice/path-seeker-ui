<script setup lang="ts">
import { computed, nextTick, watch } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { CodeBreakPuzzleDefinition, PuzzleAnswerDraft } from "../../contracts"

interface Props {
  puzzle: CodeBreakPuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const { root, animateSelector } = useRendererMotion(() => {
  const tl = gsap.timeline({ defaults: { ease: "power2.out" } })

  tl.from(".derive-step", {
    autoAlpha: 0,
    y: 14,
    duration: 0.24,
    stagger: 0.05,
  })
    .from(
      ".lock-panel",
      {
        autoAlpha: 0,
        scale: 0.96,
        duration: 0.3,
      },
      "-=0.08",
    )
    .from(
      ".slot-box",
      {
        autoAlpha: 0,
        y: 16,
        duration: 0.22,
        stagger: 0.04,
      },
      "-=0.12",
    )
})

const currentCode = computed(() => (typeof props.modelValue?.value === "string" ? props.modelValue.value : ""))

const codeSlots = computed(() => {
  const chars = currentCode.value.split("")
  return Array.from(
    { length: props.puzzle.questionPayload.codeLength },
    (_, index) => chars[index] || props.puzzle.questionPayload.maskCharacter || "*",
  )
})

function updateCode(value: string) {
  emit("update:modelValue", {
    templateType: "code_break",
    value,
  })
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  updateCode(String(target?.value ?? "").slice(0, props.puzzle.questionPayload.codeLength))
}

watch(
  () => currentCode.value,
  async (value, oldValue) => {
    if (value === oldValue) {
      return
    }

    await nextTick()
    animateSelector(
      ".slot-box",
      { y: 12, scale: 0.94 },
      { y: 0, scale: 1, duration: 0.24, stagger: 0.03, ease: "back.out(1.7)" },
    )
  },
)
</script>

<template>
  <div ref="root" class="code-lab">
    <div v-if="puzzle.questionPayload.derivationSteps?.length" class="derive-board">
      <div class="derive-head">
        <div>
          <span class="derive-title">{{ puzzle.questionPayload.clueSourceTitle || "密码来源" }}</span>
          <span class="derive-copy">密码不是凭空出现的，每一位都应该能回溯到前面章节的线索来源和提取规则。</span>
        </div>
      </div>

      <div class="derive-list">
        <div v-for="step in puzzle.questionPayload.derivationSteps" :key="step.id" class="derive-step">
          <div class="derive-index">{{ step.result }}</div>
          <div class="derive-content">
            <span class="derive-source">{{ step.chapterLabel }} · {{ step.sourceTitle }}</span>
            <span class="derive-rule">{{ step.rule }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="puzzle.questionPayload.clueFragments?.length" class="fragment-row">
      <span v-for="fragment in puzzle.questionPayload.clueFragments" :key="fragment" class="fragment-chip">{{ fragment }}</span>
    </div>

    <div class="lock-panel">
      <div class="lock-arc"></div>
      <div class="code-slots" :style="{ gridTemplateColumns: `repeat(${puzzle.questionPayload.codeLength}, minmax(0, 1fr))` }">
        <div v-for="(slot, index) in codeSlots" :key="index" class="slot-box">{{ slot }}</div>
      </div>
    </div>

    <input
      class="code-input"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      :maxlength="puzzle.questionPayload.codeLength"
      :disabled="readonlyMode"
      :value="currentCode"
      placeholder="按来源链路输入密码"
      @input="handleInput"
    />
  </div>
</template>

<style scoped>
.code-lab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.derive-board {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: 26px;
  background:
    radial-gradient(circle at 90% 12%, rgba(209, 178, 111, 0.18), transparent 24%),
    rgba(255, 255, 255, 0.045);
}

.derive-title {
  color: #d1b26f;
  font-size: 22px;
  font-weight: 900;
}

.derive-copy {
  display: block;
  margin-top: 8px;
  color: rgba(247, 239, 221, 0.56);
  font-size: 21px;
  line-height: 1.42;
}

.derive-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.derive-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 22px;
  background: rgba(11, 12, 15, 0.42);
}

.derive-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 18px;
  background: linear-gradient(135deg, #d1b26f, #f3d99d);
  color: #171310;
  font-size: 24px;
  font-weight: 900;
}

.derive-content {
  flex: 1;
  min-width: 0;
}

.derive-source {
  color: #fff8ea;
  font-size: 23px;
  font-weight: 900;
  line-height: 1.28;
}

.derive-rule {
  display: block;
  margin-top: 6px;
  color: rgba(247, 239, 221, 0.52);
  font-size: 20px;
  line-height: 1.36;
}

.fragment-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.fragment-chip {
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(209, 178, 111, 0.12);
  color: rgba(247, 239, 221, 0.82);
  font-size: 22px;
  font-weight: 800;
}

.lock-panel {
  position: relative;
  margin-top: 4px;
  padding: 54px 18px 18px;
  border-radius: 30px;
  background:
    radial-gradient(circle at 50% 0, rgba(209, 178, 111, 0.22), transparent 36%),
    rgba(255, 255, 255, 0.045);
}

.lock-arc {
  position: absolute;
  left: 50%;
  top: 14px;
  width: 108px;
  height: 56px;
  transform: translateX(-50%);
  border: 8px solid rgba(209, 178, 111, 0.36);
  border-bottom: 0;
  border-radius: 70px 70px 0 0;
}

.code-slots {
  display: grid;
  gap: 12px;
}

.slot-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 92px;
  border-radius: 22px;
  background: rgba(11, 12, 15, 0.62);
  color: #fff8ea;
  font-size: 40px;
  font-weight: 900;
}

.code-input {
  min-height: 82px;
  padding: 0 24px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
  color: #fff8ea;
  font-size: 28px;
  font-weight: 800;
}
</style>
