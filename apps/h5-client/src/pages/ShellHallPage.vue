<script setup lang="ts">
import { computed } from "vue"
import { UiButton, UiCard, UiSelect } from "@path-seeker/ui"
import type { SelectOption } from "@path-seeker/ui"
import MissionPreviewCard from "@/components/shell/MissionPreviewCard.vue"
import ShellHeroCard from "@/components/shell/ShellHeroCard.vue"
import {
  AGE_BAND_OPTIONS,
  DIFFICULTY_OPTIONS,
  TASK_KIND_OPTIONS,
} from "@/constants/missionSchema"
import { useMissionStore } from "@/stores/useMissionStore"
import type { AgeBand, DifficultyLevel, TaskKind } from "@/types/mission"

const missionStore = useMissionStore()

const ageBandOptions: SelectOption[] = [
  { label: "全部年龄", value: "all" },
  ...AGE_BAND_OPTIONS.map((item) => ({
    label: item.label,
    value: item.value,
  })),
]

const difficultyOptions: SelectOption[] = [
  { label: "全部难度", value: "all" },
  ...DIFFICULTY_OPTIONS.map((item) => ({
    label: item.label,
    value: item.value,
  })),
]

const taskKindOptions: SelectOption[] = [
  { label: "全部玩法", value: "all" },
  ...TASK_KIND_OPTIONS.map((item) => ({
    label: item.label,
    value: item.value,
  })),
]

const emptyText = computed(() =>
  missionStore.routeListPending
    ? ""
    : missionStore.routeListError
      ? missionStore.routeListError
      : "当前筛选条件下没有可展示的路线，先换个年龄档或难度看看。",
)
</script>

<template>
  <div class="space-y-4">
    <ShellHeroCard
      :mission-count="missionStore.coverageSummary.missionCount"
      :archive-count="missionStore.coverageSummary.archiveCount"
      :has-active-session="missionStore.coverageSummary.hasActiveSession"
    />

    <UiCard class="client-panel">
      <div class="space-y-4 p-5">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-foreground">路线筛选</h2>
          <p class="client-page-copy">
            这里直接读取远程任务列表，并保持筛选条件持久化，进入路线后可继续完成开场、章节与题目流程。
          </p>
        </div>

        <div class="grid gap-3">
          <UiSelect
            :model-value="missionStore.filters.ageBand"
            :options="ageBandOptions"
            @update:model-value="missionStore.setFilters({ ageBand: $event as AgeBand })"
          />
          <UiSelect
            :model-value="missionStore.filters.difficulty"
            :options="difficultyOptions"
            @update:model-value="missionStore.setFilters({ difficulty: $event as DifficultyLevel })"
          />
          <UiSelect
            :model-value="missionStore.filters.taskKind"
            :options="taskKindOptions"
            @update:model-value="missionStore.setFilters({ taskKind: $event as TaskKind })"
          />
        </div>

        <UiButton variant="outline" class="w-full" @click="missionStore.resetFilters()">重置筛选</UiButton>
      </div>
    </UiCard>

    <div class="space-y-4">
      <MissionPreviewCard
        v-for="mission in missionStore.filteredRoutes"
        :key="mission.id"
        :mission="mission"
      />
    </div>

    <UiCard v-if="missionStore.routeListPending" class="client-panel">
      <div class="p-5 text-sm leading-6 text-muted-foreground">正在加载任务列表...</div>
    </UiCard>

    <UiCard v-if="emptyText" class="client-panel">
      <div class="p-5 text-sm leading-6 text-muted-foreground">{{ emptyText }}</div>
    </UiCard>
  </div>
</template>
