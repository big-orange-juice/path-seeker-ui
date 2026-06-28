<script setup lang="ts">
import { TASK_KIND_OPTIONS } from "@/mock/schema"
import type { MissionArchiveEntry, TaskKind } from "@/types/mission"

interface Props {
  entries: MissionArchiveEntry[]
}

defineProps<Props>()

const emit = defineEmits<{
  open: [routeId: string]
}>()

function taskKindLabel(value: TaskKind) {
  return TASK_KIND_OPTIONS.find((item) => item.value === value)?.label || "路线"
}
</script>

<template>
  <view class="content-stack">
    <view class="archive-head">
      <text class="eyebrow">我的收获</text>
      <text class="display-title">完成的路线都会保存。</text>
    </view>

    <view v-if="entries.length" class="route-line panel section-pad">
      <button
        v-for="entry in entries"
        :key="`${entry.routeId}-${entry.completedAt}`"
        class="route-line-item archive-button"
        @click="emit('open', entry.routeId)"
      >
        <view class="archive-card">
          <text class="section-title">{{ entry.routeTitle }}</text>
          <text class="muted-copy">{{ entry.rewardTitle }} · {{ entry.selectedAgeBand }} · {{ taskKindLabel(entry.taskKind) }}</text>
          <view class="chip-row archive-row">
            <text class="chip is-active">{{ entry.totalScore }} 分</text>
            <text class="chip">{{ entry.solvedCount }}/{{ entry.puzzleCount }} 站</text>
            <text class="chip">{{ entry.usedHintCount }} 次提示</text>
          </view>
        </view>
      </button>
    </view>

    <view v-else class="panel section-pad empty-panel">
      <text class="section-title">还没有收获</text>
      <text class="muted-copy">完成一条路线后，就能看到奖励和成绩。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.archive-head {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 6rpx 4rpx 2rpx;
}

.archive-button {
  width: 100%;
  text-align: left;
}

.archive-card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.archive-row {
  margin-top: 4rpx;
}

.empty-panel {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
</style>
