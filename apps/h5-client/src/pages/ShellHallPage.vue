<script setup lang="ts">
import { computed, shallowRef } from "vue"
import type { SelectOption } from "@path-seeker/ui"
import {
  ClientButton,
  ClientCard,
  ClientEmptyState,
  ClientSelect,
  ClientSheet,
  ClientSheetContent,
  ClientSheetDescription,
  ClientSheetFooter,
  ClientSheetHeader,
  ClientSheetTitle,
  ClientSkeleton,
} from "@/components/ui"
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
const filterSheetOpen = shallowRef(false)

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
  missionStore.routeListError || "当前筛选条件下没有可展示的路线，先换个年龄档或难度看看。",
)

const filterSummary = computed(() =>
  [
    ageBandOptions.find((item) => item.value === missionStore.filters.ageBand)?.label,
    difficultyOptions.find((item) => item.value === missionStore.filters.difficulty)?.label,
    taskKindOptions.find((item) => item.value === missionStore.filters.taskKind)?.label,
  ].filter((item) => item && item !== "全部年龄" && item !== "全部难度" && item !== "全部玩法"),
)

function closeFilterSheet() {
  filterSheetOpen.value = false
}
</script>

<template>
  <div class="space-y-4">
    <ShellHeroCard
      :mission-count="missionStore.coverageSummary.missionCount"
      :archive-count="missionStore.coverageSummary.archiveCount"
      :has-active-session="missionStore.coverageSummary.hasActiveSession"
    />

    <ClientCard>
      <div class="space-y-4 p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-foreground">路线筛选</h2>
            <p class="client-page-copy">
              这里直接读取远程任务列表，并保持筛选条件持久化，进入路线后可继续完成开场、章节与题目流程。
            </p>
          </div>
          <ClientButton variant="outline" class="shrink-0" @click="filterSheetOpen = true">筛选</ClientButton>
        </div>

        <div v-if="filterSummary.length" class="flex flex-wrap gap-2">
          <span
            v-for="item in filterSummary"
            :key="item"
            class="rounded-full bg-background/70 px-3 py-1 text-sm text-muted-foreground"
          >
            {{ item }}
          </span>
        </div>
      </div>
    </ClientCard>

    <ClientSheet v-model="filterSheetOpen">
      <ClientSheetContent side="bottom">
        <ClientSheetHeader>
          <ClientSheetTitle>筛选路线</ClientSheetTitle>
          <ClientSheetDescription>
            按年龄档、难度和玩法收窄路线列表，筛选条件会跟随会话一起保留下来。
          </ClientSheetDescription>
        </ClientSheetHeader>

        <div class="mt-5 grid gap-3">
          <ClientSelect
            :model-value="missionStore.filters.ageBand"
            :options="ageBandOptions"
            @update:model-value="missionStore.setFilters({ ageBand: $event as AgeBand })"
          />
          <ClientSelect
            :model-value="missionStore.filters.difficulty"
            :options="difficultyOptions"
            @update:model-value="missionStore.setFilters({ difficulty: $event as DifficultyLevel })"
          />
          <ClientSelect
            :model-value="missionStore.filters.taskKind"
            :options="taskKindOptions"
            @update:model-value="missionStore.setFilters({ taskKind: $event as TaskKind })"
          />
        </div>

        <ClientSheetFooter>
          <ClientButton variant="outline" class="w-full" @click="missionStore.resetFilters()">重置筛选</ClientButton>
          <ClientButton class="w-full" @click="closeFilterSheet()">查看结果</ClientButton>
        </ClientSheetFooter>
      </ClientSheetContent>
    </ClientSheet>

    <div v-if="missionStore.filteredRoutes.length" class="space-y-4">
      <MissionPreviewCard
        v-for="mission in missionStore.filteredRoutes"
        :key="mission.id"
        :mission="mission"
      />
    </div>

    <ClientCard v-else-if="missionStore.routeListPending">
      <div class="space-y-4 p-5">
        <ClientSkeleton class="h-32 w-full" />
        <ClientSkeleton class="h-32 w-full" />
        <ClientSkeleton class="h-32 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="暂无可展示路线"
      :description="emptyText"
    />
  </div>
</template>
