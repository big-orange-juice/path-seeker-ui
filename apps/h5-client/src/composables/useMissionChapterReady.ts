import { useMissionStore } from "@/stores/useMissionStore"

/**
 * 进入任务章节页前：恢复会话、选中章节。
 * 不在中途隐式重新 Join（仅无会话时才 start）。
 */
export function useMissionChapterReady() {
  const missionStore = useMissionStore()

  async function ensureMissionChapter(routeId: string, chapterId?: string) {
    if (missionStore.activeSession?.routeId === routeId && !missionStore.activeMission) {
      await missionStore.restoreActiveMission()
    }

    if (missionStore.activeSession?.routeId !== routeId || !missionStore.activeMission) {
      const mission = missionStore.getMission(routeId) || (await missionStore.loadMissionDetail(routeId))
      if (!mission) {
        return false
      }

      if (missionStore.activeSession?.routeId !== routeId) {
        await missionStore.startRemoteMission(routeId)
      } else if (!missionStore.activeMission) {
        await missionStore.restoreActiveMission()
      }
    }

    if (!missionStore.activeMission || missionStore.activeSession?.routeId !== routeId) {
      return false
    }

    if (chapterId) {
      missionStore.selectChapterById(chapterId)
    }

    return true
  }

  return {
    missionStore,
    ensureMissionChapter,
  }
}
