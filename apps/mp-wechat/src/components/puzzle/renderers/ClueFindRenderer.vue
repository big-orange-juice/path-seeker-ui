<script setup lang="ts">
import type { BaseMissionPuzzle, MissionAnswerDraft } from "@/types/mission"

interface Props {
  puzzle: BaseMissionPuzzle<"clue_find">
  modelValue: MissionAnswerDraft | null
}

defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: MissionAnswerDraft]
}>()

function selectHotspot(hotspotId: string) {
  emit("update:modelValue", {
    templateType: "clue_find",
    value: hotspotId,
  })
}
</script>

<template>
  <view class="find-stack">
    <view class="target-chip">找：{{ puzzle.questionPayload.targetDescription }}</view>

    <view class="board">
      <view class="board-surface">
        <button
          v-for="hotspot in puzzle.questionPayload.hotspots"
          :key="hotspot.id"
          class="hotspot"
          :class="{ 'is-active': modelValue?.value === hotspot.id }"
          :style="{
            left: `${hotspot.x}%`,
            top: `${hotspot.y}%`,
            width: `${hotspot.width}%`,
            height: `${hotspot.height}%`,
          }"
          @click="selectHotspot(hotspot.id)"
        >
          <text class="hotspot-label">{{ hotspot.label }}</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.find-stack {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.target-chip {
  align-self: flex-start;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.16);
  color: #fff8ea;
  font-size: 23rpx;
  font-weight: 800;
}

.board {
  padding: 14rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.045);
}

.board-surface {
  position: relative;
  height: 360rpx;
  overflow: hidden;
  border-radius: 22rpx;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(180deg, rgba(209, 178, 111, 0.12), transparent 42%),
    linear-gradient(135deg, rgba(36, 39, 46, 0.98), rgba(15, 17, 22, 0.98));
  background-size: 56rpx 56rpx, 56rpx 56rpx, auto, auto;
}

.hotspot {
  position: absolute;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 8rpx;
  border-radius: 18rpx;
  border: 1px dashed rgba(247, 239, 221, 0.22);
  background: rgba(255, 255, 255, 0.035);
  text-align: left;
}

.hotspot.is-active {
  border-style: solid;
  border-color: rgba(209, 178, 111, 0.72);
  background: rgba(209, 178, 111, 0.22);
}

.hotspot-label {
  color: #fff8ea;
  font-size: 20rpx;
  font-weight: 800;
}
</style>