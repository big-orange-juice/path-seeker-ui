<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { getInteractionTypeMeta } from "@path-seeker/game-renderer"
import { ClientBadge, ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getDifficultyLabel } from "@/utils/puzzleLabels"
import { resolveMissionCoverTheme } from "@/utils/missionTheme"
import type { AgeBand, MissionDetail } from "@/types/mission"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))
const previewMission = shallowRef<MissionDetail | null>(null)
const selectedAgeBand = shallowRef<AgeBand>("10-15")
const bootstrapped = shallowRef(false)

const hasActiveSession = computed(
  () => missionStore.activeSession?.routeId === routeId.value && Boolean(missionStore.activeMission),
)

const displayMission = computed(() => {
  if (hasActiveSession.value) {
    return missionStore.activeMission
  }
  return previewMission.value
})

const coverTheme = computed(() =>
  displayMission.value ? resolveMissionCoverTheme(displayMission.value) : "bronze",
)

const metaTags = computed(() => {
  const current = displayMission.value
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
  if (!previewMission.value || !missionStore.activeSession) {
    return false
  }
  return (
    missionStore.activeSession.routeId === previewMission.value.id
    && missionStore.activeSession.status === "in_progress"
  )
})

const chapterStatuses = computed(() => {
  if (!missionStore.activeMission || !missionStore.activeSession) {
    return []
  }

  return missionStore.activeMission.chapters.map((chapter, index) => {
    const progress = missionStore.getChapterProgress(chapter.id)
    const solved = missionStore.activeSession?.solvedChapterIds.includes(chapter.id) || progress.solved
    const active = missionStore.activeSession?.currentChapterIndex === index

    const type = Number(chapter.interactionType ?? chapter.puzzle?.interactionType ?? 0)
    const typeLabel = getInteractionTypeMeta(type)?.label || ""

    let stateLabel = "待探索"
    if (solved) {
      stateLabel = "完成"
    } else if (active) {
      stateLabel = "当前"
    } else if (type === 11) {
      stateLabel = "待收听"
    } else if (progress.videoWatched) {
      stateLabel = type === 10 ? "待完成" : "待闯关"
    } else if (progress.recognized) {
      stateLabel = "待播片"
    } else if (type === 10) {
      stateLabel = "待找一找"
    }

    return {
      ...chapter,
      index,
      solved,
      active,
      stateLabel,
      typeLabel,
      displayNo: chapter.sortOrder || chapter.stageNo || index + 1,
    }
  })
})

const currentStepLabel = computed(() => {
  if (!missionStore.activeSession || !missionStore.activeMission) {
    return ""
  }

  return `${missionStore.activeSession.solvedChapterIds.length}/${missionStore.activeMission.chapterCount}`
})

async function loadPreviewMission() {
  const cachedMission = missionStore.getMission(routeId.value)
  if (cachedMission) {
    previewMission.value = cachedMission
    selectedAgeBand.value = cachedMission.recommendedAgeBand
    return cachedMission
  }

  const loadedMission = await missionStore.loadMissionDetail(routeId.value)
  previewMission.value = loadedMission
  selectedAgeBand.value = loadedMission?.recommendedAgeBand || "10-15"
  return loadedMission
}

async function ensureMissionReady() {
  bootstrapped.value = false

  // 有本路线会话：恢复详情后进入选站
  if (missionStore.activeSession?.routeId === routeId.value) {
    if (!missionStore.activeMission) {
      await missionStore.restoreActiveMission()
    }
    if (missionStore.activeMission) {
      previewMission.value = missionStore.activeMission
      selectedAgeBand.value = missionStore.activeSession?.selectedAgeBand
        || missionStore.activeMission.recommendedAgeBand
      bootstrapped.value = true
      return
    }
    // 恢复失败：仍展示预览，允许重新开始
  }

  // 无会话 / 恢复失败：加载详情，在本页直接开始
  await loadPreviewMission()
  bootstrapped.value = true
}

async function handleStartMission() {
  if (!previewMission.value) {
    return
  }

  const session = await missionStore.startRemoteMission(previewMission.value.id, selectedAgeBand.value)
  if (!session) {
    toastStore.error("开启失败", missionStore.gameplayError || "请稍后重试。")
    return
  }

  toastStore.success("出发", `已进入《${previewMission.value.title}》。`)

  if (previewMission.value.prologue.length) {
    await router.push(`/missions/${previewMission.value.id}/prologue`)
    return
  }

  // 已在 map：刷新会话态即可
  await ensureMissionReady()
}

async function handleContinueMission() {
  if (!previewMission.value) {
    return
  }

  if (missionStore.activeSession?.routeId === previewMission.value.id) {
    await missionStore.restoreActiveMission()
  } else {
    const session = await missionStore.startRemoteMission(previewMission.value.id, selectedAgeBand.value)
    if (!session) {
      toastStore.error("恢复失败", missionStore.gameplayError || "请稍后重试。")
      return
    }
  }

  const resumePath = missionStore.resolveResumeRoutePath()
  toastStore.info("接着玩", "已按服务端进度定位。")

  if (resumePath && missionStore.activeSession?.routeId === previewMission.value.id) {
    // 若恢复点就是 map，留在本页
    if (resumePath.endsWith("/map")) {
      await ensureMissionReady()
      return
    }
    await router.push(resumePath)
    return
  }

  await ensureMissionReady()
}

function selectChapter(index: number) {
  const alreadySelected = missionStore.activeSession?.currentChapterIndex === index
  missionStore.selectChapter(index)
  if (alreadySelected) {
    void enterSelectedChapter()
  }
}

async function enterSelectedChapter() {
  if (!missionStore.currentChapter || !missionStore.activeSession) {
    return
  }

  const chapter = missionStore.currentChapter
  const progress = missionStore.getChapterProgress(chapter.id)

  if (progress.solved || missionStore.activeSession.solvedChapterIds.includes(chapter.id)) {
    toastStore.info("这一站已完成", "可以选其他站点继续探索。")
    return
  }

  const path = missionStore.resolveEnterChapterPath(chapter.id)
  if (!path) {
    return
  }

  await router.push(path)
}

async function goBackToHall() {
  await router.push("/shell/hall")
}

watch(routeId, () => {
  void ensureMissionReady()
})

onMounted(() => {
  void ensureMissionReady()
})
</script>

<template>
  <div class="space-y-4">
    <!-- 进行中：路线选站 -->
    <ClientCard v-if="hasActiveSession && missionStore.activeSession" class="overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <ClientBadge>{{ currentStepLabel }} 站 · {{ missionStore.activeSession.totalScore }} 分</ClientBadge>
            <h2 class="font-display text-3xl leading-tight text-foreground">
              {{ missionStore.activeMission?.title }}
            </h2>
            <p v-if="missionStore.currentChapter?.targetLocation" class="client-page-copy">
              {{ missionStore.currentChapter.targetLocation }}
            </p>
          </div>
          <div class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {{ missionStore.progressPercent }}%
          </div>
        </div>

        <div
          v-if="missionStore.currentChapter"
          class="rounded-[1rem] bg-background/70 p-4"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">当前站点</p>
          <h3 class="mt-2 text-lg font-semibold text-foreground">{{ missionStore.currentChapter.title }}</h3>
          <p class="mt-2 text-sm leading-6 text-muted-foreground">
            {{
              missionStore.currentChapter.objective
                || missionStore.currentChapter.artifact.detailCallout
                || "到站后细细观察。"
            }}
          </p>
          <p v-if="missionStore.currentChapter.targetLocation" class="mt-2 text-xs text-muted-foreground">
            {{ missionStore.currentChapter.targetLocation }}
          </p>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-foreground">路线站点</h3>
            <span class="text-sm text-muted-foreground">{{ missionStore.activeMission?.chapterCount }} 站</span>
          </div>

          <div class="space-y-3">
            <button
              v-for="chapter in chapterStatuses"
              :key="chapter.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-[1rem] border p-4 text-left transition-colors"
              :class="chapter.active ? 'border-primary bg-primary/5' : chapter.solved ? 'border-primary/30 bg-background/80' : 'border-border bg-background/70'"
              @click="selectChapter(chapter.index)"
            >
              <div
                class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                :class="chapter.solved || chapter.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
              >
                {{ chapter.solved ? "✓" : chapter.displayNo }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-foreground">{{ chapter.title }}</div>
                <div class="text-sm text-muted-foreground">
                  <span v-if="chapter.typeLabel">{{ chapter.typeLabel }}</span>
                  <span v-if="chapter.typeLabel && chapter.targetLocation"> · </span>
                  <span v-if="chapter.targetLocation">{{ chapter.targetLocation }}</span>
                </div>
              </div>
              <div class="text-right text-xs text-muted-foreground">
                {{ chapter.stateLabel }}
              </div>
            </button>
          </div>
        </div>

        <div class="grid gap-3">
          <ClientButton class="w-full" @click="enterSelectedChapter()">进入这一站</ClientButton>
          <ClientButton variant="outline" class="w-full" @click="goBackToHall()">返回展厅</ClientButton>
        </div>
      </div>
    </ClientCard>

    <!-- 未开始：路线预览 + 开始 / 接着玩 -->
    <template v-else-if="bootstrapped && previewMission">
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
          <span v-if="previewMission.theme" class="client-tag">{{ previewMission.theme }}</span>
        </div>
        <h2 class="relative font-display text-[1.85rem] leading-tight text-foreground">
          {{ previewMission.title }}
        </h2>
        <p v-if="previewMission.summary" class="relative mt-3 max-w-[22rem] text-[0.92rem] leading-relaxed text-muted-foreground">
          {{ previewMission.summary }}
        </p>
        <p v-if="previewMission.rewardTitle" class="relative mt-3 text-xs tracking-wide text-primary">
          完成可得 · {{ previewMission.rewardTitle }}
        </p>
      </section>

      <section v-if="previewMission.availableAgeBands.length > 1" class="space-y-2">
        <p class="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground">年龄档</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="band in previewMission.availableAgeBands"
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

      <section v-if="previewMission.chapters.length" class="space-y-2">
        <p class="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground">这一路会经过</p>
        <div class="space-y-0">
          <div
            v-for="chapter in previewMission.chapters"
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
        <ClientButton variant="outline" class="w-full" @click="goBackToHall()">
          返回展厅
        </ClientButton>
      </div>
    </template>

    <ClientCard v-else-if="!bootstrapped || missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <ClientSkeleton class="h-6 w-28 rounded-full" />
            <ClientSkeleton class="h-10 w-48" />
            <ClientSkeleton class="h-5 w-32" />
          </div>
          <ClientSkeleton class="h-8 w-16 rounded-full" />
        </div>
        <ClientSkeleton class="h-24 w-full" />
        <ClientSkeleton class="h-20 w-full" />
        <ClientSkeleton class="h-20 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="任务不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '当前路线暂时没有可用详情。'"
      action-text="返回展厅"
      @action="goBackToHall()"
    />
  </div>
</template>
