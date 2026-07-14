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

export interface RestoreMissionSessionOptions {
  /** 服务端 MyRouteProgress.currentStageId */
  currentStageId?: string | null
  /** 服务端 myTotalScore；缺省保留本地 */
  totalScore?: number
  /** 服务端是否已完成 */
  routeCompleted?: boolean
  teamId?: string | null
}

export function buildRestoredMissionSession(
  previousSession: MissionSession,
  mission: MissionDetail,
  solvedChapterIds: string[],
  options: RestoreMissionSessionOptions = {},
) {
  const preferredChapterIndex =
    options.currentStageId
      ? mission.chapters.findIndex((chapter) => chapter.id === options.currentStageId)
      : undefined

  const base = applyResolvedSessionProgress(
    {
      ...previousSession,
      routeTitle: mission.title,
      teamId: options.teamId ?? previousSession.teamId,
    },
    mission,
    solvedChapterIds,
    preferredChapterIndex != null && preferredChapterIndex >= 0 ? preferredChapterIndex : undefined,
  )

  const routeCompleted =
    Boolean(options.routeCompleted)
    || base.status === "completed"
    || (solvedChapterIds.length >= mission.chapterCount && mission.chapterCount > 0)

  return {
    ...base,
    totalScore:
      typeof options.totalScore === "number" && Number.isFinite(options.totalScore)
        ? options.totalScore
        : base.totalScore,
    status: routeCompleted ? "completed" as const : "in_progress" as const,
    chapterProgress: buildChapterProgressMap(
      mission,
      solvedChapterIds,
      previousSession.chapterProgress,
    ),
  }
}

/**
 * 进入某一站时的路径决策：
 * - 11 解说：无需扫一扫 / 播片 → narration
 * - 10 找一找：扫一扫 → 成功后自动播片 → 播完直接完成（不进 puzzle）
 * - 1~9 练习：扫一扫 → 成功后自动播片 → puzzle
 */
export function resolveChapterEnterPath(
  routeId: string,
  chapterId: string,
  progress: ChapterGateProgress,
  interactionType?: number | null,
) {
  if (progress.solved) {
    return `/missions/${routeId}/map`
  }

  const type = Number(interactionType || 0)

  // 11 解说导览：不需要扫一扫、不需要播片
  if (type === 11) {
    return `/missions/${routeId}/chapters/${chapterId}/narration`
  }

  // 10 找一找：播片结束后进入完成页（由 video 页提交），此处若已播完回 map 防循环
  if (type === 10 && progress.videoWatched) {
    return `/missions/${routeId}/map`
  }

  // 1~9：播片后进闯关
  if (type !== 10 && progress.videoWatched) {
    return `/missions/${routeId}/chapters/${chapterId}/puzzle`
  }

  // 扫一扫成功后自动进播片（非 11）
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

  const interactionType = chapter.interactionType ?? chapter.puzzle?.interactionType
  const type = Number(interactionType || 0)

  // 10 / 11 不走 puzzle 草稿恢复
  if (type === 10 || type === 11) {
    return resolveChapterEnterPath(session.routeId, chapter.id, progress, interactionType)
  }

  if (hasDraft || hasHint || progress.videoWatched) {
    return `/missions/${session.routeId}/chapters/${chapter.id}/puzzle`
  }

  return resolveChapterEnterPath(session.routeId, chapter.id, progress, interactionType)
}
