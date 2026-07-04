const STORAGE_KEY_AUTH = "path-seeker:auth-session"

export interface PersistedAuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: number | null
}

export function readPersistedAuthSession(): PersistedAuthSession | null {
  try {
    const value = uni.getStorageSync(STORAGE_KEY_AUTH)
    return value ? (value as PersistedAuthSession) : null
  } catch {
    return null
  }
}

export function writePersistedAuthSession(value: PersistedAuthSession | null) {
  try {
    if (!value) {
      uni.removeStorageSync(STORAGE_KEY_AUTH)
      return
    }

    uni.setStorageSync(STORAGE_KEY_AUTH, value)
  } catch {
    console.warn("auth session persist failed")
  }
}

export function getPersistedAccessToken() {
  return readPersistedAuthSession()?.accessToken || ""
}
