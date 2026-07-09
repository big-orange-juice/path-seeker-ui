<script setup lang="ts">
import { computed } from "vue"
import { RouterLink } from "vue-router"
import { ClientBadge, ClientButton, ClientCard } from "@/components/ui"
import { getDifficultyLabel } from "@/utils/puzzleLabels"
import type { MissionRouteCard } from "@/types/mission"

interface Props {
  mission: MissionRouteCard
}

const props = defineProps<Props>()

const metaLine = computed(() =>
  [
    props.mission.estimatedMinutes ? `${props.mission.estimatedMinutes} 分钟` : "",
    props.mission.chapterCount ? `${props.mission.chapterCount} 章节` : "",
  ].filter(Boolean).join(" · "),
)
</script>

<template>
  <ClientCard class="overflow-hidden">
    <div class="space-y-4 p-5">
      <div class="flex flex-wrap gap-2">
        <ClientBadge v-if="mission.theme">{{ mission.theme }}</ClientBadge>
        <ClientBadge variant="muted">{{ mission.recommendedAgeBand }}</ClientBadge>
        <ClientBadge variant="muted">{{ getDifficultyLabel(mission.difficultyLevel) }}</ClientBadge>
      </div>

      <div class="space-y-2">
        <h3 class="font-display text-2xl leading-tight text-foreground">{{ mission.title }}</h3>
        <p v-if="mission.summary" class="text-sm leading-6 text-muted-foreground">{{ mission.summary }}</p>
      </div>

      <div class="grid gap-3 text-sm text-muted-foreground" :class="mission.rewardTitle ? 'grid-cols-2' : 'grid-cols-1'">
        <div v-if="metaLine" class="rounded-[0.9rem] bg-background/70 p-3">
          <div class="text-[11px] uppercase tracking-[0.12em]">路线信息</div>
          <div class="mt-2 leading-6 text-foreground">{{ metaLine }}</div>
        </div>
        <div v-if="mission.rewardTitle" class="rounded-[0.9rem] bg-background/70 p-3">
          <div class="text-[11px] uppercase tracking-[0.12em]">奖励</div>
          <div class="mt-2 leading-6 text-foreground">{{ mission.rewardTitle }}</div>
        </div>
      </div>

      <RouterLink :to="`/tasks/${mission.id}`" class="block">
        <ClientButton class="w-full justify-center">查看任务详情</ClientButton>
      </RouterLink>
    </div>
  </ClientCard>
</template>
