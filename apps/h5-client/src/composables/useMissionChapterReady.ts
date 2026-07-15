import { useRouter } from "vue-router"
import { useMissionStore } from "@/stores/useMissionStore"

/**
 * 进入任务章节页前：恢复会话、选中章节。
 * 禁止页面内隐式 Join —— 无会话时引导回路线 map「开始探索」。
 */
export function useMissionChapterReady() {
  const missionStore = useMissionStore()
  const router = useRouter()

  async function ensureMissionChapter(routeId: string, chapterId?: string) {
    // 有会话但 mission 未缓存：用 MyRouteProgress 恢复
    if (missionStore.activeSession?.routeId === routeId && !missionStore.activeMission) {
      const restored = await missionStore.restoreActiveMission()
      if (!restored) {
        return false
      }
    }

    // 无本路线会话：不隐式 Join，回路线让用户明确开始
    if (missionStore.activeSession?.routeId !== routeId) {
      await router.replace(`/missions/${routeId}/map`)
      return false
    }

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
