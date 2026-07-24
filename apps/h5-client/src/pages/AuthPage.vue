<script setup lang="ts">
import { computed, reactive, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Sparkles } from "lucide-vue-next"
import { useToastStore } from "@path-seeker/client-state"
import {
  ClientButton,
  ClientEmptyState,
  ClientInput,
} from "@/components/ui"
import { useAuthStore } from "@/stores/useAuthStore"
import { useMissionStore } from "@/stores/useMissionStore"

type AuthMode = "guest" | "login" | "register"

const authStore = useAuthStore()
const missionStore = useMissionStore()
const toastStore = useToastStore()
const route = useRoute()
const router = useRouter()
const mode = shallowRef<AuthMode>("guest")

/** 登录成功后拉列表；有本地会话且无 mission 缓存时再恢复 */
async function afterAuthSuccess() {
  void missionStore.loadRouteCards({ force: true })
  if (missionStore.activeSession && !missionStore.getMission(missionStore.activeSession.routeId)) {
    void missionStore.restoreActiveMission()
  }
}

const loginForm = reactive({
  account: "",
  password: "",
})

const registerForm = reactive({
  username: "",
  phone: "",
  email: "",
  nickname: "",
  password: "",
})

const canSubmitLogin = computed(() => Boolean(loginForm.account.trim() && loginForm.password.trim()))
const canSubmitRegister = computed(() => {
  const hasAccount = Boolean(registerForm.username.trim() || registerForm.phone.trim() || registerForm.email.trim())
  return hasAccount && registerForm.password.trim().length >= 6
})

const redirectPath = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === "string" && redirect.startsWith("/") ? redirect : "/shell/hall"
})

async function backHome() {
  await router.replace(redirectPath.value)
}

async function submitLogin() {
  if (!canSubmitLogin.value) {
    return
  }

  const result = await authStore.login(loginForm.account, loginForm.password)
  if (result) {
    toastStore.success("欢迎回来", "任务进度已恢复到当前设备。")
    await afterAuthSuccess()
    await backHome()
  }
}

async function submitRegister() {
  if (!canSubmitRegister.value) {
    return
  }

  const result = await authStore.register({
    username: registerForm.username,
    phone: registerForm.phone,
    email: registerForm.email,
    nickname: registerForm.nickname,
    password: registerForm.password,
    preferredLang: "zh-CN",
  })

  if (result) {
    toastStore.success("账号已创建", "已自动登录，可以开始探索。")
    await afterAuthSuccess()
    await backHome()
  }
}

async function submitGuestLogin() {
  const result = await authStore.loginAsGuest()
  if (result) {
    toastStore.success("出发！", "游客模式已就绪。")
    await afterAuthSuccess()
    await backHome()
  }
}

function logout() {
  authStore.logout()
  toastStore.info("已退出", "当前设备登录状态已清空。")
}
</script>

<template>
  <div class="client-shell">
    <div class="client-frame">
      <header class="mb-5 flex items-start justify-between gap-4">
        <div class="space-y-1.5">
          <p class="client-top-kicker">Path Seeker</p>
          <h1 class="client-page-title">{{ authStore.isLoggedIn ? "我的" : "开始探索" }}</h1>
        </div>
      </header>

      <main class="client-surface">
        <!-- 已登录 -->
        <section v-if="authStore.isLoggedIn" class="space-y-5 pt-2 text-center">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-[1rem] border border-primary/30 bg-primary/10 text-primary">
            <Sparkles class="h-6 w-6" />
          </div>
          <div class="space-y-1">
            <h2 class="font-display text-2xl text-foreground">{{ authStore.displayName }}</h2>
            <p class="client-page-copy">本机账号 · 进度已同步</p>
          </div>
          <div class="grid gap-3">
            <ClientButton class="w-full" @click="backHome()">进入展厅</ClientButton>
            <ClientButton variant="outline" class="w-full" @click="logout()">退出</ClientButton>
          </div>
        </section>

        <template v-else>
          <!-- 印章门页 -->
          <section class="auth-gate" aria-hidden="false">
            <div class="auth-seal-ring" aria-hidden="true" />
            <div class="auth-seal" aria-hidden="true">
              <Sparkles class="h-5 w-5" />
            </div>
            <div class="relative z-[1] space-y-2">
              <span class="client-tag is-gold">馆内解谜</span>
              <h2 class="font-display text-[1.7rem] leading-tight text-foreground">
                找到展品<br />解开谜题
              </h2>
              <p class="text-sm text-muted-foreground">扫一扫 · 看短片 · 闯关</p>
            </div>
          </section>

          <section class="space-y-4 pt-1">
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="auth-mode-chip"
                :class="{ 'is-active': mode === 'guest' }"
                @click="mode = 'guest'"
              >
                游客
              </button>
              <button
                type="button"
                class="auth-mode-chip"
                :class="{ 'is-active': mode === 'login' }"
                @click="mode = 'login'"
              >
                账号
              </button>
              <button
                type="button"
                class="auth-mode-chip"
                :class="{ 'is-active': mode === 'register' }"
                @click="mode = 'register'"
              >
                注册
              </button>
            </div>

            <div v-if="mode === 'guest'" class="space-y-3">
              <p class="client-page-copy">不创建账号，直接体验完整任务流。</p>
              <ClientButton class="w-full" :disabled="authStore.pending" @click="submitGuestLogin()">
                {{ authStore.pending ? "进入中..." : "开始探索" }}
              </ClientButton>
            </div>

            <div v-else-if="mode === 'login'" class="space-y-3">
              <ClientInput v-model="loginForm.account" placeholder="用户名 / 手机号 / 邮箱" autocomplete="username" />
              <ClientInput
                v-model="loginForm.password"
                type="password"
                placeholder="请输入密码"
                autocomplete="current-password"
              />
              <ClientButton
                class="w-full"
                :disabled="!canSubmitLogin || authStore.pending"
                @click="submitLogin()"
              >
                {{ authStore.pending ? "登录中..." : "进入" }}
              </ClientButton>
            </div>

            <div v-else class="space-y-3">
              <ClientInput v-model="registerForm.username" placeholder="用户名、手机号、邮箱至少填一项" />
              <div class="grid gap-3 sm:grid-cols-2">
                <ClientInput v-model="registerForm.phone" placeholder="手机号（可选）" />
                <ClientInput v-model="registerForm.email" placeholder="邮箱（可选）" />
              </div>
              <ClientInput v-model="registerForm.nickname" placeholder="昵称（可选）" />
              <ClientInput v-model="registerForm.password" type="password" placeholder="密码至少 6 位" />
              <ClientButton
                class="w-full"
                :disabled="!canSubmitRegister || authStore.pending"
                @click="submitRegister()"
              >
                {{ authStore.pending ? "注册中..." : "注册并进入" }}
              </ClientButton>
            </div>
          </section>
        </template>

        <ClientEmptyState
          v-if="authStore.error"
          title="认证失败"
          :description="authStore.error"
        />
      </main>
    </div>
  </div>
</template>
