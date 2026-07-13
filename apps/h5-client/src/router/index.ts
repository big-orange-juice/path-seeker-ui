import { createRouter, createWebHistory } from "vue-router"
import {
  resolveRouteCinemaEffect,
  resolveRouteCinemaLabel,
  shouldRunRouteCinema,
} from "@/fx/routeCinema"
import { useAuthStore } from "@/stores/useAuthStore"
import { useCinemaStore } from "@/stores/useCinemaStore"
import MobileShellLayout from "@/layouts/MobileShellLayout.vue"
import AuthPage from "@/pages/AuthPage.vue"
import ArtifactCluePage from "@/pages/ArtifactCluePage.vue"
import ChapterBriefPage from "@/pages/ChapterBriefPage.vue"
import ChapterMapPage from "@/pages/ChapterMapPage.vue"
import ChapterResultPage from "@/pages/ChapterResultPage.vue"
import ChapterVideoPage from "@/pages/ChapterVideoPage.vue"
import FinalePage from "@/pages/FinalePage.vue"
import ProloguePage from "@/pages/ProloguePage.vue"
import PuzzlePage from "@/pages/PuzzlePage.vue"
import ShellArchivePage from "@/pages/ShellArchivePage.vue"
import ShellHallPage from "@/pages/ShellHallPage.vue"
import ShellPlayingPage from "@/pages/ShellPlayingPage.vue"
import TaskDetailPage from "@/pages/TaskDetailPage.vue"

const router = createRouter({
  history: createWebHistory(),
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
        title: "登录与注册",
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
                title: "任务大厅",
                showTabBar: true,
              },
            },
            {
              path: "playing",
              name: "shell-playing",
              component: ShellPlayingPage,
              meta: {
                shellTab: "playing",
                title: "继续游玩",
                showTabBar: true,
              },
            },
            {
              path: "archive",
              name: "shell-archive",
              component: ShellArchivePage,
              meta: {
                shellTab: "archive",
                title: "完成归档",
                showTabBar: true,
              },
            },
          ],
        },
        {
          path: "tasks/:routeId",
          component: TaskDetailPage,
          meta: {
            title: "任务详情",
            showTabBar: false,
          },
        },
        {
          path: "missions/:routeId/prologue",
          component: ProloguePage,
          meta: {
            title: "开场剧情",
            showTabBar: false,
          },
        },
        {
          path: "missions/:routeId/map",
          component: ChapterMapPage,
          meta: {
            title: "章节地图",
            showTabBar: false,
          },
        },
        {
          path: "missions/:routeId/chapters/:chapterId/brief",
          component: ChapterBriefPage,
          meta: {
            title: "线索",
            showTabBar: false,
          },
        },
        {
          path: "missions/:routeId/chapters/:chapterId/clue",
          component: ArtifactCluePage,
          meta: {
            title: "找一找",
            showTabBar: false,
          },
        },
        {
          path: "missions/:routeId/chapters/:chapterId/video",
          component: ChapterVideoPage,
          meta: {
            title: "观展短片",
            showTabBar: false,
          },
        },
        {
          path: "missions/:routeId/chapters/:chapterId/puzzle",
          component: PuzzlePage,
          meta: {
            title: "闯关",
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

router.beforeEach(async (to, from) => {
  const authStore = useAuthStore()

  if (to.meta.public) {
    if (shouldRunRouteCinema(to, from)) {
      const cinema = useCinemaStore()
      await cinema.playRouteExit({
        effect: resolveRouteCinemaEffect(to, from),
        label: resolveRouteCinemaLabel(to),
      })
    }
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

  // Cinema 路由过场：离开页压暗 + 星空斗转（可与接口 loading 叠加）
  if (shouldRunRouteCinema(to, from)) {
    const cinema = useCinemaStore()
    await cinema.playRouteExit({
      effect: resolveRouteCinemaEffect(to, from),
      label: resolveRouteCinemaLabel(to),
      duration: to.path.includes("/video") ? 920 : 860,
    })
  }

  return true
})

router.afterEach((to) => {
  const cinema = useCinemaStore()
  // 仅当 beforeEach 已启动过场时收尾升起
  if (!cinema.transitBusy) {
    return
  }

  void cinema.playRouteEnter({
    duration: to.path.includes("/video") || to.path.includes("/finale") ? 780 : 640,
  })
})

export default router
