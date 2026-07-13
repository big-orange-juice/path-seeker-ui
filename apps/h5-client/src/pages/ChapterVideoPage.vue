<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionChapterReady } from "@/composables/useMissionChapterReady"
import { useCinemaStore } from "@/stores/useCinemaStore"
import defaultMovieUrl from "@/assets/styles/movie.mp4"

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
const cinemaStore = useCinemaStore()
const { missionStore, ensureMissionChapter } = useMissionChapterReady()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))
const ready = shallowRef(false)
const finishing = shallowRef(false)
const progressPct = shallowRef(0)
const statusText = shallowRef("即将播放")
const videoRef = useTemplateRef<HTMLVideoElement>("videoEl")

const chapter = computed(() => missionStore.currentChapter)
const videoSrc = computed(() => defaultMovieUrl)

async function bootstrap() {
  ready.value = false
  const ok = await ensureMissionChapter(routeId.value, chapterId.value)
  if (!ok) {
    ready.value = true
    return
  }

  const gate = missionStore.getChapterProgress(chapterId.value)
  if (gate.solved) {
    await router.replace(`/missions/${routeId.value}/map`)
    return
  }
  if (gate.videoWatched && !gate.solved) {
    await router.replace(`/missions/${routeId.value}/chapters/${chapterId.value}/puzzle`)
    return
  }
  if (!gate.recognized) {
    // 未识别时仍允许进入播片（用户可从 brief 跳过识别后会先 mark recognized）
    // 若直接深链到 video，也允许继续，避免卡死
  }

  ready.value = true
  requestAnimationFrame(() => {
    void tryAutoplay()
  })
}

function unlockVideo() {
  missionStore.markChapterVideoWatched(chapterId.value)
}

async function toPuzzle() {
  if (finishing.value) {
    return
  }
  finishing.value = true
  cinemaStore.setVideoPlaying(false)
  unlockVideo()
  await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/puzzle`)
}

async function skipVideo() {
  toastStore.info("已跳过短片", "识别与播片接口待定，可直接闯关。")
  await toPuzzle()
}

async function tryAutoplay() {
  const video = videoRef.value
  if (!video) {
    return
  }

  try {
    video.muted = false
    await video.play()
    statusText.value = "播放中"
    cinemaStore.setVideoPlaying(true)
    return
  } catch {
    /* fallthrough */
  }

  try {
    video.muted = true
    await video.play()
    statusText.value = "播放中 · 轻触开声"
    cinemaStore.setVideoPlaying(true)
  } catch {
    statusText.value = "轻触播放"
    cinemaStore.setVideoPlaying(false)
  }
}

function onTimeUpdate() {
  const video = videoRef.value
  if (!video?.duration) {
    return
  }
  const pct = (video.currentTime / video.duration) * 100
  progressPct.value = pct
  if (pct >= 55) {
    unlockVideo()
    statusText.value = "可以闯关了"
  }
}

async function onEnded() {
  unlockVideo()
  statusText.value = "看完了"
  await toPuzzle()
}

function onPlayClick() {
  const video = videoRef.value
  if (!video) {
    return
  }
  video.muted = false
  void video.play().then(() => {
    statusText.value = "播放中"
    cinemaStore.setVideoPlaying(true)
  }).catch(() => {
    toastStore.warning("无法自动播放", "请点一下画面再试。")
  })
}

function togglePlay() {
  const video = videoRef.value
  if (!video) {
    return
  }
  if (video.paused) {
    video.muted = false
    void video.play()
    statusText.value = "播放中"
    cinemaStore.setVideoPlaying(true)
  } else {
    video.pause()
    statusText.value = "已暂停"
    cinemaStore.setVideoPlaying(false)
  }
}

onMounted(() => {
  void bootstrap()
})

onUnmounted(() => {
  cinemaStore.setVideoPlaying(false)
  videoRef.value?.pause()
})
</script>

<template>
  <div class="space-y-4">
    <div v-if="ready && chapter" class="film-stage-shell space-y-4">
      <div class="flex items-start justify-between gap-3 px-1">
        <div class="min-w-0 space-y-1">
          <p class="client-top-kicker">观展短片</p>
          <h2 class="font-display text-2xl leading-tight text-foreground">{{ chapter.title }}</h2>
        </div>
        <ClientButton variant="outline" class="shrink-0" @click="skipVideo()">跳过</ClientButton>
      </div>

      <div class="film-soft-edge relative overflow-hidden">
        <video
          ref="videoEl"
          class="aspect-video w-full object-cover"
          playsinline
          preload="auto"
          :src="videoSrc"
          @timeupdate="onTimeUpdate"
          @ended="onEnded"
          @click="togglePlay"
        />
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/10">
          <div class="h-full bg-primary transition-[width]" :style="{ width: `${progressPct}%` }" />
        </div>
      </div>

      <p class="text-center text-sm text-muted-foreground">{{ statusText }}</p>

      <div class="grid gap-3">
        <ClientButton class="w-full" @click="onPlayClick()">播放</ClientButton>
        <ClientButton variant="outline" class="w-full" @click="skipVideo()">跳过短片，去闯关</ClientButton>
        <ClientButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">
          返回路线
        </ClientButton>
      </div>

      <p class="text-center text-xs text-muted-foreground">
        播片接口待定：可用默认短片或直接跳过
      </p>
    </div>

    <ClientCard v-else-if="!ready || missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <ClientSkeleton class="h-6 w-24" />
        <ClientSkeleton class="h-48 w-full" />
        <ClientSkeleton class="h-10 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="短片不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '请回到路线重新进入。'"
      action-text="返回路线"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>

<style scoped>
.film-soft-edge {
  border-radius: 1.25rem;
  border: 1px solid rgba(209, 178, 111, 0.22);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 24px 60px rgba(0, 0, 0, 0.45),
    inset 0 0 40px rgba(209, 178, 111, 0.06);
  background: rgba(0, 0, 0, 0.45);
}

.film-soft-edge video {
  display: block;
}
</style>
