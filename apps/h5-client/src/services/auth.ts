import { request } from "@/services/http"

const H5_PLATFORM = 5

export interface LoginRequest {
  account: string
  password: string
  platform?: number | null
  device?: string | null
  langCode?: string | null
}

export interface RegisterRequest {
  username?: string | null
  phone?: string | null
  email?: string | null
  password: string
  nickname?: string | null
  preferredLang?: string | null
  platform?: number | null
  device?: string | null
}

export interface GuestLoginRequest {
  platform?: number | null
  device?: string | null
  langCode?: string | null
}

export interface LoginResponse {
  userId?: string | null
  userNo?: string | null
  nickname?: string | null
  avatarUrl?: string | null
  preferredLang?: string | null
  isGuest?: boolean
  accessToken?: string | null
  refreshToken?: string | null
  expiresIn?: number
}

export interface UserProfileResponse {
  id?: string | null
  userNo?: string | null
  username?: string | null
  nickname?: string | null
  avatarUrl?: string | null
  phone?: string | null
  email?: string | null
  gender?: number
  birthday?: string | null
  country?: string | null
  preferredLang?: string | null
  registerChannel?: number
  totalPoints?: number
  status?: number
  registerTime?: string | null
  lastLoginTime?: string | null
}

export interface UpdateProfileRequest {
  nickname?: string | null
  avatarUrl?: string | null
  gender?: number | null
  birthday?: string | null
  country?: string | null
  preferredLang?: string | null
}

function getDeviceId() {
  if (typeof navigator === "undefined") {
    return ""
  }

  return navigator.userAgent || navigator.platform || "h5-browser"
}

export function createAuthClientMeta() {
  return {
    platform: H5_PLATFORM,
    device: getDeviceId(),
    langCode: "zh-CN",
  }
}

export function loginAppUser(payload: Omit<LoginRequest, "platform" | "device" | "langCode">) {
  return request<LoginResponse>("/api/AppUser/Login", {
    method: "POST",
    data: {
      ...payload,
      ...createAuthClientMeta(),
    },
  })
}

export function registerAppUser(payload: Omit<RegisterRequest, "platform" | "device">) {
  return request<LoginResponse>("/api/AppUser/Register", {
    method: "POST",
    data: {
      ...payload,
      platform: H5_PLATFORM,
      device: getDeviceId(),
    },
  })
}

export function guestLoginAppUser() {
  return request<LoginResponse>("/api/AppUser/GuestLogin", {
    method: "POST",
    data: createAuthClientMeta(),
  })
}

export function refreshAppUserToken(refreshToken: string) {
  return request<LoginResponse>("/api/AppUser/RefreshToken", {
    method: "POST",
    data: {
      refreshToken,
    },
  })
}

export function fetchAppUserProfile() {
  return request<UserProfileResponse>("/api/AppUser/Profile")
}

export function updateAppUserProfile(payload: UpdateProfileRequest) {
  return request<UserProfileResponse>("/api/AppUser/UpdateProfile", {
    method: "POST",
    data: { ...payload },
  })
}
