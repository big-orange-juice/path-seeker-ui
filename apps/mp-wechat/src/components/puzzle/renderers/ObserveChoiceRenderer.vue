<script setup lang="ts">
import type { BaseMissionPuzzle, MissionAnswerDraft } from "@/types/mission"

interface Props {
  puzzle: BaseMissionPuzzle<"observe_choice">
  modelValue: MissionAnswerDraft | null
}

defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: MissionAnswerDraft]
}>()

function selectOption(optionId: string) {
  emit("update:modelValue", {
    templateType: "observe_choice",
    value: optionId,
  })
}
</script>

<template>
  <view class="choice-list">
    <button
      v-for="(option, index) in puzzle.questionPayload.options"
      :key="option.id"
      class="choice-card"
      :class="{ 'is-active': modelValue?.value === option.id }"
      @click="selectOption(option.id)"
    >
      <text class="choice-index">{{ index + 1 }}</text>
      <text class="choice-title">{{ option.label }}</text>
    </button>
  </view>
</template>

<style scoped lang="scss">
.choice-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.choice-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 86rpx;
  padding: 16rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.045);
  text-align: left;
}

.choice-card.is-active {
  background: rgba(209, 178, 111, 0.16);
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.44);
}

.choice-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46rpx;
  height: 46rpx;
  border-radius: 999rpx;
  background: rgba(247, 239, 221, 0.08);
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.choice-title {
  flex: 1;
  color: #fff8ea;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.28;
}
</style>