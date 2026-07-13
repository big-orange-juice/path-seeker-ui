import {
  applyResolvedSessionProgress,
  resolveSessionProgressState,
} from "@path-seeker/game-runtime"
import type { JoinRouteResponse } from "@/services/gameplay"
import type {
  AgeBand,
  ChapterGateProgress,
  MissionDetail,
  MissionSession,
} from "@/types/mission"

const EMPTY_GATE: ChapterGateProgress = {
  recognized: false,
  videoWatched: false,
  solved: false,
}

export function buildChapterProgressMap(
  mission: MissionDetail,
  solvedChapterIds: string[],
  previous?: Record<string, ChapterGateProgress> | null,
): Record<string, ChapterGateProgress> {
  const solvedSet = new Set(solvedChapterIds)
  const next: Record<string, ChapterGateProgress> = {}

  mission.chapters.forEach((chapter) => {
    const prev = previous?.[chapter.id]
    const solved = solvedSet.has(chapter.id)
    next[chapter.id] = {
      recognized: Boolean(prev?.recognized || solved),
      videoWatched: Boolean(prev?.videoWatched || solved),
      solved,
    }
  })

  return next
}

export function getChapterGateProgress(
  session: MissionSession | null | undefined,
  chapterId: string,
): ChapterGateProgress {
  return session?.chapterProgress?.[chapterId] || { ...EMPTY_GATE }
}

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

  const previousProgress =
    previousSession?.routeId === routeId ? previousSession.chapterProgress : null

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
    chapterProgress: buildChapterProgressMap(mission, solvedChapterIds, previousProgress),
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
  const base = applyResolvedSessionProgress({
    ...previousSession,
    routeTitle: mission.title,
  }, mission, solvedChapterIds)

  return {
    ...base,
    chapterProgress: buildChapterProgressMap(
      mission,
      solvedChapterIds,
      previousSession.chapterProgress,
    ),
  }
}

/**
 * 进入某一站时的路径决策（对齐 demo）：
 * 未识别 → brief；已识别未播片 → video；已播片未通关 → puzzle；已通关 → map
 */
export function resolveChapterEnterPath(routeId: string, chapterId: string, progress: ChapterGateProgress) {
  if (progress.solved) {
    return `/missions/${routeId}/map`
  }
  if (progress.videoWatched) {
    return `/missions/${routeId}/chapters/${chapterId}/puzzle`
  }
  if (progress.recognized) {
    return `/missions/${routeId}/chapters/${chapterId}/video`
  }
  return `/missions/${routeId}/chapters/${chapterId}/brief`
}

/** 恢复进度路径：多闸门优先于仅 clue/puzzle */
export function resolveMissionResumePath(input: {
  session: MissionSession
  mission: MissionDetail
  chapterId: string | null
  hasDraft?: boolean
  hasHint?: boolean
}) {
  const { session, mission, chapterId, hasDraft = false, hasHint = false } = input

  if (session.status === "completed" || session.latestChapterResult?.finalChapter) {
    return `/missions/${session.routeId}/finale`
  }

  if (session.latestChapterResult?.chapterId) {
    return `/missions/${session.routeId}/chapters/${session.latestChapterResult.chapterId}/result`
  }

  const hasProgressArtifacts =
    Object.keys(session.draftHistory).length > 0
    || Object.keys(session.hintHistory).length > 0
    || Object.values(session.chapterProgress || {}).some((item) => item.recognized || item.videoWatched)

  if (
    mission.prologue.length > 0
    && session.solvedChapterIds.length === 0
    && session.currentChapterIndex === 0
    && !hasProgressArtifacts
  ) {
    return `/missions/${session.routeId}/prologue`
  }

  const chapter = chapterId
    ? mission.chapters.find((item) => item.id === chapterId) || mission.chapters[session.currentChapterIndex]
    : mission.chapters[session.currentChapterIndex]

  if (!chapter) {
    return `/missions/${session.routeId}/map`
  }

  const progress = getChapterGateProgress(session, chapter.id)

  if (progress.solved) {
    return `/missions/${session.routeId}/map`
  }

  if (hasDraft || hasHint || progress.videoWatched) {
    return `/missions/${session.routeId}/chapters/${chapter.id}/puzzle`
  }

  return resolveChapterEnterPath(session.routeId, chapter.id, progress)
}
