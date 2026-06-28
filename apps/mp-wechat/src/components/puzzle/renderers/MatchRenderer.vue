<script setup lang="ts">
import { computed, shallowRef } from "vue"
import type { BaseMissionPuzzle, MatchPair, MissionAnswerDraft } from "@/types/mission"

interface Props {
  puzzle: BaseMissionPuzzle<"match">
  modelValue: MissionAnswerDraft | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: MissionAnswerDraft]
}>()

const activeLeftId = shallowRef("")

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

function selectLeft(leftId: string) {
  activeLeftId.value = leftId
}

function selectRight(rightId: string) {
  if (!activeLeftId.value) {
    return
  }

  const nextPairs = pairs.value.filter((pair) => pair.leftId !== activeLeftId.value)
  nextPairs.push({ leftId: activeLeftId.value, rightId })

  emit("update:modelValue", {
    templateType: "match",
    value: nextPairs,
  })

  activeLeftId.value = ""
}

function matchedRight(leftId: string) {
  return pairs.value.find((pair) => pair.leftId === leftId)?.rightId || ""
}

function matchedRightLabel(leftId: string) {
  const rightId = matchedRight(leftId)

  return props.puzzle.questionPayload.right.find((item) => item.id === rightId)?.label || ""
}
</script>

<template>
  <view class="match-board">
    <view class="match-column">
      <text class="column-label">先选线索</text>
      <button
        v-for="item in puzzle.questionPayload.left"
        :key="item.id"
        class="match-card"
        :class="{ 'is-active': activeLeftId === item.id, 'is-linked': matchedRightLabel(item.id) }"
        @click="selectLeft(item.id)"
      >
        <text class="match-title">{{ item.label }}</text>
        <text class="match-state">{{ matchedRightLabel(item.id) || '待配对' }}</text>
      </button>
    </view>

    <view class="match-column">
      <text class="column-label">再选意义</text>
      <button
        v-for="item in puzzle.questionPayload.right"
        :key="item.id"
        class="match-card right"
        @click="selectRight(item.id)"
      >
        <text class="match-title">{{ item.label }}</text>
        <text class="match-state">{{ activeLeftId ? '点我配对' : '先选左边' }}</text>
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.match-board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.match-column {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.column-label {
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.match-card {
  min-height: 132rpx;
  padding: 16rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.045);
  text-align: left;
}

.match-card.is-active {
  background: rgba(209, 178, 111, 0.18);
}

.match-card.is-linked {
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.36);
}

.match-title {
  color: #fff8ea;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.25;
}

.match-state {
  display: block;
  margin-top: 10rpx;
  color: rgba(247, 239, 221, 0.5);
  font-size: 20rpx;
  line-height: 1.25;
}

.match-card.is-linked .match-state {
  color: #d1b26f;
}
</style>