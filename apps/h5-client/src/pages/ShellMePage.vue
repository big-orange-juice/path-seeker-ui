<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRouter } from "vue-router"
import { LogOut, User } from "lucide-vue-next"
import PostcardHistory from '@/components/postcards/PostcardHistory.vue'
import { useAuthStore } from "@/stores/useAuthStore"
import { useMissionStore } from "@/stores/useMissionStore"

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

const stats = computed(() => [
  { label: "进行中", value: playing.value.length },
  { label: "已完成", value: completed.value.length },
])

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
        @click="isGuest ? router.push({ path: '/auth', query: { redirect: '/shell/me' } }) : handleLogout()"
      >
        <LogOut v-if="!isGuest" class="mr-1 inline h-3 w-3" />
        {{ isGuest ? "绑定账号" : "退出" }}
      </button>
    </section>

    <PostcardHistory />
    <section class="grid grid-cols-2 gap-2">
      <div v-for="item in stats" :key="item.label" class="client-stat-cell">
        <p class="font-display text-lg leading-none">
          {{ item.value }}
        </p>
        <p class="mt-1 text-[0.7rem] text-muted-foreground">
          {{ item.label }}
        </p>
      </div>
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
  border: 1px solid #d4e0d9;
  border-radius: 999px;
  background: #edf5ef;
}
</style>
