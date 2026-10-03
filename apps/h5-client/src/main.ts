import { createApp } from "vue"
import { createPinia, setActivePinia } from "pinia"
import piniaPluginPersistedstate from "pinia-plugin-persistedstate"
import App from "./App.vue"
import router from "./router"
import { useAuthStore } from "@/stores/useAuthStore"
import "./assets/styles/index.css"

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

// 必须先安装 pinia，再挂 router / 调 store，否则生产包会出现 reading '_s' of undefined
app.use(pinia)
setActivePinia(pinia)
app.use(router)

/**
 * 启动只保证会话可用：有 token 复用，没有就静默游客登录。
 * 业务数据由各页面自己按需拉取，避免启动阶段与路由守卫互相抢 token。
 */
async function bootstrapClient() {
  // 确保任意异步回调里 useStore 都能拿到同一 pinia
  setActivePinia(pinia)

  const authStore = useAuthStore(pinia)

  if (!(await authStore.ensureGuestSession())) {
    return
  }

  if (!authStore.profile?.id) {
    void authStore.loadProfile()
  }
}

app.mount("#app")
void bootstrapClient()
