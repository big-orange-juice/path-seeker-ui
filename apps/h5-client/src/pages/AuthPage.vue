<script setup lang="ts">
import { computed, reactive, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { UiButton, UiCard, UiInput } from "@path-seeker/ui"
import { useAuthStore } from "@/stores/useAuthStore"

type AuthMode = "login" | "register"

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const mode = shallowRef<AuthMode>("login")

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
    await backHome()
  }
}

async function submitGuestLogin() {
  const result = await authStore.loginAsGuest()
  if (result) {
    await backHome()
  }
}

function logout() {
  authStore.logout()
}
</script>

<template>
  <div class="client-shell">
    <div class="client-frame">
      <header class="mb-6 flex items-start justify-between gap-4">
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Path Seeker H5</p>
          <h1 class="client-page-title">登录与注册</h1>
        </div>
        <div class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Auth
        </div>
      </header>

      <main class="space-y-4">
        <UiCard v-if="authStore.isLoggedIn" class="client-panel">
          <div class="space-y-4 p-5">
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-primary">当前账号</p>
              <h2 class="text-2xl font-display text-foreground">{{ authStore.displayName }}</h2>
              <p class="client-page-copy">登录状态已经交给 Pinia 持久化保存，请求会自动携带访问令牌。</p>
            </div>

            <div class="grid gap-3">
              <UiButton class="w-full" @click="backHome()">进入任务大厅</UiButton>
              <UiButton variant="outline" class="w-full" @click="logout()">退出登录</UiButton>
            </div>
          </div>
        </UiCard>

        <template v-else>
          <UiCard class="client-panel">
            <div class="space-y-5 p-5">
              <div class="grid grid-cols-2 gap-2 rounded-full bg-background/70 p-1">
                <button
                  type="button"
                  class="rounded-full px-4 py-2 text-sm font-medium transition-colors"
                  :class="mode === 'login' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
                  @click="mode = 'login'"
                >
                  登录
                </button>
                <button
                  type="button"
                  class="rounded-full px-4 py-2 text-sm font-medium transition-colors"
                  :class="mode === 'register' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
                  @click="mode = 'register'"
                >
                  注册
                </button>
              </div>

              <div v-if="mode === 'login'" class="space-y-3">
                <UiInput v-model="loginForm.account" placeholder="用户名 / 手机号 / 邮箱" />
                <UiInput v-model="loginForm.password" type="password" placeholder="请输入密码" />
                <UiButton class="w-full" :disabled="!canSubmitLogin || authStore.pending" @click="submitLogin()">
                  {{ authStore.pending ? "登录中..." : "登录" }}
                </UiButton>
              </div>

              <div v-else class="space-y-3">
                <UiInput v-model="registerForm.username" placeholder="用户名、手机号、邮箱至少填一项" />
                <div class="grid gap-3 sm:grid-cols-2">
                  <UiInput v-model="registerForm.phone" placeholder="手机号（可选）" />
                  <UiInput v-model="registerForm.email" placeholder="邮箱（可选）" />
                </div>
                <UiInput v-model="registerForm.nickname" placeholder="昵称（可选）" />
                <UiInput v-model="registerForm.password" type="password" placeholder="密码至少 6 位" />
                <UiButton class="w-full" :disabled="!canSubmitRegister || authStore.pending" @click="submitRegister()">
                  {{ authStore.pending ? "注册中..." : "注册并登录" }}
                </UiButton>
              </div>
            </div>
          </UiCard>

          <UiCard class="client-panel">
            <div class="space-y-3 p-5">
              <h2 class="text-lg font-semibold text-foreground">临时体验</h2>
              <p class="client-page-copy">不创建账号，直接以游客身份进入任务。</p>
              <UiButton variant="outline" class="w-full" :disabled="authStore.pending" @click="submitGuestLogin()">
                游客登录
              </UiButton>
            </div>
          </UiCard>
        </template>

        <UiCard v-if="authStore.error" class="client-panel">
          <div class="p-5 text-sm leading-6 text-destructive">{{ authStore.error }}</div>
        </UiCard>
      </main>
    </div>
  </div>
</template>
