<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { UiButton, UiCard } from "@path-seeker/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { toSingleSentence } from "@/utils/copy"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()

const routeId = computed(() => String(route.params.routeId || ""))
const resultCopy = computed(() => toSingleSentence(missionStore.activeSession?.latestChapterResult?.narrative || ""))

async function continueFlow() {
  missionStore.advanceFromChapterResult()
  await router.push(`/missions/${routeId.value}/map`)
}
</script>

<template>
  <div class="space-y-4">
    <UiCard v-if="missionStore.activeSession?.latestChapterResult" class="client-panel overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-3">
          <div class="inline-flex w-fit items-center justify-center rounded-full bg-primary/14 px-3 py-1 text-sm font-semibold text-primary">
            +{{ missionStore.activeSession.latestChapterResult.gainedScore }} 分
          </div>
          <div class="space-y-2">
            <h2 class="font-display text-3xl leading-tight text-foreground">
              {{ missionStore.activeSession.latestChapterResult.chapterTitle }}
            </h2>
            <p v-if="resultCopy" class="client-page-copy">{{ resultCopy }}</p>
          </div>
        </div>

        <UiButton class="w-full" @click="continueFlow()">继续任务</UiButton>
      </div>
    </UiCard>

    <UiCard v-else class="client-panel">
      <div class="space-y-4 p-5">
        <div class="space-y-2">
          <h2 class="text-2xl font-display text-foreground">还没有章节结果</h2>
          <p class="client-page-copy">请先完成当前章节作答。</p>
        </div>

        <UiButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">返回章节地图</UiButton>
      </div>
    </UiCard>
  </div>
</template>
