<script setup lang="ts">
import { computed, reactive, shallowRef } from "vue"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useAuthStore } from "@/stores/useAuthStore"
import { MINI_ROUTES } from "@/utils/navigation"

type AuthMode = "login" | "register"

const authStore = useAuthStore()
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

function backHome() {
  uni.reLaunch({ url: MINI_ROUTES.home })
}

async function submitLogin() {
  if (!canSubmitLogin.value) {
    return
  }

  const result = await authStore.login(loginForm.account, loginForm.password)
  if (result) {
    backHome()
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
    backHome()
  }
}

async function submitGuestLogin() {
  const result = await authStore.loginAsGuest()
  if (result) {
    backHome()
  }
}

function logout() {
  authStore.logout()
}
</script>

<template>
  <PageScaffold title="我的" :show-back="false">
    <view class="content-stack auth-stack">
      <view v-if="authStore.isLoggedIn" class="auth-card">
        <text class="eyebrow">当前账号</text>
        <text class="display-title auth-title">{{ authStore.displayName }}</text>
        <text class="muted-copy">登录状态已保存，后续接口会自动携带访问令牌。</text>
        <view class="button-row auth-actions">
          <button class="secondary-button" @click="backHome">回首页</button>
          <button class="ghost-button" @click="logout">退出登录</button>
        </view>
      </view>

      <template v-else>
        <view class="auth-card">
          <view class="mode-tabs">
            <button class="mode-tab" :class="{ 'is-active': mode === 'login' }" @click="mode = 'login'">登录</button>
            <button class="mode-tab" :class="{ 'is-active': mode === 'register' }" @click="mode = 'register'">注册</button>
          </view>

          <view v-if="mode === 'login'" class="form-stack">
            <view class="field">
              <text class="field-label">账号</text>
              <input v-model="loginForm.account" class="field-input" placeholder="用户名 / 手机号 / 邮箱" />
            </view>
            <view class="field">
              <text class="field-label">密码</text>
              <input v-model="loginForm.password" class="field-input" password placeholder="请输入密码" />
            </view>
            <button class="primary-button" :disabled="!canSubmitLogin || authStore.pending" @click="submitLogin">
              {{ authStore.pending ? "登录中..." : "登录" }}
            </button>
          </view>

          <view v-else class="form-stack">
            <view class="field">
              <text class="field-label">用户名</text>
              <input v-model="registerForm.username" class="field-input" placeholder="用户名、手机号、邮箱至少填一项" />
            </view>
            <view class="field-grid">
              <view class="field">
                <text class="field-label">手机号</text>
                <input v-model="registerForm.phone" class="field-input" placeholder="可选" />
              </view>
              <view class="field">
                <text class="field-label">邮箱</text>
                <input v-model="registerForm.email" class="field-input" placeholder="可选" />
              </view>
            </view>
            <view class="field">
              <text class="field-label">昵称</text>
              <input v-model="registerForm.nickname" class="field-input" placeholder="可选" />
            </view>
            <view class="field">
              <text class="field-label">密码</text>
              <input v-model="registerForm.password" class="field-input" password placeholder="至少 6 位" />
            </view>
            <button class="primary-button" :disabled="!canSubmitRegister || authStore.pending" @click="submitRegister">
              {{ authStore.pending ? "注册中..." : "注册并登录" }}
            </button>
          </view>
        </view>

        <view class="panel guest-panel">
          <text class="section-title">临时体验</text>
          <text class="muted-copy">不创建账号，直接以游客身份进入任务。</text>
          <button class="secondary-button" :disabled="authStore.pending" @click="submitGuestLogin">游客登录</button>
        </view>
      </template>

      <view v-if="authStore.error" class="panel error-panel">
        <text class="muted-copy">{{ authStore.error }}</text>
      </view>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.auth-stack {
  padding-top: 20rpx;
}

.auth-card {
  display: flex;
  flex-direction: column;
  gap: 26rpx;
  padding: 30rpx;
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 34rpx;
  background:
    radial-gradient(circle at 88% 8%, rgba(209, 178, 111, 0.22), transparent 30%),
    linear-gradient(180deg, rgba(35, 32, 27, 0.98), rgba(15, 17, 21, 0.98));
}

.auth-title {
  display: block;
  margin-top: 8rpx;
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  padding: 8rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.05);
}

.mode-tab {
  min-height: 68rpx;
  border-radius: 999rpx;
  color: rgba(247, 239, 221, 0.62);
  font-size: 28rpx;
  font-weight: 900;
}

.mode-tab.is-active {
  background: rgba(209, 178, 111, 0.18) !important;
  color: #fff8ea;
}

.form-stack,
.guest-panel,
.error-panel {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.field-label {
  color: rgba(247, 239, 221, 0.62);
  font-size: 22rpx;
  font-weight: 900;
}

.field-input {
  width: 100%;
  min-height: 84rpx;
  padding: 0 22rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.055);
  color: #fff8ea;
  font-size: 28rpx;
  font-weight: 800;
}

.guest-panel,
.error-panel {
  padding: 26rpx;
}

.auth-actions {
  margin-top: 6rpx;
}
</style>
