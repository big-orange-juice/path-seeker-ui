<script setup lang="ts">
import { computed } from "vue"
import type { BaseMissionPuzzle, MissionAnswerDraft } from "@/types/mission"

interface Props {
  puzzle: BaseMissionPuzzle<"sort">
  modelValue: MissionAnswerDraft | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: MissionAnswerDraft]
}>()

const order = computed<string[]>(() => {
  const value = props.modelValue?.value

  if (Array.isArray(value)) {
    const candidate = value as unknown[]
    if (candidate.every((item) => typeof item === "string")) {
      return candidate as string[]
    }
  }

  return props.puzzle.questionPayload.items.map((item) => item.id)
})

const orderedItems = computed(() =>
  order.value
    .map((id) => props.puzzle.questionPayload.items.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
)

function updateOrder(nextOrder: string[]) {
  emit("update:modelValue", {
    templateType: "sort",
    value: nextOrder,
  })
}

function moveItem(index: number, direction: -1 | 1) {
  const targetIndex = index + direction

  if (targetIndex < 0 || targetIndex >= order.value.length) {
    return
  }

  const next = [...order.value]
  const [current] = next.splice(index, 1)
  next.splice(targetIndex, 0, current)
  updateOrder(next)
}
</script>

<template>
  <view class="sort-list">
    <view v-for="(item, index) in orderedItems" :key="item.id" class="sort-card">
      <view class="sort-index">{{ index + 1 }}</view>
      <text class="sort-label">{{ item.label }}</text>
      <view class="sort-actions">
        <button class="sort-button" @click="moveItem(index, -1)">上</button>
        <button class="sort-button" @click="moveItem(index, 1)">下</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.sort-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.sort-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 86rpx;
  padding: 14rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.045);
}

.sort-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50rpx;
  height: 50rpx;
  border-radius: 18rpx;
  background: rgba(209, 178, 111, 0.18);
  color: #fff8ea;
  font-size: 24rpx;
  font-weight: 900;
}

.sort-label {
  flex: 1;
  color: #fff8ea;
  font-size: 27rpx;
  font-weight: 800;
  line-height: 1.3;
}

.sort-actions {
  display: flex;
  gap: 8rpx;
}

.sort-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 54rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(247, 239, 221, 0.78);
  font-size: 21rpx;
  font-weight: 900;
}
</style>