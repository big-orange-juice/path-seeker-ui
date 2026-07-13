<script setup lang="ts">
import { computed, onMounted, shallowRef, useTemplateRef } from "vue"
import { useRoute, useRouter } from "vue-router"
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
const fileInputRef = useTemplateRef<HTMLInputElement>("fileInput")

const chapter = computed(() => missionStore.currentChapter)
const artifact = computed(() => missionStore.currentArtifact)

const exhibitLabel = computed(() => artifact.value?.title || chapter.value?.title || "展品")
const placeLabel = computed(() => artifact.value?.location || chapter.value?.targetLocation || "")

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

async function advanceToVideo() {
  missionStore.markChapterRecognized(chapterId.value)
  locked.value = true
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
  // 仅本地预览反馈，不调用 mock 识物；正式识物待后端公开接口
  await new Promise((resolve) => window.setTimeout(resolve, 600))
  scanning.value = false
  toastStore.info("已选择照片", "识别接口待定，将跳过识别进入短片。")
  await advanceToVideo()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  void tryLocalPreview(file)
  input.value = ""
}

onMounted(() => {
  void bootstrap()
})
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="ready && chapter" class="overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">找一找</p>
          <h2 class="font-display text-2xl leading-tight text-foreground">{{ exhibitLabel }}</h2>
          <p v-if="placeLabel" class="text-sm text-muted-foreground">{{ placeLabel }}</p>
        </div>

        <div
          class="relative flex aspect-[4/5] flex-col items-center justify-center overflow-hidden rounded-[1.25rem] border border-primary/25 bg-black/40"
          :class="locked ? 'border-primary/60' : scanning ? 'border-primary/40' : ''"
        >
          <div class="absolute inset-6 rounded-[1rem] border border-dashed border-primary/35" />
          <div class="relative z-10 space-y-2 px-6 text-center">
            <p class="text-sm font-semibold text-foreground">
              {{ locked ? "已锁定" : scanning ? "处理中…" : "把展品放进框里" }}
            </p>
            <p class="text-xs leading-5 text-muted-foreground">
              拍照识别接口待定，可先跳过识别继续流程
            </p>
          </div>
        </div>

        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="onFileChange"
        >

        <div class="grid grid-cols-2 gap-3">
          <ClientButton variant="outline" class="w-full" :disabled="scanning || locked" @click="fileInputRef?.click()">
            拍照
          </ClientButton>
          <ClientButton class="w-full" :disabled="scanning || locked" @click="skipRecognition()">
            跳过识别
          </ClientButton>
        </div>

        <ClientButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/chapters/${chapterId}/brief`)">
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
