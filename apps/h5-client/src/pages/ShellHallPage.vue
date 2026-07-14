<script setup lang="ts">
import { computed, shallowRef } from "vue"
import type { SelectOption } from "@path-seeker/ui"
import { Filter } from "lucide-vue-next"
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
  missionStore.routeListError || "没有匹配路线，换个年龄或难度再试试。",
)

const filterOn = computed(() =>
  missionStore.filters.ageBand !== "all"
  || missionStore.filters.difficulty !== "all"
  || missionStore.filters.taskKind !== "all",
)

const filterSummary = computed(() =>
  [
    ageBandOptions.find((item) => item.value === missionStore.filters.ageBand)?.label,
    difficultyOptions.find((item) => item.value === missionStore.filters.difficulty)?.label,
    taskKindOptions.find((item) => item.value === missionStore.filters.taskKind)?.label,
  ].filter((item) => item && !String(item).startsWith("全部")),
)

function closeFilterSheet() {
  filterSheetOpen.value = false
}
</script>

<template>
  <div class="space-y-4">
    <div class="hall-hud">
      <div class="space-y-1">
        <span class="client-tag is-gold">今日路线</span>
        <p class="text-xs text-muted-foreground">
          {{ missionStore.coverageSummary.missionCount }} 条
          <template v-if="missionStore.coverageSummary.archiveCount">
            · 收藏 {{ missionStore.coverageSummary.archiveCount }}
          </template>
        </p>
      </div>
      <button
        type="button"
        class="ask-icon-btn"
        :class="{ 'text-primary border-primary/40': filterOn }"
        aria-label="筛选"
        @click="filterSheetOpen = true"
      >
        <Filter class="h-4 w-4" />
      </button>
    </div>

    <div v-if="filterSummary.length" class="flex flex-wrap gap-2">
      <span
        v-for="item in filterSummary"
        :key="item"
        class="client-tag"
      >
        {{ item }}
      </span>
    </div>

    <ClientSheet v-model="filterSheetOpen">
      <ClientSheetContent side="bottom">
        <ClientSheetHeader>
          <ClientSheetTitle>筛选</ClientSheetTitle>
          <ClientSheetDescription>
            按年龄、难度和玩法收窄路线。
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
          <ClientButton variant="outline" class="w-full" @click="missionStore.resetFilters()">重置</ClientButton>
          <ClientButton class="w-full" @click="closeFilterSheet()">确定</ClientButton>
        </ClientSheetFooter>
      </ClientSheetContent>
    </ClientSheet>

    <div v-if="missionStore.filteredRoutes.length" class="mission-rail">
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
      title="没有匹配路线"
      :description="emptyText"
    />
  </div>
</template>
