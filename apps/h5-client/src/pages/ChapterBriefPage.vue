<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionChapterReady } from "@/composables/useMissionChapterReady"

const route = useRoute()
const router = useRouter()
const { missionStore, ensureMissionChapter } = useMissionChapterReady()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))
const ready = shallowRef(false)

const chapter = computed(() => missionStore.currentChapter)
const artifact = computed(() => missionStore.currentArtifact)

const riddle = computed(() => {
  return (
    chapter.value?.objective
    || artifact.value?.detailCallout
    || "到展柜前仔细观察，再继续下一步。"
  )
})

const place = computed(() => {
  return chapter.value?.targetLocation || artifact.value?.location || ""
})

const tips = computed(() => {
  if (!artifact.value) {
    return [] as string[]
  }

  const fromChecklist = artifact.value.checklist.filter(Boolean).slice(0, 3)
  if (fromChecklist.length) {
    return fromChecklist
  }

  return [artifact.value.observationPoint, artifact.value.detailCallout].filter(Boolean) as string[]
})

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

  // 11 解说：不需要扫一扫 / 播片
  if (interactionType === 11) {
    await router.replace(`/missions/${routeId.value}/chapters/${chapterId.value}/narration`)
    return
  }

  const gate = missionStore.getChapterProgress(chapterId.value)
  if (gate.solved) {
    await router.replace(`/missions/${routeId.value}/map`)
    return
  }
  if (gate.videoWatched) {
    await router.replace(`/missions/${routeId.value}/chapters/${chapterId.value}/puzzle`)
    return
  }
  // 扫一扫成功后自动播片
  if (gate.recognized) {
    await router.replace(`/missions/${routeId.value}/chapters/${chapterId.value}/video`)
    return
  }

  ready.value = true
}

async function goScan() {
  await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/clue`)
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
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            第 {{ chapter.stageNo }} 站 · 线索
          </p>
          <h2 class="font-display text-3xl leading-tight text-foreground">{{ chapter.title }}</h2>
          <p class="client-page-copy">{{ riddle }}</p>
        </div>

        <div v-if="place" class="flex items-start gap-3 rounded-[1rem] bg-background/70 p-4">
          <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
          <div class="min-w-0">
            <p class="text-xs text-muted-foreground">位置</p>
            <p class="mt-1 text-sm font-medium text-foreground">{{ place }}</p>
          </div>
        </div>

        <div v-if="tips.length" class="space-y-3">
          <p class="text-sm font-semibold text-foreground">观察提示</p>
          <div
            v-for="(tip, index) in tips"
            :key="`${index}-${tip}`"
            class="flex gap-3 rounded-[1rem] bg-background/70 p-4 text-sm leading-6 text-muted-foreground"
          >
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {{ index + 1 }}
            </span>
            <p>{{ tip }}</p>
          </div>
        </div>

        <div class="grid gap-3">
          <ClientButton class="w-full" @click="goScan()">去找找</ClientButton>
          <ClientButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">
            返回路线
          </ClientButton>
        </div>
      </div>
    </ClientCard>

    <ClientCard v-else-if="!ready || missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <ClientSkeleton class="h-6 w-28" />
        <ClientSkeleton class="h-10 w-2/3" />
        <ClientSkeleton class="h-20 w-full" />
        <ClientSkeleton class="h-10 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="这一站暂时打不开"
      :description="missionStore.gameplayError || missionStore.detailError || '请回到路线重新进入。'"
      action-text="返回路线"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>
