<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ClientButton, ClientEmptyState } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()

const routeId = computed(() => String(route.params.routeId || ""))
const result = computed(() => missionStore.activeSession?.latestChapterResult || null)
const cancelled = shallowRef(false)
let timer: ReturnType<typeof setTimeout> | null = null

async function backToMap() {
  if (cancelled.value) {
    return
  }
  cancelled.value = true

  const finalChapter = Boolean(result.value?.finalChapter || missionStore.activeSession?.status === "completed")
  missionStore.advanceFromChapterResult()

  if (finalChapter) {
    await router.push(`/missions/${routeId.value}/finale`)
    return
  }

  // 对齐 demo：完成一站后回到路线，不自动开下一站
  await router.push(`/missions/${routeId.value}/map`)
}

onMounted(() => {
  if (!result.value) {
    return
  }

  timer = setTimeout(() => {
    void backToMap()
  }, 1800)
})

onUnmounted(() => {
  cancelled.value = true
  if (timer) {
    clearTimeout(timer)
  }
})
</script>

<template>
  <div class="client-surface">
    <section v-if="result" class="space-y-5 pt-4 text-center">
      <div class="space-y-3">
        <div class="inline-flex w-fit items-center justify-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
          本站完成
        </div>
        <h2 class="font-display text-3xl leading-tight text-foreground">{{ result.chapterTitle }}</h2>
        <p v-if="result.narrative" class="client-page-copy">{{ result.narrative }}</p>
        <p class="text-sm text-muted-foreground">
          一会儿回路线…
        </p>
      </div>

      <ClientButton class="w-full" @click="backToMap()">回路线</ClientButton>
    </section>

    <ClientEmptyState
      v-else
      title="还没有章节结果"
      description="请先完成当前章节作答。"
      action-text="返回路线"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>
