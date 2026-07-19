import { createApp } from "vue"
import { createPinia, setActivePinia } from "pinia"
import piniaPluginPersistedstate from "pinia-plugin-persistedstate"
import App from "./App.vue"
import router from "./router"
import { useAuthStore } from "@/stores/useAuthStore"
import { useMissionStore } from "@/stores/useMissionStore"
import "./assets/styles/index.css"

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

// 必须先安装 pinia，再挂 router / 调 store，否则生产包会出现 reading '_s' of undefined
app.use(pinia)
setActivePinia(pinia)
app.use(router)

/**
 * 启动顺序：鉴权就绪 → 列表 / 会话恢复。
 * 避免 Published 列表与 token 刷新竞态导致列表被清空且不再重试。
 */
async function bootstrapClient() {
  // 确保任意异步回调里 useStore 都能拿到同一 pinia
  setActivePinia(pinia)

  const authStore = useAuthStore(pinia)
  const missionStore = useMissionStore(pinia)

  if (!authStore.isLoggedIn) {
    return
  }

  if (authStore.isTokenExpired) {
    const refreshed = await authStore.refreshTokenIfNeeded(true)
    if (!refreshed || !authStore.isLoggedIn) {
      return
    }
  }

  void authStore.loadProfile()
  void missionStore.loadRouteCards({ force: true })

  if (missionStore.activeSession && !missionStore.getMission(missionStore.activeSession.routeId)) {
    void missionStore.restoreActiveMission()
  }
}

app.mount("#app")
void bootstrapClient()
