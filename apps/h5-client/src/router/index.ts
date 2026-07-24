import { createRouter, createWebHistory } from "vue-router"
import { useAuthStore } from "@/stores/useAuthStore"
import MobileShellLayout from "@/layouts/MobileShellLayout.vue"
import AuthPage from "@/pages/AuthPage.vue"
import ChapterBriefPage from "@/pages/ChapterBriefPage.vue"
import ChapterMapPage from "@/pages/ChapterMapPage.vue"
import ChapterResultPage from "@/pages/ChapterResultPage.vue"
import FinalePage from "@/pages/FinalePage.vue"
import NarrationChapterPage from "@/pages/NarrationChapterPage.vue"
import ShellArchivePage from "@/pages/ShellArchivePage.vue"
import ShellAskPage from "@/pages/ShellAskPage.vue"
import ShellHallPage from "@/pages/ShellHallPage.vue"
import ShellPlayingPage from "@/pages/ShellPlayingPage.vue"

const router = createRouter({
  // 与 vite.config base 对齐，否则访问 /path-seeker/client/ 会报 No match found
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      redirect: "/shell/hall",
    },
    {
      path: "/auth",
      name: "auth",
      component: AuthPage,
      meta: {
        title: "开始探索",
        public: true,
      },
    },
    {
      path: "/",
      component: MobileShellLayout,
      children: [
        {
          path: "shell",
          children: [
            {
              path: "",
              redirect: "/shell/hall",
            },
            {
              path: "hall",
              name: "shell-hall",
              component: ShellHallPage,
              meta: {
                shellTab: "hall",
                title: "展厅",
                showTabBar: true,
              },
            },
            {
              path: "playing",
              name: "shell-playing",
              component: ShellPlayingPage,
              meta: {
                shellTab: "playing",
                title: "探索",
                showTabBar: true,
              },
            },
            {
              path: "archive",
              name: "shell-archive",
              component: ShellArchivePage,
              meta: {
                shellTab: "archive",
                title: "游玩历史",
                showTabBar: true,
              },
            },
            {
              path: "ask",
              name: "shell-ask",
              component: ShellAskPage,
              meta: {
                shellTab: "hall",
                title: "问一问",
                showTabBar: false,
              },
            },
          ],
        },
        {
          // 兼容旧链接：任务详情已并入路线 map
          path: "tasks/:routeId",
          redirect: (to) => `/missions/${String(to.params.routeId || "")}/map`,
        },
        {
          // 旧介绍页：统一并入 map 选站，避免「预览 → 介绍 → 再选站」重复
          path: "missions/:routeId/prologue",
          redirect: (to) => `/missions/${String(to.params.routeId || "")}/map`,
        },
        {
          path: "missions/:routeId/map",
          component: ChapterMapPage,
          meta: {
            title: "路线",
            showTabBar: false,
          },
        },
        {
          // brief 仅承载 1/6 题面与 10 的扫码播片；11 由独立解说页处理。
          path: "missions/:routeId/chapters/:chapterId/brief",
          component: ChapterBriefPage,
          meta: {
            title: "本站",
            showTabBar: false,
          },
        },
        {
          // 兼容旧链接：clue / video / puzzle 均并入 brief
          path: "missions/:routeId/chapters/:chapterId/clue",
          redirect: (to) =>
            `/missions/${String(to.params.routeId || "")}/chapters/${String(to.params.chapterId || "")}/brief`,
        },
        {
          path: "missions/:routeId/chapters/:chapterId/video",
          redirect: (to) =>
            `/missions/${String(to.params.routeId || "")}/chapters/${String(to.params.chapterId || "")}/brief`,
        },
        {
          path: "missions/:routeId/chapters/:chapterId/puzzle",
          redirect: (to) =>
            `/missions/${String(to.params.routeId || "")}/chapters/${String(to.params.chapterId || "")}/brief`,
        },
        {
          path: "missions/:routeId/chapters/:chapterId/narration",
          component: NarrationChapterPage,
          meta: {
            title: "解说导览",
            showTabBar: false,
          },
        },
        {
          path: "missions/:routeId/chapters/:chapterId/result",
          component: ChapterResultPage,
          meta: {
            title: "本站结果",
            showTabBar: false,
          },
        },
        {
          path: "missions/:routeId/finale",
          component: FinalePage,
          meta: {
            title: "终局结算",
            showTabBar: false,
          },
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (to.meta.public) {
    return true
  }

  if (!authStore.isLoggedIn) {
    return {
      path: "/auth",
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (authStore.isTokenExpired) {
    const refreshed = await authStore.refreshTokenIfNeeded(true)

    if (!refreshed) {
      return {
        path: "/auth",
        query: {
          redirect: to.fullPath,
        },
      }
    }
  }

  // 路由切换不再压暗过场，直接进入目标页
  return true
})

export default router
