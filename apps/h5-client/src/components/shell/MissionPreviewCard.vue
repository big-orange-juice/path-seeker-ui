<script setup lang="ts">
import { computed } from "vue"
import { RouterLink } from "vue-router"
import { UiBadge, UiButton, UiCard } from "@path-seeker/ui"
import { getDifficultyLabel } from "@/utils/puzzleLabels"
import type { MissionRouteCard } from "@/types/mission"

interface Props {
  mission: MissionRouteCard
}

const props = defineProps<Props>()

const metaLine = computed(
  () => `${props.mission.startLocation} · ${props.mission.estimatedMinutes} 分钟 · ${props.mission.chapterCount} 章节`,
)
</script>

<template>
  <UiCard class="client-panel overflow-hidden">
    <div class="space-y-4 p-5">
      <div class="flex flex-wrap gap-2">
        <UiBadge>{{ mission.badgeLabel }}</UiBadge>
        <UiBadge variant="muted">{{ mission.recommendedAgeBand }}</UiBadge>
        <UiBadge variant="muted">{{ getDifficultyLabel(mission.difficultyLevel) }}</UiBadge>
      </div>

      <div class="space-y-2">
        <h3 class="font-display text-2xl leading-tight text-foreground">{{ mission.title }}</h3>
        <p class="text-sm leading-6 text-muted-foreground">{{ mission.summary }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
        <div class="rounded-[0.9rem] bg-background/70 p-3">
          <div class="text-[11px] uppercase tracking-[0.12em]">路线信息</div>
          <div class="mt-2 leading-6 text-foreground">{{ metaLine }}</div>
        </div>
        <div class="rounded-[0.9rem] bg-background/70 p-3">
          <div class="text-[11px] uppercase tracking-[0.12em]">奖励</div>
          <div class="mt-2 leading-6 text-foreground">{{ mission.rewardTitle }}</div>
        </div>
      </div>

      <div class="rounded-[0.9rem] bg-background/70 p-3 text-sm leading-6 text-muted-foreground">
        {{ mission.highlight }}
      </div>

      <RouterLink :to="`/tasks/${mission.id}`" class="block">
        <UiButton class="w-full justify-center">查看任务详情</UiButton>
      </RouterLink>
    </div>
  </UiCard>
</template>
