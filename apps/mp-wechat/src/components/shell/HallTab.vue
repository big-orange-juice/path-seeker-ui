<script setup lang="ts">
import { computed } from "vue"
import MuseumOverviewMap from "@/components/shell/MuseumOverviewMap.vue"
import { useChromeMetrics } from "@/composables/useChromeMetrics"
import type { AgeBand, DifficultyLevel, MissionRouteCard, TaskKind } from "@/types/mission"

interface Props {
  routes: MissionRouteCard[]
  activeRouteId?: string | null
  completedRouteIds?: string[]
  filters: {
    ageBand: AgeBand | "all"
    difficulty: DifficultyLevel | "all"
    taskKind: TaskKind | "all"
  }
  coverage: {
    ageBands: number
    difficulties: number
    taskKinds: number
    missionCount: number
  }
}

const props = defineProps<Props>()
const { metrics } = useChromeMetrics()

const mapStageStyle = computed(() => {
  const bottomInset = uni.upx2px(156)
  const shellHeight = Math.max(520, uni.getSystemInfoSync().windowHeight - metrics.value.navHeight - bottomInset)

  return {
    height: `${shellHeight}px`,
  }
})
</script>

<template>
  <view class="hall-map-stage" :style="mapStageStyle">
    <MuseumOverviewMap :route-count="props.coverage.missionCount" :completed-count="props.completedRouteIds?.length || 0" />
  </view>
</template>

<style scoped lang="scss">
.hall-map-stage {
  margin-left: -20rpx;
  margin-right: -20rpx;
}
</style>
