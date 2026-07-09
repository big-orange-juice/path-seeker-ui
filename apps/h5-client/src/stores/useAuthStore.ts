import { computed, ref, watch } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import {
  fetchAppUserProfile,
  guestLoginAppUser,
  loginAppUser,
  refreshAppUserToken,
  registerAppUser,
  updateAppUserProfile,
  type LoginResponse,
  type RegisterRequest,
  type UpdateProfileRequest,
  type UserProfileResponse,
} from "@/services/auth"
import { clearAccessToken, setAccessToken } from "@/services/authSession"
import { resolveRequestErrorMessage } from "@/services/http"

export const AUTH_PERSIST_KEY = "path-seeker:h5-client:auth"

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim()
}

function resolveExpiresAt(expiresIn?: number) {
  if (!expiresIn) {
    return null
  }

  return Date.now() + expiresIn * 1000
}

function profileFromLogin(response: LoginResponse): UserProfileResponse | null {
  if (!response.userId) {
    return null
  }

  return {
    id: response.userId,
    userNo: response.userNo ?? null,
    nickname: response.nickname ?? null,
    avatarUrl: response.avatarUrl ?? null,
    preferredLang: response.preferredLang ?? null,
    registerChannel: response.isGuest ? 5 : undefined,
  }
}

function syncAccessTokenSession(token: string) {
  if (token) {
    setAccessToken(token)
    return
  }

  clearAccessToken()
}

export const useAuthStore = defineStore(
  "auth",
  () => {
    const accessToken = ref("")
    const refreshToken = ref("")
    const expiresAt = ref<number | null>(null)
    const profile = ref<UserProfileResponse | null>(null)
    const pending = ref(false)
    const error = ref("")

    const isLoggedIn = computed(() => Boolean(accessToken.value))
    const isTokenExpired = computed(() => Boolean(expiresAt.value && expiresAt.value <= Date.now()))
    const displayName = computed(() => profile.value?.nickname || profile.value?.username || profile.value?.userNo || "未登录")

    watch(
      accessToken,
      (value) => {
        syncAccessTokenSession(value)
      },
      { immediate: true, flush: "sync" },
    )

    function applyLoginResponse(response: LoginResponse) {
      accessToken.value = normalizeText(response.accessToken)
      refreshToken.value = normalizeText(response.refreshToken)
      expiresAt.value = resolveExpiresAt(response.expiresIn)
      profile.value = profileFromLogin(response)
      syncAccessTokenSession(accessToken.value)
    }

    async function login(account: string, password: string) {
      pending.value = true
      error.value = ""

      try {
        const response = await loginAppUser({
          account: normalizeText(account),
          password,
        })
        applyLoginResponse(response)
        return response
      } catch (loginError) {
        error.value = resolveRequestErrorMessage(loginError, "登录失败")
        return null
      } finally {
        pending.value = false
      }
    }

    async function register(payload: Omit<RegisterRequest, "platform" | "device">) {
      pending.value = true
      error.value = ""

      try {
        const response = await registerAppUser({
          username: normalizeText(payload.username) || null,
          phone: normalizeText(payload.phone) || null,
          email: normalizeText(payload.email) || null,
          password: payload.password,
          nickname: normalizeText(payload.nickname) || null,
          preferredLang: normalizeText(payload.preferredLang) || "zh-CN",
        })
        applyLoginResponse(response)
        return response
      } catch (registerError) {
        error.value = resolveRequestErrorMessage(registerError, "注册失败")
        return null
      } finally {
        pending.value = false
      }
    }

    async function loginAsGuest() {
      pending.value = true
      error.value = ""

      try {
        const response = await guestLoginAppUser()
        applyLoginResponse(response)
        return response
      } catch (guestError) {
        error.value = resolveRequestErrorMessage(guestError, "游客登录失败")
        return null
      } finally {
        pending.value = false
      }
    }

    async function refreshTokenIfNeeded(force = false) {
      if (!refreshToken.value) {
        return null
      }

      if (!force && !isTokenExpired.value) {
        return null
      }

      pending.value = true
      error.value = ""

      try {
        const response = await refreshAppUserToken(refreshToken.value)
        applyLoginResponse(response)
        return response
      } catch (refreshError) {
        error.value = resolveRequestErrorMessage(refreshError, "登录状态已过期")
        logout()
        return null
      } finally {
        pending.value = false
      }
    }

    async function loadProfile() {
      if (!accessToken.value) {
        return null
      }

      pending.value = true
      error.value = ""

      try {
        profile.value = await fetchAppUserProfile()
        return profile.value
      } catch (profileError) {
        error.value = resolveRequestErrorMessage(profileError, "用户资料加载失败")
        return null
      } finally {
        pending.value = false
      }
    }

    async function updateProfile(payload: UpdateProfileRequest) {
      pending.value = true
      error.value = ""

      try {
        profile.value = await updateAppUserProfile(payload)
        return profile.value
      } catch (profileError) {
        error.value = resolveRequestErrorMessage(profileError, "用户资料更新失败")
        return null
      } finally {
        pending.value = false
      }
    }

    function logout() {
      accessToken.value = ""
      refreshToken.value = ""
      expiresAt.value = null
      profile.value = null
      error.value = ""
      syncAccessTokenSession("")
    }

    return {
      accessToken,
      refreshToken,
      expiresAt,
      profile,
      pending,
      error,
      isLoggedIn,
      isTokenExpired,
      displayName,
      login,
      register,
      loginAsGuest,
      refreshTokenIfNeeded,
      loadProfile,
      updateProfile,
      logout,
    }
  },
  {
    persist: {
      key: AUTH_PERSIST_KEY,
      pick: ["accessToken", "refreshToken", "expiresAt", "profile"],
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
