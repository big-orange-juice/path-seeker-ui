<script setup lang="ts">
import { computed } from "vue"
import { RouterLink } from "vue-router"
import { Play } from "lucide-vue-next"
import { getDifficultyLabel } from "@/utils/puzzleLabels"
import { resolveMissionCoverTheme } from "@/utils/missionTheme"
import type { MissionRouteCard } from "@/types/mission"

interface Props {
  mission: MissionRouteCard
}

const props = defineProps<Props>()

const coverTheme = computed(() => resolveMissionCoverTheme(props.mission))
const difficultyLabel = computed(() => getDifficultyLabel(props.mission.difficultyLevel))

const tags = computed(() =>
  [
    props.mission.theme || difficultyLabel.value,
    difficultyLabel.value,
    props.mission.chapterCount ? `${props.mission.chapterCount} 站` : "",
    props.mission.estimatedMinutes ? `${props.mission.estimatedMinutes} 分` : "",
  ].filter(Boolean),
)
</script>

<template>
  <RouterLink
    :to="`/tasks/${mission.id}`"
    class="mission-card"
    :class="`theme-${coverTheme}`"
  >
    <div class="mission-card-bg" aria-hidden="true">
      <div class="mission-card-noise" />
    </div>
    <div class="mission-card-body">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 space-y-1.5">
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="(tag, index) in tags"
              :key="`${tag}-${index}`"
              class="client-tag"
              :class="{ 'is-gold': index === 0 }"
            >
              {{ tag }}
            </span>
          </div>
          <h3 class="font-display text-[1.35rem] leading-tight text-foreground">
            {{ mission.title }}
          </h3>
        </div>
        <span class="mission-card-go" aria-hidden="true">
          <Play class="ml-0.5 h-4 w-4 fill-current" />
        </span>
      </div>
      <p v-if="mission.rewardTitle" class="text-xs text-muted-foreground">
        {{ mission.rewardTitle }}
      </p>
      <p v-else-if="mission.summary" class="line-clamp-2 text-xs text-muted-foreground">
        {{ mission.summary }}
      </p>
    </div>
  </RouterLink>
</template>
