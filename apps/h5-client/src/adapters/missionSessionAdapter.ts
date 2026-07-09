import {
  applyResolvedSessionProgress,
  resolveSessionProgressState,
} from "@path-seeker/game-runtime"
import type { JoinRouteResponse } from "@/services/gameplay"
import type {
  AgeBand,
  MissionDetail,
  MissionSession,
} from "@/types/mission"

export function sanitizeMissionHintTextMap(
  hintTextMap: Record<string, string>,
  mission: MissionDetail,
  solvedChapterIds: string[],
) {
  const nextHintTextMap: Record<string, string> = {}
  const solvedSet = new Set(solvedChapterIds)

  mission.chapters.forEach((chapter) => {
    if (solvedSet.has(chapter.id)) {
      return
    }

    const hintText = hintTextMap[chapter.puzzle.id]
    if (hintText) {
      nextHintTextMap[chapter.puzzle.id] = hintText
    }
  })

  return nextHintTextMap
}

interface BuildStartedMissionSessionInput {
  routeId: string
  mission: MissionDetail
  joinResult: JoinRouteResponse
  solvedChapterIds: string[]
  selectedAgeBand?: AgeBand
  teamId?: string | null
  previousSession?: MissionSession | null
  preferredChapterIndex?: number
}

export function buildStartedMissionSession(input: BuildStartedMissionSessionInput): MissionSession {
  const {
    routeId,
    mission,
    joinResult,
    solvedChapterIds,
    selectedAgeBand,
    teamId,
    previousSession,
    preferredChapterIndex,
  } = input
  const restoredState = resolveSessionProgressState({
    mission,
    solvedChapterIds,
    preferredChapterIndex,
    draftHistory: previousSession?.routeId === routeId ? previousSession.draftHistory : {},
    hintHistory: previousSession?.routeId === routeId ? previousSession.hintHistory : {},
    latestChapterResult: null,
  })

  return {
    sessionId: joinResult.progressId || `remote-session-${routeId}-${Date.now()}`,
    routeId,
    routeTitle: mission.title,
    source: "remote",
    teamId: teamId || null,
    selectedAgeBand: selectedAgeBand || mission.recommendedAgeBand,
    currentChapterIndex: restoredState.currentChapterIndex,
    solvedChapterIds,
    unlockedClueIds: restoredState.unlockedClueIds,
    unlockedRewardIds: restoredState.unlockedRewardIds,
    hintHistory: restoredState.hintHistory,
    draftHistory: restoredState.draftHistory,
    totalScore: joinResult.myTotalScore ?? 0,
    startedAt: joinResult.startedAt || new Date().toISOString(),
    status: restoredState.routeCompleted ? "completed" : "in_progress",
    latestChapterResult: restoredState.latestChapterResult,
  }
}

export function buildRestoredMissionSession(
  previousSession: MissionSession,
  mission: MissionDetail,
  solvedChapterIds: string[],
) {
  return applyResolvedSessionProgress({
    ...previousSession,
    routeTitle: mission.title,
  }, mission, solvedChapterIds)
}
