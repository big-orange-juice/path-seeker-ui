import { useRouter } from "vue-router"
import { useMissionStore } from "@/stores/useMissionStore"

/**
 * 进入任务章节页前：恢复会话、选中章节。
 * 无本路线会话时回路线 map（map 进入时会自动 Join 开局）。
 */
export function useMissionChapterReady() {
  const missionStore = useMissionStore()
  const router = useRouter()

  async function ensureMissionChapter(routeId: string, chapterId?: string) {
    // 无本路线会话：回路线 map，由 map 自动 Join
    if (missionStore.activeSession?.routeId !== routeId) {
      await router.replace(`/missions/${routeId}/map`)
      return false
    }

    // 有会话但 mission 未缓存：恢复（store 内 inflight 去重）
    if (!missionStore.activeMission) {
      const restored = await missionStore.restoreActiveMission()
      if (!restored) {
        return false
      }
    }

    if (!missionStore.activeMission || missionStore.activeSession?.routeId !== routeId) {
      return false
    }

    if (chapterId) {
      missionStore.selectChapterById(chapterId)
    }

    // 弱行为：进入节点（失败忽略）
    if (chapterId) {
      void missionStore.recordStageActivity(routeId, chapterId, "enter")
    }

    return true
  }

  return {
    missionStore,
    ensureMissionChapter,
  }
}
