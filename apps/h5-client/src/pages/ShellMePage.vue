<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRouter } from "vue-router"
import { ChevronRight, History, LogOut, Play, User } from "lucide-vue-next"
import { ClientSkeleton } from "@/components/ui"
import HistoryRouteCard from "@/components/shell/HistoryRouteCard.vue"
import { useAuthStore } from "@/stores/useAuthStore"
import { useMissionStore } from "@/stores/useMissionStore"

/** 我的页每列表只做概览，超出交给对应完整页 */
const PREVIEW_LIMIT = 2

const router = useRouter()
const authStore = useAuthStore()
const missionStore = useMissionStore()

const profile = computed(() => authStore.profile)
const isGuest = computed(() => Number(profile.value?.registerChannel) === 5)

const nickname = computed(
  () => profile.value?.nickname
    || profile.value?.username
    || profile.value?.userNo
    || (isGuest.value ? "游客" : "探索者"),
)

const avatarUrl = computed(() => String(profile.value?.avatarUrl || "").trim())

const accountLine = computed(() => {
  const parts = [
    profile.value?.userNo ? `No.${profile.value.userNo}` : "",
    isGuest.value ? "游客账号" : "",
  ].filter(Boolean)
  return parts.join(" · ")
})

const playing = computed(() => missionStore.playingHistory)
const completed = computed(() => missionStore.completedHistory)
const playingPreview = computed(() => playing.value.slice(0, PREVIEW_LIMIT))
const completedPreview = computed(() => completed.value.slice(0, PREVIEW_LIMIT))

const stats = computed(() => [
  { label: "进行中", value: playing.value.length },
  { label: "已完成", value: completed.value.length },
  { label: "积分", value: Number(profile.value?.totalPoints ?? 0) },
])

const playingLoading = computed(
  () => missionStore.playingHistoryPending && playing.value.length === 0,
)
const historyLoading = computed(
  () => missionStore.playHistoryPending && completed.value.length === 0,
)

async function refresh() {
  // 两份历史来自不同接口，并行拉取
  await Promise.all([
    missionStore.loadPlayingHistory({ force: true }),
    missionStore.loadPlayHistory({ force: true }),
  ])
}

function handleLogout() {
  if (!window.confirm("确认退出登录？")) {
    return
  }
  authStore.logout()
  void router.replace("/auth")
}

onMounted(() => {
  if (authStore.isLoggedIn && !profile.value?.id) {
    void authStore.loadProfile()
  }
  void refresh()
})
</script>

<template>
  <div class="client-surface">
    <!-- ① 登录人基本信息 -->
    <section class="client-panel flex items-center gap-3 p-4">
      <span class="me-avatar">
        <img v-if="avatarUrl" :src="avatarUrl" alt="" class="h-full w-full object-cover">
        <User v-else class="h-6 w-6 text-primary" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-base font-medium">{{ nickname }}</span>
        <span v-if="accountLine" class="mt-0.5 block truncate text-xs text-muted-foreground">
          {{ accountLine }}
        </span>
      </span>
      <button
        type="button"
        class="client-user-pill shrink-0"
        @click="isGuest ? router.push('/auth') : handleLogout()"
      >
        <LogOut v-if="!isGuest" class="mr-1 inline h-3 w-3" />
        {{ isGuest ? "绑定账号" : "退出" }}
      </button>
    </section>

    <section class="grid grid-cols-3 gap-2">
      <div v-for="item in stats" :key="item.label" class="client-stat-cell">
        <p class="font-display text-lg leading-none">
          {{ item.value }}
        </p>
        <p class="mt-1 text-[0.7rem] text-muted-foreground">
          {{ item.label }}
        </p>
      </div>
    </section>

    <!-- ② 探索：进行中的路线 -->
    <section class="client-surface-block space-y-2.5">
      <button
        type="button"
        class="flex w-full items-center gap-2 text-left"
        @click="router.push('/shell/playing')"
      >
        <Play class="h-4 w-4 text-primary" />
        <span class="flex-1 font-medium">探索</span>
        <span class="text-xs text-muted-foreground">
          {{ playing.length ? `全部 ${playing.length}` : "" }}
        </span>
        <ChevronRight class="h-4 w-4 text-muted-foreground" />
      </button>

      <ClientSkeleton v-if="playingLoading" class="h-20 w-full rounded-[1rem]" />
      <template v-else-if="playingPreview.length">
        <HistoryRouteCard
          v-for="item in playingPreview"
          :key="`p-${item.routeId}-${item.startedAt || ''}`"
          :item="item"
          mode="map"
        />
      </template>
      <p v-else class="text-xs text-muted-foreground">
        暂无进行中的探索，去展厅挑一条路线。
      </p>
    </section>

    <!-- ③ 历史：已完成路线 -->
    <section class="client-surface-block space-y-2.5">
      <button
        type="button"
        class="flex w-full items-center gap-2 text-left"
        @click="router.push('/shell/archive')"
      >
        <History class="h-4 w-4 text-primary" />
        <span class="flex-1 font-medium">探索记录</span>
        <span class="text-xs text-muted-foreground">
          {{ completed.length ? `全部 ${completed.length}` : "" }}
        </span>
        <ChevronRight class="h-4 w-4 text-muted-foreground" />
      </button>

      <ClientSkeleton v-if="historyLoading" class="h-20 w-full rounded-[1rem]" />
      <template v-else-if="completedPreview.length">
        <HistoryRouteCard
          v-for="item in completedPreview"
          :key="`c-${item.routeId}-${item.completedAt || item.startedAt || ''}`"
          :item="item"
          mode="finale"
        />
      </template>
      <p v-else class="text-xs text-muted-foreground">
        还没有完成记录，走完路线后会留在这里。
      </p>
    </section>
  </div>
</template>

<style scoped>
.me-avatar {
  display: flex;
  width: 3rem;
  height: 3rem;
  flex: 0 0 auto;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(209, 178, 111, 0.28);
  border-radius: 999px;
  background: rgba(209, 178, 111, 0.12);
}
</style>
