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

function handleInput(event: { detail?: unknown }) {
  const rawDetail = event.detail
  const rawValue =
    typeof rawDetail === "object" && rawDetail !== null && "value" in rawDetail
      ? (rawDetail as { value?: string | number }).value
      : rawDetail

  updateCode(String(rawValue ?? "").slice(0, props.puzzle.questionPayload.codeLength))
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
  <view ref="root" class="code-lab">
    <view v-if="puzzle.questionPayload.derivationSteps?.length" class="derive-board">
      <view class="derive-head">
        <view>
          <text class="derive-title">{{ puzzle.questionPayload.clueSourceTitle || "密码来源" }}</text>
          <text class="derive-copy">密码不是凭空出现的，每一位都应该能回溯到前面章节的线索来源和提取规则。</text>
        </view>
      </view>

      <view class="derive-list">
        <view v-for="step in puzzle.questionPayload.derivationSteps" :key="step.id" class="derive-step">
          <view class="derive-index">{{ step.result }}</view>
          <view class="derive-content">
            <text class="derive-source">{{ step.chapterLabel }} · {{ step.sourceTitle }}</text>
            <text class="derive-rule">{{ step.rule }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="puzzle.questionPayload.clueFragments?.length" class="fragment-row">
      <text v-for="fragment in puzzle.questionPayload.clueFragments" :key="fragment" class="fragment-chip">{{ fragment }}</text>
    </view>

    <view class="lock-panel">
      <view class="lock-arc"></view>
      <view class="code-slots" :style="{ gridTemplateColumns: `repeat(${puzzle.questionPayload.codeLength}, minmax(0, 1fr))` }">
        <view v-for="(slot, index) in codeSlots" :key="index" class="slot-box">{{ slot }}</view>
      </view>
    </view>

    <input
      class="code-input"
      type="number"
      :maxlength="puzzle.questionPayload.codeLength"
      :disabled="readonlyMode"
      :value="currentCode"
      placeholder="按来源链路输入密码"
      placeholder-class="code-placeholder"
      @input="handleInput"
    />
  </view>
</template>

<style scoped>
.code-lab {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.derive-board {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 20rpx;
  border-radius: 26rpx;
  background:
    radial-gradient(circle at 90% 12%, rgba(209, 178, 111, 0.18), transparent 24%),
    rgba(255, 255, 255, 0.045);
}

.derive-title {
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.derive-copy {
  display: block;
  margin-top: 8rpx;
  color: rgba(247, 239, 221, 0.56);
  font-size: 21rpx;
  line-height: 1.42;
}

.derive-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.derive-step {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 22rpx;
  background: rgba(11, 12, 15, 0.42);
}

.derive-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50rpx;
  height: 50rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #d1b26f, #f3d99d);
  color: #171310;
  font-size: 24rpx;
  font-weight: 900;
}

.derive-content {
  flex: 1;
  min-width: 0;
}

.derive-source {
  color: #fff8ea;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 1.28;
}

.derive-rule {
  display: block;
  margin-top: 6rpx;
  color: rgba(247, 239, 221, 0.52);
  font-size: 20rpx;
  line-height: 1.36;
}

.fragment-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.fragment-chip {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.12);
  color: rgba(247, 239, 221, 0.82);
  font-size: 22rpx;
  font-weight: 800;
}

.lock-panel {
  position: relative;
  margin-top: 4rpx;
  padding: 54rpx 18rpx 18rpx;
  border-radius: 30rpx;
  background:
    radial-gradient(circle at 50% 0, rgba(209, 178, 111, 0.22), transparent 36%),
    rgba(255, 255, 255, 0.045);
}

.lock-arc {
  position: absolute;
  left: 50%;
  top: 14rpx;
  width: 108rpx;
  height: 56rpx;
  transform: translateX(-50%);
  border: 8rpx solid rgba(209, 178, 111, 0.36);
  border-bottom: 0;
  border-radius: 70rpx 70rpx 0 0;
}

.code-slots {
  display: grid;
  gap: 12rpx;
}

.slot-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 92rpx;
  border-radius: 22rpx;
  background: rgba(11, 12, 15, 0.62);
  color: #fff8ea;
  font-size: 40rpx;
  font-weight: 900;
}

.code-input {
  min-height: 82rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.055);
  color: #fff8ea;
  font-size: 28rpx;
  font-weight: 800;
}
</style>
