import { createRouter, createWebHistory } from "vue-router"
import { useAuthStore } from "@/stores/useAuthStore"
import MobileShellLayout from "@/layouts/MobileShellLayout.vue"
import AuthPage from "@/pages/AuthPage.vue"
import ShellArchivePage from "@/pages/ShellArchivePage.vue"
import ShellAskPage from "@/pages/ShellAskPage.vue"
import ShellMePage from "@/pages/ShellMePage.vue"
import ShellPlayingPage from "@/pages/ShellPlayingPage.vue"
import OutdoorMapPage from "@/pages/OutdoorMapPage.vue"

/**
 * 当前只保留户外游览主线与「我的 / 足迹」外壳。
 * 展馆浏览（/venues、/museums/:id/assets/…）与室内闯关（/missions/*）暂时下线：
 * 页面文件仍在仓库中，恢复时把它们重新挂回这里即可。
 */
const router = createRouter({
  // 与 vite.config base 对齐，否则访问 /path-seeker/client/ 会报 No match found
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      redirect: "/ride",
    },
    {
      path: "/auth",
      name: "auth",
      component: AuthPage,
      meta: {
        title: "登录",
        public: true,
      },
    },
    {
      path: "/",
      component: MobileShellLayout,
      children: [
        { path: "ride", name: "tour-entry", component: OutdoorMapPage, meta: { title: "游览路线", showTabBar: false } },
        { path: "museums/:museumId/map", name: "outdoor-map", component: OutdoorMapPage, meta: { title: "景区地图", showTabBar: false } },
        { path: "map", redirect: (to) => ({ path: `/museums/${String(to.query.museumId || import.meta.env.VITE_MUSEUM_ID || '1')}/map`, query: to.query }) },
        {
          path: "shell",
          children: [
            {
              path: "",
              redirect: "/shell/me",
            },
            {
              // 展厅入口已下线，旧链接统一回到户外主线
              path: "hall",
              redirect: "/ride",
            },
            {
              path: "playing",
              name: "shell-playing",
              component: ShellPlayingPage,
              meta: {
                shellTab: "me",
                title: "探索",
                showTabBar: true,
              },
            },
            {
              path: "archive",
              name: "shell-archive",
              component: ShellArchivePage,
              meta: {
                shellTab: "me",
                title: "探索记录",
                showTabBar: true,
              },
            },
            {
              path: "me",
              name: "shell-me",
              component: ShellMePage,
              meta: {
                shellTab: "me",
                title: "我的",
                showTabBar: true,
              },
            },
            {
              path: "ask",
              name: "shell-ask",
              component: ShellAskPage,
              meta: {
                title: "问一问",
                showTabBar: false,
              },
            },
          ],
        },
      ],
    },
    {
      // 下线路由与未知地址统一回到户外主线，避免手机端停在空白页
      path: "/:pathMatch(.*)*",
      redirect: "/ride",
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (to.meta.public) {
    return true
  }

  // 默认游客身份：没有可用 token 时静默签发游客会话，失败才回落到登录页
  if (await authStore.ensureGuestSession()) {
    return true
  }

  return {
    path: "/auth",
    query: {
      redirect: to.fullPath,
    },
  }
})

export default router
