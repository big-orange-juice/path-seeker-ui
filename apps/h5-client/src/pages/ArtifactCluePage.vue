<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { FindScanRenderer } from "@path-seeker/game-renderer"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionChapterReady } from "@/composables/useMissionChapterReady"

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
const { missionStore, ensureMissionChapter } = useMissionChapterReady()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))
const ready = shallowRef(false)
const scanning = shallowRef(false)
const locked = shallowRef(false)
const previewUrl = shallowRef<string | null>(null)
const scanStatus = shallowRef<"idle" | "scanning" | "success" | "failed">("idle")

const chapter = computed(() => missionStore.currentChapter)
const artifact = computed(() => missionStore.currentArtifact)

const exhibitLabel = computed(() => artifact.value?.title || chapter.value?.title || "展品")
const placeLabel = computed(() => artifact.value?.location || chapter.value?.targetLocation || "")
const clueText = computed(() => chapter.value?.objective || chapter.value?.puzzle?.introText || "")

async function bootstrap() {
  ready.value = false
  const ok = await ensureMissionChapter(routeId.value, chapterId.value)
  if (!ok) {
    ready.value = true
    return
  }

  const interactionType = Number(
    missionStore.currentChapter?.interactionType
    ?? missionStore.currentChapter?.puzzle?.interactionType
    ?? 0,
  )

  // 11 解说不需要扫一扫
  if (interactionType === 11) {
    await router.replace(`/missions/${routeId.value}/chapters/${chapterId.value}/narration`)
    return
  }

  const gate = missionStore.getChapterProgress(chapterId.value)
  if (gate.solved) {
    await router.replace(`/missions/${routeId.value}/map`)
    return
  }
  // 扫一扫成功后自动播片
  if (gate.recognized && !gate.videoWatched) {
    await router.replace(`/missions/${routeId.value}/chapters/${chapterId.value}/video`)
    return
  }
  if (gate.videoWatched && !gate.solved) {
    await router.replace(`/missions/${routeId.value}/chapters/${chapterId.value}/puzzle`)
    return
  }

  ready.value = true
}

/** 扫一扫成功后自动进入播片（非 11） */
async function advanceToVideo() {
  missionStore.markChapterRecognized(chapterId.value)
  locked.value = true
  scanStatus.value = "success"
  await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/video`)
}

/** 临时跳过：后端识别接口未定 */
async function skipRecognition() {
  if (scanning.value || locked.value) {
    return
  }
  toastStore.info("已跳过识别", "识别接口待定，先进入观展短片。")
  await advanceToVideo()
}

async function tryLocalPreview(file: File | null) {
  if (!file || scanning.value || locked.value) {
    return
  }

  scanning.value = true
  scanStatus.value = "scanning"
  previewUrl.value = URL.createObjectURL(file)
  // 仅本地预览反馈，不调用 mock 识物；正式识物待后端公开接口
  await new Promise((resolve) => window.setTimeout(resolve, 900))
  scanning.value = false
  scanStatus.value = "success"
  toastStore.info("已选择照片", "识别接口待定，将跳过识别进入短片。")
  await advanceToVideo()
}

onMounted(() => {
  void bootstrap()
})
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="ready && chapter" class="overflow-hidden border-border/50 bg-[#0c0d10]/p-0">
      <div class="space-y-4 p-4">
        <FindScanRenderer
          :title="exhibitLabel"
          :location="placeLabel"
          :clue-text="clueText"
          :preview-url="previewUrl"
          :status="scanStatus"
          :disabled="scanning || locked"
          allow-skip
          @skip="skipRecognition"
          @file-selected="tryLocalPreview" />

        <ClientButton
          variant="outline"
          class="w-full"
          @click="router.push(`/missions/${routeId}/chapters/${chapterId}/brief`)">
          返回线索
        </ClientButton>
      </div>
    </ClientCard>

    <ClientCard v-else-if="!ready || missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <ClientSkeleton class="h-6 w-24" />
        <ClientSkeleton class="h-10 w-2/3" />
        <ClientSkeleton class="h-64 w-full" />
        <ClientSkeleton class="h-10 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="当前站点不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '请回到路线重新进入。'"
      action-text="返回路线"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>
