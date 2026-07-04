import { useAuthStore } from "@/stores/useAuthStore"
import { MINI_ROUTE_KEYS, MINI_ROUTES } from "@/utils/navigation"

export function requireAuthForTab() {
  const authStore = useAuthStore()

  if (authStore.isLoggedIn) {
    return true
  }

  const pages = getCurrentPages()
  const route = pages[pages.length - 1]?.route || ""
  if (route === MINI_ROUTE_KEYS.auth) {
    return false
  }

  uni.redirectTo({ url: MINI_ROUTES.auth })
  return false
}
