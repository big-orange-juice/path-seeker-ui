<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { getInteractionTypeMeta } from "@path-seeker/game-renderer"
import { ClientButton, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { resolveMissionCoverTheme } from "@/utils/missionTheme"
import defaultPost from "@/assets/images/default-post.png"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))
const bootstrapped = shallowRef(false)
const startFailed = shallowRef(false)

/** 本页只服务「已开会话」的选站；进入时自动 Join，无预览阶段 */
const displayMission = computed(() => {
  if (missionStore.activeSession?.routeId === routeId.value) {
    return missionStore.activeMission
  }
  return null
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
    current.chapterCount ? `${current.chapterCount} 站` : "",
    current.estimatedMinutes ? `${current.estimatedMinutes} 分` : "",
  ].filter(Boolean)
})

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
    }>
  }

  return mission.chapters.map((chapter, index) => {
    const type = Number(chapter.interactionType ?? chapter.puzzle?.interactionType ?? 0)
    const typeLabel = getInteractionTypeMeta(type)?.label || ""
    const displayNo = chapter.sortOrder || chapter.stageNo || index + 1
    const progress = missionStore.getChapterProgress(chapter.id)
    const solved =
      Boolean(missionStore.activeSession?.solvedChapterIds.includes(chapter.id))
      || progress.solved
    const active = missionStore.activeSession?.currentChapterIndex === index

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
    }
  })
})

const currentStepLabel = computed(() => {
  if (!missionStore.activeSession || !displayMission.value) {
    return ""
  }
  return `${missionStore.activeSession.solvedChapterIds.length}/${displayMission.value.chapterCount}`
})

/**
 * 进入 map 即就绪选站：有本路线会话则恢复，否则自动 Join。
 * 不再保留「开始探索」预览态。
 */
async function ensureMissionReady() {
  bootstrapped.value = false
  startFailed.value = false
  const id = routeId.value
  if (!id) {
    bootstrapped.value = true
    startFailed.value = true
    return
  }

  if (missionStore.activeSession?.routeId === id) {
    if (!missionStore.activeMission) {
      await missionStore.restoreActiveMission()
    }
    if (missionStore.activeMission) {
      bootstrapped.value = true
      return
    }
  }

  // 推荐年龄档直接开局；多档场景后续若要改档可再加
  const cached = missionStore.getMission(id)
  const ageBand = cached?.recommendedAgeBand || "10-15"
  const session = await missionStore.startRemoteMission(id, ageBand)

  if (!session || missionStore.activeSession?.routeId !== id) {
    startFailed.value = true
    bootstrapped.value = true
    return
  }

  bootstrapped.value = true
}

function selectChapter(index: number) {
  if (!displayMission.value || !missionStore.activeSession) {
    return
  }

  const alreadySelected = missionStore.activeSession.currentChapterIndex === index
  missionStore.selectChapter(index)
  if (alreadySelected) {
    void enterSelectedChapter()
  }
}

async function enterSelectedChapter() {
  if (!missionStore.currentChapter || !missionStore.activeSession) {
    toastStore.info("请先选站", "点选上方站点后再进入。")
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
    <!-- 单一选站页：进入即会话，无「开始探索」预览 -->
    <template v-if="bootstrapped && displayMission">
      <section class="art-hero has-cover" :class="`theme-${coverTheme}`">
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
            <span v-if="currentStepLabel" class="client-tag is-gold">
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
          <p class="mt-3 text-xs tracking-wide text-primary">
            点选站点进入
          </p>
        </div>
      </section>

      <section v-if="stationList.length" class="space-y-1">
        <p class="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground">
          选择站点
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
            <span class="art-chapter-state">
              {{ chapter.stateLabel }}
            </span>
          </button>
        </div>
      </section>

      <div class="grid gap-3 pt-1">
        <ClientButton class="w-full" @click="enterSelectedChapter()">
          进入这一站
        </ClientButton>
        <ClientButton variant="outline" class="w-full" @click="goBackToHall()">
          返回展厅
        </ClientButton>
      </div>
    </template>

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
      :description="
        missionStore.gameplayError
        || missionStore.detailError
        || (startFailed ? '开启路线失败，请稍后重试。' : '当前路线暂时没有可用详情。')
      "
      action-text="返回展厅"
      @action="goBackToHall()"
    />
  </div>
</template>
