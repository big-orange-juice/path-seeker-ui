<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { getInteractionTypeMeta } from "@path-seeker/game-renderer"
import { ClientButton, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getDifficultyLabel } from "@/utils/puzzleLabels"
import { resolveMissionCoverTheme } from "@/utils/missionTheme"
import defaultPost from "@/assets/images/default-post.png"
import type { AgeBand, MissionDetail } from "@/types/mission"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))
const previewMission = shallowRef<MissionDetail | null>(null)
const selectedAgeBand = shallowRef<AgeBand>("10-15")
const bootstrapped = shallowRef(false)

/** 本路线已有可玩会话（详情也已就绪） */
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

/** 与展厅海报同源：Detail.route.coverImageUrl */
const coverUrl = computed(() => {
  const url = String(displayMission.value?.coverImageUrl || "").trim()
  return url || defaultPost
})

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
  if (!displayMission.value || !missionStore.activeSession) {
    return false
  }
  return (
    missionStore.activeSession.routeId === displayMission.value.id
    && missionStore.activeSession.status === "in_progress"
  )
})

/** 统一站点列表：未开始只展示；进行中带状态，可点选 */
const stationList = computed(() => {
  const mission = displayMission.value
  if (!mission?.chapters.length) {
    return [] as Array<{
      id: string
      index: number
      title: string
      targetLocation?: string
      typeLabel: string
      stateLabel: string
      displayNo: number
      solved: boolean
      active: boolean
      selectable: boolean
    }>
  }

  return mission.chapters.map((chapter, index) => {
    const type = Number(chapter.interactionType ?? chapter.puzzle?.interactionType ?? 0)
    const typeLabel = getInteractionTypeMeta(type)?.label || ""
    const displayNo = chapter.sortOrder || chapter.stageNo || index + 1

    if (!hasActiveSession.value || !missionStore.activeSession) {
      return {
        id: chapter.id,
        index,
        title: chapter.title,
        targetLocation: chapter.targetLocation,
        typeLabel,
        stateLabel: "待探索",
        displayNo,
        solved: false,
        active: false,
        selectable: false,
      }
    }

    const progress = missionStore.getChapterProgress(chapter.id)
    const solved = missionStore.activeSession.solvedChapterIds.includes(chapter.id) || progress.solved
    const active = missionStore.activeSession.currentChapterIndex === index

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
      id: chapter.id,
      index,
      title: chapter.title,
      targetLocation: chapter.targetLocation,
      typeLabel,
      stateLabel,
      displayNo,
      solved,
      active,
      selectable: true,
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
  }

  await loadPreviewMission()
  bootstrapped.value = true
}

async function handleStartMission() {
  if (!displayMission.value) {
    return
  }

  const session = await missionStore.startRemoteMission(displayMission.value.id, selectedAgeBand.value)
  if (!session) {
    toastStore.error("开启失败", missionStore.gameplayError || "请稍后重试。")
    return
  }

  toastStore.success("出发", `已进入《${displayMission.value.title}》。`)
  // 同一页切到可点选态，不跳转、不换布局
  await ensureMissionReady()
}

async function handleContinueMission() {
  if (!displayMission.value) {
    return
  }

  if (missionStore.activeSession?.routeId === displayMission.value.id) {
    await missionStore.restoreActiveMission()
  } else {
    const session = await missionStore.startRemoteMission(displayMission.value.id, selectedAgeBand.value)
    if (!session) {
      toastStore.error("恢复失败", missionStore.gameplayError || "请稍后重试。")
      return
    }
  }

  const resumePath = missionStore.resolveResumeRoutePath()
  toastStore.info("接着玩", "已按服务端进度定位。")

  if (resumePath && missionStore.activeSession?.routeId === displayMission.value.id) {
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
  if (!hasActiveSession.value) {
    toastStore.info("先开始探索", "点下方按钮开启路线后再选站。")
    return
  }

  const alreadySelected = missionStore.activeSession?.currentChapterIndex === index
  missionStore.selectChapter(index)
  if (alreadySelected) {
    void enterSelectedChapter()
  }
}

async function enterSelectedChapter() {
  if (!missionStore.currentChapter || !missionStore.activeSession) {
    toastStore.info("先开始探索", "点下方按钮开启路线后再进入站点。")
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
  <div class="space-y-5">
    <!-- 单一选站页 · 去 card：art-hero + 分割线站点流 -->
    <template v-if="bootstrapped && displayMission">
      <section class="art-hero has-cover" :class="`theme-${coverTheme}`">
        <!-- 氛围层：虚化远景 + 轻近景，四边 mask 溶进星空底 -->
        <div class="art-hero-cover" aria-hidden="true">
          <img class="art-hero-cover-blur" :src="coverUrl" alt="" loading="lazy">
          <img class="art-hero-cover-focus" :src="coverUrl" alt="" loading="lazy">
        </div>
        <div class="art-hero-veil" aria-hidden="true" />
        <div class="art-hero-glow" aria-hidden="true" />
        <div class="art-hero-body">
          <div class="mb-3 flex flex-wrap gap-1.5">
            <span
              v-for="(tag, index) in metaTags"
              :key="`${tag}-${index}`"
              class="client-tag"
              :class="{ 'is-gold': index === 0 }"
            >
              {{ tag }}
            </span>
            <span v-if="displayMission.theme" class="client-tag">{{ displayMission.theme }}</span>
            <span v-if="hasActiveSession" class="client-tag is-gold">
              {{ currentStepLabel }} · {{ missionStore.progressPercent }}%
            </span>
          </div>
          <h2 class="art-hero-title font-display text-[1.85rem] leading-tight text-foreground">
            {{ displayMission.title }}
          </h2>
          <p
            v-if="displayMission.summary"
            class="art-hero-summary mt-3 max-w-[22rem] text-[0.92rem] leading-relaxed text-muted-foreground"
          >
            {{ displayMission.summary }}
          </p>
          <p
            v-if="!hasActiveSession && displayMission.rewardTitle"
            class="mt-3 text-xs tracking-wide text-primary"
          >
            完成可得 · {{ displayMission.rewardTitle }}
          </p>
          <p
            v-else-if="hasActiveSession"
            class="mt-3 text-xs tracking-wide text-primary"
          >
            {{ missionStore.activeSession?.totalScore ?? 0 }} 分 · 点选站点进入
          </p>
        </div>
      </section>

      <section
        v-if="!hasActiveSession && displayMission.availableAgeBands.length > 1"
        class="space-y-2"
      >
        <p class="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground">年龄档</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="band in displayMission.availableAgeBands"
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

      <section v-if="stationList.length" class="space-y-1">
        <p class="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground">
          {{ hasActiveSession ? "选择站点" : "这一路会经过" }}
        </p>
        <div>
          <button
            v-for="chapter in stationList"
            :key="chapter.id"
            type="button"
            class="art-chapter-pill"
            :class="{
              'is-active': chapter.active,
              'is-done': chapter.solved,
            }"
            @click="selectChapter(chapter.index)"
          >
            <span class="art-chapter-n">
              {{ chapter.solved ? "✓" : chapter.displayNo }}
            </span>
            <div class="art-chapter-body">
              <p class="art-chapter-title">{{ chapter.title }}</p>
              <p v-if="chapter.typeLabel || chapter.targetLocation" class="art-chapter-meta">
                <span v-if="chapter.typeLabel">{{ chapter.typeLabel }}</span>
                <span v-if="chapter.typeLabel && chapter.targetLocation"> · </span>
                <span v-if="chapter.targetLocation">{{ chapter.targetLocation }}</span>
              </p>
            </div>
            <span v-if="hasActiveSession" class="art-chapter-state">
              {{ chapter.stateLabel }}
            </span>
          </button>
        </div>
      </section>

      <div class="grid gap-3 pt-1">
        <template v-if="hasActiveSession">
          <ClientButton class="w-full" @click="enterSelectedChapter()">
            进入这一站
          </ClientButton>
          <ClientButton variant="outline" class="w-full" @click="goBackToHall()">
            返回展厅
          </ClientButton>
        </template>
        <template v-else>
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
        </template>
      </div>
    </template>

    <!-- 加载：扁平骨架，不用卡片壳 -->
    <div
      v-else-if="!bootstrapped || missionStore.gameplayPending || missionStore.detailPending"
      class="space-y-4 pt-1"
    >
      <div class="space-y-3">
        <ClientSkeleton class="h-5 w-28 rounded-full" />
        <ClientSkeleton class="h-9 w-52" />
        <ClientSkeleton class="h-4 w-40" />
      </div>
      <div class="space-y-0">
        <div v-for="n in 4" :key="n" class="flex items-center gap-3 border-b border-white/5 py-3">
          <ClientSkeleton class="h-6 w-6 shrink-0 rounded-full" />
          <div class="min-w-0 flex-1 space-y-2">
            <ClientSkeleton class="h-4 w-3/4" />
            <ClientSkeleton class="h-3 w-1/2" />
          </div>
        </div>
      </div>
    </div>

    <ClientEmptyState
      v-else
      title="任务不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '当前路线暂时没有可用详情。'"
      action-text="返回展厅"
      @action="goBackToHall()"
    />
  </div>
</template>
