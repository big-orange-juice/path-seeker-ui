import { shallowRef } from "vue"

const accessToken = shallowRef("")

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim()
}

export function setAccessToken(value: string | null | undefined) {
  accessToken.value = normalizeText(value)
}

export function clearAccessToken() {
  accessToken.value = ""
}

export function getAccessToken() {
  return accessToken.value
}
