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
    const sessionExpiredDialogOpen = ref(false)
    const sessionExpiredMessage = ref("未登录或登录已过期，请重新登录")
    let sessionVersion = 0
    let activityVersion = 0
    let guestSessionPromise: Promise<boolean> | null = null
    let accountLoginPromise: Promise<LoginResponse | null> | null = null

    const isLoggedIn = computed(() => Boolean(accessToken.value))
    const isGuest = computed(() => isLoggedIn.value && Number(profile.value?.registerChannel) === 5)
    const isAccountLoggedIn = computed(() => isLoggedIn.value && Boolean(profile.value?.id) && !isGuest.value)
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

    function beginActivity() {
      pending.value = true
      error.value = ""
      return ++activityVersion
    }

    function finishActivity(version: number) {
      if (version === activityVersion) pending.value = false
    }

    function authenticate(action: () => Promise<LoginResponse>, fallback: string, accountLogin: boolean) {
      const current = ++sessionVersion
      const activity = beginActivity()
      guestSessionPromise = null
      accountLoginPromise = null
      const operation = (async () => {
        try {
          const response = await action()
          if (current !== sessionVersion) return null
          applyLoginResponse(response)
          sessionExpiredDialogOpen.value = false
          return response
        } catch (failure) {
          if (current === sessionVersion) error.value = resolveRequestErrorMessage(failure, fallback)
          return null
        } finally {
          finishActivity(activity)
        }
      })()
      if (accountLogin) accountLoginPromise = operation
      return operation.finally(() => {
        if (accountLoginPromise === operation) accountLoginPromise = null
      })
    }

    function login(account: string, password: string) {
      return authenticate(() => loginAppUser({ account: normalizeText(account), password }), "登录失败", true)
    }

    function register(payload: Omit<RegisterRequest, "platform" | "device">) {
      return authenticate(() => registerAppUser({
        username: normalizeText(payload.username) || null,
        phone: normalizeText(payload.phone) || null,
        email: normalizeText(payload.email) || null,
        password: payload.password,
        nickname: normalizeText(payload.nickname) || null,
        preferredLang: normalizeText(payload.preferredLang) || "zh-CN",
      }), "注册失败", true)
    }

    function loginAsGuest() {
      return authenticate(guestLoginAppUser, "游客登录失败", false)
    }

    /**
     * 保证存在可用会话：已有未过期 token 直接放行，过期则先续期，
     * 都没有时静默签发游客身份。返回是否拿到可用会话。
     */
    async function ensureGuestSession() {
      if (accountLoginPromise) {
        await accountLoginPromise
        return isLoggedIn.value && !isTokenExpired.value
      }
      if (isLoggedIn.value && !isTokenExpired.value) {
        return true
      }

      if (guestSessionPromise) {
        return guestSessionPromise
      }

      const current = sessionVersion
      const operation = (async () => {
        if (isLoggedIn.value && refreshToken.value) {
          const refreshed = await refreshTokenIfNeeded(true)
          if (current !== sessionVersion) {
            if (accountLoginPromise) await accountLoginPromise
            return isLoggedIn.value && !isTokenExpired.value
          }
          if (refreshed) {
            return true
          }
        }

        const response = await loginAsGuest()
        if (accountLoginPromise) await accountLoginPromise
        return Boolean(response) || (isLoggedIn.value && !isTokenExpired.value)
      })()
      guestSessionPromise = operation
      try { return await operation }
      finally { if (guestSessionPromise === operation) guestSessionPromise = null }
    }

    async function refreshTokenIfNeeded(force = false) {
      if (!refreshToken.value) {
        return null
      }

      if (!force && !isTokenExpired.value) {
        return null
      }

      const current = sessionVersion
      const token = refreshToken.value
      const activity = beginActivity()

      try {
        const response = await refreshAppUserToken(token)
        if (current !== sessionVersion || token !== refreshToken.value) return null
        applyLoginResponse(response)
        return response
      } catch (refreshError) {
        if (current === sessionVersion && token === refreshToken.value) {
          clearIdentity()
          error.value = resolveRequestErrorMessage(refreshError, "登录状态已过期")
        }
        return null
      } finally {
        finishActivity(activity)
      }
    }

    async function loadProfile() {
      if (!accessToken.value) {
        return null
      }

      const current = sessionVersion
      const token = accessToken.value
      const activity = beginActivity()

      try {
        const result = await fetchAppUserProfile()
        if (current !== sessionVersion || token !== accessToken.value) return null
        profile.value = result
        return profile.value
      } catch (profileError) {
        if (current === sessionVersion && token === accessToken.value) error.value = resolveRequestErrorMessage(profileError, "用户资料加载失败")
        return null
      } finally {
        finishActivity(activity)
      }
    }

    async function updateProfile(payload: UpdateProfileRequest) {
      const current = sessionVersion
      const token = accessToken.value
      const activity = beginActivity()

      try {
        const result = await updateAppUserProfile(payload)
        if (current !== sessionVersion || token !== accessToken.value) return null
        profile.value = result
        return profile.value
      } catch (profileError) {
        if (current === sessionVersion && token === accessToken.value) error.value = resolveRequestErrorMessage(profileError, "用户资料更新失败")
        return null
      } finally {
        finishActivity(activity)
      }
    }

    function logout() {
      sessionVersion++
      activityVersion++
      guestSessionPromise = null
      accountLoginPromise = null
      pending.value = false
      clearIdentity()
    }

    function clearIdentity() {
      accessToken.value = ""
      refreshToken.value = ""
      expiresAt.value = null
      profile.value = null
      error.value = ""
      sessionExpiredDialogOpen.value = false
      sessionExpiredMessage.value = "未登录或登录已过期，请重新登录"
      syncAccessTokenSession("")
    }

    function openSessionExpiredDialog(message?: string | null) {
      // 已弹过则只更新文案，避免并发 401 反复打断
      if (!sessionExpiredDialogOpen.value) {
        sessionExpiredDialogOpen.value = true
      }
      sessionExpiredMessage.value = String(message || "未登录或登录已过期，请重新登录").trim()
    }

    function closeSessionExpiredDialog() {
      sessionExpiredDialogOpen.value = false
    }

    return {
      accessToken,
      refreshToken,
      expiresAt,
      profile,
      pending,
      error,
      sessionExpiredDialogOpen,
      sessionExpiredMessage,
      isLoggedIn,
      isGuest,
      isAccountLoggedIn,
      isTokenExpired,
      displayName,
      login,
      register,
      loginAsGuest,
      ensureGuestSession,
      refreshTokenIfNeeded,
      loadProfile,
      updateProfile,
      logout,
      openSessionExpiredDialog,
      closeSessionExpiredDialog,
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
