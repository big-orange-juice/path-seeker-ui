import { createRouter, createWebHistory } from "vue-router"
import { useAuthStore } from "@/stores/useAuthStore"
import MobileShellLayout from "@/layouts/MobileShellLayout.vue"
import AuthPage from "@/pages/AuthPage.vue"
import ArtifactCluePage from "@/pages/ArtifactCluePage.vue"
import ChapterMapPage from "@/pages/ChapterMapPage.vue"
import ChapterResultPage from "@/pages/ChapterResultPage.vue"
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
      path: "/shell",
      component: MobileShellLayout,
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
          },
        },
        {
          path: "playing",
          name: "shell-playing",
          component: ShellPlayingPage,
          meta: {
            shellTab: "playing",
            title: "继续游玩",
          },
        },
        {
          path: "archive",
          name: "shell-archive",
          component: ShellArchivePage,
          meta: {
            shellTab: "archive",
            title: "完成归档",
          },
        },
      ],
    },
    {
      path: "/tasks/:routeId",
      component: TaskDetailPage,
      meta: {
        title: "任务详情",
      },
    },
    {
      path: "/missions/:routeId/prologue",
      component: ProloguePage,
      meta: {
        title: "开场剧情",
      },
    },
    {
      path: "/missions/:routeId/map",
      component: ChapterMapPage,
      meta: {
        title: "章节地图",
      },
    },
    {
      path: "/missions/:routeId/chapters/:chapterId/clue",
      component: ArtifactCluePage,
      meta: {
        title: "展品观察",
      },
    },
    {
      path: "/missions/:routeId/chapters/:chapterId/puzzle",
      component: PuzzlePage,
      meta: {
        title: "谜题挑战",
      },
    },
    {
      path: "/missions/:routeId/chapters/:chapterId/result",
      component: ChapterResultPage,
      meta: {
        title: "章节结果",
      },
    },
    {
      path: "/missions/:routeId/finale",
      component: FinalePage,
      meta: {
        title: "终局结算",
      },
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

  return true
})

export default router
