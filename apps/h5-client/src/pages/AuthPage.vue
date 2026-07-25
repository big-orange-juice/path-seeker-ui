<script setup lang="ts">
import { computed, reactive, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
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

/** 登录成功后拉展厅列表；游玩历史/进行中走服务端接口 */
async function afterAuthSuccess() {
  void missionStore.loadRouteCards({ force: true })
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

const modeHint = computed(() => {
  if (mode.value === "guest") return "无需注册，以游客身份浏览展厅路线。"
  if (mode.value === "login") return "使用已有账号登录，进度将同步到本机。"
  return "创建账号后可在多设备间同步进度。"
})

const primaryActionLabel = computed(() => {
  if (authStore.pending) {
    if (mode.value === "login") return "登录中…"
    if (mode.value === "register") return "注册中…"
    return "进入中…"
  }
  if (mode.value === "login") return "登录"
  if (mode.value === "register") return "注册"
  return "以游客进入"
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
    toastStore.success("登录成功", "进度已同步到本机。")
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
    toastStore.success("注册成功", "账号已创建并登录。")
    await afterAuthSuccess()
    await backHome()
  }
}

async function submitGuestLogin() {
  const result = await authStore.loginAsGuest()
  if (result) {
    toastStore.success("已进入", "当前为游客身份。")
    await afterAuthSuccess()
    await backHome()
  }
}

async function submitCurrentMode() {
  if (mode.value === "guest") {
    await submitGuestLogin()
    return
  }
  if (mode.value === "login") {
    await submitLogin()
    return
  }
  await submitRegister()
}

const canSubmitCurrent = computed(() => {
  if (authStore.pending) return false
  if (mode.value === "guest") return true
  if (mode.value === "login") return canSubmitLogin.value
  return canSubmitRegister.value
})

function logout() {
  authStore.logout()
  toastStore.info("已退出", "本机登录状态已清除。")
}
</script>

<template>
  <div class="client-shell">
    <div class="client-frame">
      <header class="auth-header">
        <p class="client-top-kicker">Path Seeker</p>
        <h1 class="client-page-title">
          {{ authStore.isLoggedIn ? "账号" : "登录" }}
        </h1>
      </header>

      <main class="auth-page">
        <!-- 已登录：简洁账号面 -->
        <section v-if="authStore.isLoggedIn" class="auth-session">
          <div class="auth-session-meta">
            <p class="auth-session-label">当前账号</p>
            <h2 class="auth-session-name font-display">{{ authStore.displayName }}</h2>
            <p class="auth-session-note">进度已同步到本机</p>
          </div>

          <div class="auth-actions">
            <ClientButton class="w-full" @click="backHome()">进入展厅</ClientButton>
            <ClientButton variant="outline" class="w-full" @click="logout()">退出登录</ClientButton>
          </div>
        </section>

        <!-- 未登录：功能优先，无装饰印章 / 无游戏化开场 -->
        <template v-else>
          <section class="auth-intro">
            <p class="auth-lead">选择进入方式，浏览展厅路线与讲解内容。</p>
          </section>

          <section class="auth-panel" aria-label="进入方式">
            <div class="auth-tabs" role="tablist" aria-label="登录方式">
              <button
                type="button"
                role="tab"
                class="auth-tab"
                :class="{ 'is-active': mode === 'guest' }"
                :aria-selected="mode === 'guest'"
                @click="mode = 'guest'"
              >
                游客
              </button>
              <button
                type="button"
                role="tab"
                class="auth-tab"
                :class="{ 'is-active': mode === 'login' }"
                :aria-selected="mode === 'login'"
                @click="mode = 'login'"
              >
                账号登录
              </button>
              <button
                type="button"
                role="tab"
                class="auth-tab"
                :class="{ 'is-active': mode === 'register' }"
                :aria-selected="mode === 'register'"
                @click="mode = 'register'"
              >
                注册
              </button>
            </div>

            <p class="auth-hint">{{ modeHint }}</p>

            <div v-if="mode === 'login'" class="auth-form">
              <ClientInput
                v-model="loginForm.account"
                placeholder="用户名 / 手机号 / 邮箱"
                autocomplete="username"
              />
              <ClientInput
                v-model="loginForm.password"
                type="password"
                placeholder="密码"
                autocomplete="current-password"
              />
            </div>

            <div v-else-if="mode === 'register'" class="auth-form">
              <ClientInput
                v-model="registerForm.username"
                placeholder="用户名、手机号、邮箱至少填一项"
                autocomplete="username"
              />
              <div class="auth-form-row">
                <ClientInput v-model="registerForm.phone" placeholder="手机号（可选）" autocomplete="tel" />
                <ClientInput v-model="registerForm.email" placeholder="邮箱（可选）" autocomplete="email" />
              </div>
              <ClientInput
                v-model="registerForm.nickname"
                placeholder="昵称（可选）"
                autocomplete="nickname"
              />
              <ClientInput
                v-model="registerForm.password"
                type="password"
                placeholder="密码至少 6 位"
                autocomplete="new-password"
              />
            </div>

            <ClientButton
              class="w-full"
              :disabled="!canSubmitCurrent"
              @click="submitCurrentMode()"
            >
              {{ primaryActionLabel }}
            </ClientButton>
          </section>
        </template>

        <ClientEmptyState
          v-if="authStore.error"
          title="无法完成操作"
          :description="authStore.error"
        />
      </main>
    </div>
  </div>
</template>

<style scoped>
.auth-header {
  margin-bottom: 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.auth-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 0;
  flex: 1;
}

.auth-intro {
  padding: 0;
}

.auth-lead {
  margin: 0;
  max-width: 22rem;
  color: rgba(168, 159, 144, 0.95);
  font-size: 0.92rem;
  line-height: 1.65;
}

/* 功能区：细顶线分隔，无卡片底板 */
.auth-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1.15rem;
  border-top: 1px solid rgba(255, 248, 230, 0.08);
}

.auth-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border-bottom: 1px solid rgba(255, 248, 230, 0.08);
}

.auth-tab {
  position: relative;
  margin: 0;
  padding: 0.7rem 0.35rem;
  border: 0;
  background: transparent;
  color: rgba(168, 159, 144, 0.92);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: color 0.16s ease;
}

.auth-tab::after {
  content: "";
  position: absolute;
  left: 18%;
  right: 18%;
  bottom: -1px;
  height: 1.5px;
  border-radius: 999px;
  background: transparent;
  transition: background 0.16s ease;
}

.auth-tab.is-active {
  color: #f0dfb0;
}

.auth-tab.is-active::after {
  background: rgba(209, 178, 111, 0.85);
}

.auth-hint {
  margin: 0;
  color: rgba(168, 159, 144, 0.88);
  font-size: 0.8125rem;
  line-height: 1.55;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.auth-form-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

@media (min-width: 420px) {
  .auth-form-row {
    grid-template-columns: 1fr 1fr;
  }
}

.auth-session {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding-top: 0.35rem;
}

.auth-session-meta {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-bottom: 1.15rem;
  border-bottom: 1px solid rgba(255, 248, 230, 0.08);
}

.auth-session-label {
  margin: 0;
  color: rgba(209, 178, 111, 0.78);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.auth-session-name {
  margin: 0;
  color: #f4ede1;
  font-size: 1.55rem;
  font-weight: 600;
  line-height: 1.25;
}

.auth-session-note {
  margin: 0.15rem 0 0;
  color: rgba(168, 159, 144, 0.92);
  font-size: 0.84rem;
  line-height: 1.5;
}

.auth-actions {
  display: grid;
  gap: 0.75rem;
}
</style>
