<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientCard, ClientEmptyState } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))
const resultCopy = computed(() => missionStore.activeSession?.latestChapterResult?.narrative || "")

async function continueFlow() {
  missionStore.advanceFromChapterResult()
  toastStore.success("章节已收录", "继续前往下一站。")
  await router.push(`/missions/${routeId.value}/map`)
}
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="missionStore.activeSession?.latestChapterResult" class="overflow-hidden">
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

        <ClientButton class="w-full" @click="continueFlow()">继续任务</ClientButton>
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="还没有章节结果"
      description="请先完成当前章节作答。"
      action-text="返回章节地图"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>
