<script setup lang="ts">
import { computed, reactive, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import {
  ClientButton,
  ClientCard,
  ClientEmptyState,
  ClientInput,
  ClientTabs,
  ClientTabsContent,
  ClientTabsList,
  ClientTabsTrigger,
} from "@/components/ui"
import { useAuthStore } from "@/stores/useAuthStore"

type AuthMode = "login" | "register"

const authStore = useAuthStore()
const toastStore = useToastStore()
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
    toastStore.success("登录成功", "欢迎回来，任务进度已经恢复到当前设备。")
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
    toastStore.success("注册成功", "账号已创建，并已自动登录。")
    await backHome()
  }
}

async function submitGuestLogin() {
  const result = await authStore.loginAsGuest()
  if (result) {
    toastStore.success("已进入游客模式", "你可以先体验完整任务流，之后再决定是否注册。")
    await backHome()
  }
}

function logout() {
  authStore.logout()
  toastStore.info("已退出登录", "当前设备上的登录状态已经清空。")
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
        <ClientCard v-if="authStore.isLoggedIn">
          <div class="space-y-4 p-5">
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-primary">当前账号</p>
              <h2 class="text-2xl font-display text-foreground">{{ authStore.displayName }}</h2>
              <p class="client-page-copy">登录状态已经交给 Pinia 持久化保存，请求会自动携带访问令牌。</p>
            </div>

            <div class="grid gap-3">
              <ClientButton class="w-full" @click="backHome()">进入任务大厅</ClientButton>
              <ClientButton variant="outline" class="w-full" @click="logout()">退出登录</ClientButton>
            </div>
          </div>
        </ClientCard>

        <template v-else>
          <ClientCard>
            <div class="space-y-5 p-5">
              <ClientTabs v-model="mode" class="w-full">
                <ClientTabsList>
                  <ClientTabsTrigger value="login">登录</ClientTabsTrigger>
                  <ClientTabsTrigger value="register">注册</ClientTabsTrigger>
                </ClientTabsList>

                <ClientTabsContent value="login" class="space-y-3">
                  <ClientInput v-model="loginForm.account" placeholder="用户名 / 手机号 / 邮箱" />
                  <ClientInput v-model="loginForm.password" type="password" placeholder="请输入密码" />
                  <ClientButton class="w-full" :disabled="!canSubmitLogin || authStore.pending" @click="submitLogin()">
                    {{ authStore.pending ? "登录中..." : "登录" }}
                  </ClientButton>
                </ClientTabsContent>

                <ClientTabsContent value="register" class="space-y-3">
                  <ClientInput v-model="registerForm.username" placeholder="用户名、手机号、邮箱至少填一项" />
                  <div class="grid gap-3 sm:grid-cols-2">
                    <ClientInput v-model="registerForm.phone" placeholder="手机号（可选）" />
                    <ClientInput v-model="registerForm.email" placeholder="邮箱（可选）" />
                  </div>
                  <ClientInput v-model="registerForm.nickname" placeholder="昵称（可选）" />
                  <ClientInput v-model="registerForm.password" type="password" placeholder="密码至少 6 位" />
                  <ClientButton class="w-full" :disabled="!canSubmitRegister || authStore.pending" @click="submitRegister()">
                    {{ authStore.pending ? "注册中..." : "注册并登录" }}
                  </ClientButton>
                </ClientTabsContent>
              </ClientTabs>
            </div>
          </ClientCard>

          <ClientCard>
            <div class="space-y-3 p-5">
              <h2 class="text-lg font-semibold text-foreground">临时体验</h2>
              <p class="client-page-copy">不创建账号，直接以游客身份进入任务。</p>
              <ClientButton variant="outline" class="w-full" :disabled="authStore.pending" @click="submitGuestLogin()">
                游客登录
              </ClientButton>
            </div>
          </ClientCard>
        </template>

        <ClientEmptyState
          v-if="authStore.error"
          title="认证请求失败"
          :description="authStore.error"
        />
      </main>
    </div>
  </div>
</template>
