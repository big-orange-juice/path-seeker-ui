<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { RouterLink, useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getDifficultyLabel } from "@/utils/puzzleLabels"
import { resolveMissionCoverTheme } from "@/utils/missionTheme"
import type { AgeBand, MissionDetail } from "@/types/mission"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))
const mission = shallowRef<MissionDetail | null>(null)
const selectedAgeBand = shallowRef<AgeBand>("10-15")

const coverTheme = computed(() =>
  mission.value ? resolveMissionCoverTheme(mission.value) : "bronze",
)

const metaTags = computed(() => {
  const current = mission.value
  if (!current) {
    return [] as string[]
  }
  return [
    getDifficultyLabel(current.difficultyLevel),
    current.chapterCount ? `${current.chapterCount} 站` : "",
    current.estimatedMinutes ? `${current.estimatedMinutes} 分` : "",
  ].filter(Boolean)
})

const canResumeCurrent = computed(() => {
  if (!mission.value || !missionStore.activeSession) {
    return false
  }
  return missionStore.activeSession.routeId === mission.value.id && missionStore.activeSession.status === "in_progress"
})

async function loadMission() {
  const cachedMission = missionStore.getMission(routeId.value)
  if (cachedMission) {
    mission.value = cachedMission
    selectedAgeBand.value = cachedMission.recommendedAgeBand
    return
  }

  const loadedMission = await missionStore.loadMissionDetail(routeId.value)
  mission.value = loadedMission
  selectedAgeBand.value = loadedMission?.recommendedAgeBand || "10-15"
}

async function handleStartMission() {
  if (!mission.value) {
    return
  }

  const session = await missionStore.startRemoteMission(mission.value.id, selectedAgeBand.value)
  if (!session) {
    toastStore.error("开启失败", missionStore.gameplayError || "请稍后重试。")
    return
  }

  toastStore.success("出发", `已进入《${mission.value.title}》。`)

  await router.push(
    mission.value.prologue.length
      ? `/missions/${mission.value.id}/prologue`
      : `/missions/${mission.value.id}/map`,
  )
}

async function handleContinueMission() {
  if (!mission.value) {
    return
  }

  if (missionStore.activeSession?.routeId === mission.value.id) {
    await missionStore.restoreActiveMission()
  } else {
    const session = await missionStore.startRemoteMission(mission.value.id, selectedAgeBand.value)
    if (!session) {
      toastStore.error("恢复失败", missionStore.gameplayError || "请稍后重试。")
      return
    }
  }

  const resumePath = missionStore.resolveResumeRoutePath()
  toastStore.info("接着玩", "已按服务端进度定位。")
  await router.push(
    resumePath && missionStore.activeSession?.routeId === mission.value.id
      ? resumePath
      : `/missions/${mission.value.id}/map`,
  )
}

onMounted(() => {
  void loadMission()
})
</script>

<template>
  <div class="space-y-5">
    <template v-if="mission">
      <section class="art-hero" :class="`theme-${coverTheme}`">
        <div class="art-hero-glow" aria-hidden="true" />
        <div class="relative mb-3 flex flex-wrap gap-1.5">
          <span
            v-for="(tag, index) in metaTags"
            :key="`${tag}-${index}`"
            class="client-tag"
            :class="{ 'is-gold': index === 0 }"
          >
            {{ tag }}
          </span>
          <span v-if="mission.theme" class="client-tag">{{ mission.theme }}</span>
        </div>
        <h2 class="relative font-display text-[1.85rem] leading-tight text-foreground">
          {{ mission.title }}
        </h2>
        <p v-if="mission.summary" class="relative mt-3 max-w-[22rem] text-[0.92rem] leading-relaxed text-muted-foreground">
          {{ mission.summary }}
        </p>
        <p v-if="mission.rewardTitle" class="relative mt-3 text-xs tracking-wide text-primary">
          完成可得 · {{ mission.rewardTitle }}
        </p>
      </section>

      <section v-if="mission.availableAgeBands.length > 1" class="space-y-2">
        <p class="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground">年龄档</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="band in mission.availableAgeBands"
            :key="band"
            type="button"
            class="auth-mode-chip"
            :class="{ 'is-active': band === selectedAgeBand }"
            @click="selectedAgeBand = band"
          >
            {{ band }}
          </button>
        </div>
      </section>

      <section v-if="mission.chapters.length" class="space-y-2">
        <p class="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground">这一路会经过</p>
        <div class="space-y-0">
          <div
            v-for="chapter in mission.chapters"
            :key="chapter.id"
            class="art-chapter-pill"
          >
            <span class="art-chapter-n">{{ chapter.stageNo }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-foreground">{{ chapter.title }}</p>
              <p v-if="chapter.targetLocation" class="truncate text-xs text-muted-foreground">
                {{ chapter.targetLocation }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div class="grid gap-3 pt-1">
        <ClientButton
          v-if="canResumeCurrent"
          class="w-full"
          :disabled="missionStore.gameplayPending"
          @click="handleContinueMission()"
        >
          接着玩
        </ClientButton>
        <ClientButton
          :variant="canResumeCurrent ? 'outline' : 'default'"
          class="w-full"
          :disabled="missionStore.gameplayPending"
          @click="handleStartMission()"
        >
          {{
            missionStore.gameplayPending
              ? "准备中..."
              : canResumeCurrent
                ? "从头开始"
                : "开始探索"
          }}
        </ClientButton>
      </div>
    </template>

    <ClientCard v-else-if="missionStore.detailPending">
      <div class="space-y-4 p-5">
        <ClientSkeleton class="h-6 w-32" />
        <ClientSkeleton class="h-10 w-full" />
        <ClientSkeleton class="h-24 w-full" />
        <ClientSkeleton class="h-10 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="任务不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '当前路线暂时没有可用详情。'"
    >
      <RouterLink to="/shell/hall" class="block">
        <ClientButton variant="outline" class="w-full">返回展厅</ClientButton>
      </RouterLink>
    </ClientEmptyState>
  </div>
</template>
