<script setup lang="ts">
import { computed } from "vue"
import type { BaseMissionPuzzle, MissionAnswerDraft } from "@/types/mission"

interface Props {
  puzzle: BaseMissionPuzzle<"code_break">
  modelValue: MissionAnswerDraft | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: MissionAnswerDraft]
}>()

const currentCode = computed(() => (typeof props.modelValue?.value === "string" ? props.modelValue.value : ""))

const codeSlots = computed(() => {
  const chars = currentCode.value.split("")
  return Array.from({ length: props.puzzle.questionPayload.codeLength }, (_, index) => chars[index] || props.puzzle.questionPayload.maskCharacter || "*")
})

function updateCode(value: string) {
  emit("update:modelValue", {
    templateType: "code_break",
    value,
  })
}
</script>

<template>
  <view class="code-stack">
    <view class="fragment-row">
      <text v-for="fragment in puzzle.questionPayload.clueFragments" :key="fragment" class="fragment-chip">{{ fragment }}</text>
    </view>

    <view class="lock-panel">
      <view class="lock-arc"></view>
      <view class="code-slots">
        <view v-for="(slot, index) in codeSlots" :key="index" class="slot-box">{{ slot }}</view>
      </view>
    </view>

    <input
      class="code-input"
      type="number"
      :maxlength="puzzle.questionPayload.codeLength"
      :value="currentCode"
      placeholder="输入密码"
      placeholder-class="code-placeholder"
      @input="updateCode(($event.detail.value || '').slice(0, puzzle.questionPayload.codeLength))"
    />
  </view>
</template>

<style scoped lang="scss">
.code-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
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
  margin-top: 12rpx;
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
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