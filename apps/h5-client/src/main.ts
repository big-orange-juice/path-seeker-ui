import { createApp } from "vue"
import { createPinia } from "pinia"
import piniaPluginPersistedstate from "pinia-plugin-persistedstate"
import App from "./App.vue"
import router from "./router"
import { useAuthStore } from "@/stores/useAuthStore"
import { useMissionStore } from "@/stores/useMissionStore"
import "./assets/styles/index.css"

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)

app.use(pinia)

/**
 * 启动顺序：鉴权就绪 → 列表 / 会话恢复。
 * 避免 PageList 与 token 刷新竞态导致列表被清空且不再重试。
 */
async function bootstrapClient() {
  const authStore = useAuthStore(pinia)
  const missionStore = useMissionStore(pinia)

  if (!authStore.isLoggedIn) {
    return
  }

  // 过期则刷新；未过期时 refreshTokenIfNeeded 直接返回 null，仍视为可用
  if (authStore.isTokenExpired) {
    const refreshed = await authStore.refreshTokenIfNeeded(true)
    if (!refreshed || !authStore.isLoggedIn) {
      return
    }
  }

  void authStore.loadProfile()

  // 列表优先；失败由展厅 ensure + 重试兜底
  void missionStore.loadRouteCards({ force: true })

  // 仅在有会话且 mission 未缓存时恢复，避免无意义的 Detail/Stages 风暴
  if (missionStore.activeSession && !missionStore.getMission(missionStore.activeSession.routeId)) {
    void missionStore.restoreActiveMission()
  }
}

void bootstrapClient()

app.use(router).mount("#app")
