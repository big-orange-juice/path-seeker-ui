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

const authStore = useAuthStore(pinia)
const missionStore = useMissionStore(pinia)
if (authStore.isLoggedIn) {
  void authStore.refreshTokenIfNeeded().then((result) => {
    if (result || !authStore.isTokenExpired) {
      void authStore.loadProfile()
    }
  })
}

if (missionStore.activeSession) {
  void missionStore.restoreActiveMission()
}

app.use(router).mount("#app")
