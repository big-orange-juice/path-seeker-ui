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
 * - 11 解说：独立 narration 页
 * - 1/6：进入 brief 后直接题面；10：在 brief 内完成找一找与短片
 * - 已完成节点允许重复进入对应玩法页
 * - 10 未完成且已 videoWatched：回 map 防循环
 */
export function resolveChapterEnterPath(
  routeId: string,
  chapterId: string,
  progress: ChapterGateProgress,
  interactionType?: number | null,
) {
  const type = Number(interactionType || 0)

  // 11 解说导览：听讲页独立（含已完成重听）
  if (type === 11) {
    return `/missions/${routeId}/chapters/${chapterId}/narration`
  }

  // 10 找一找：未完成且播片闸门已过，回 map 防卡在视频环
  if (type === 10 && progress.videoWatched && !progress.solved) {
    return `/missions/${routeId}/map`
  }

  // 1~10：线索 / 扫一扫 / 短片 / 闯关 同页分阶段（含已完成重玩）
  return `/missions/${routeId}/chapters/${chapterId}/brief`
}

/** 恢复进度路径：多闸门优先于仅 clue/puzzle */
export function resolveMissionResumePath(input: {
  session: MissionSession
  mission: MissionDetail
  chapterId: string | null
  /** @deprecated 本站页内按闸门恢复阶段，保留入参兼容 */
  hasDraft?: boolean
  /** @deprecated 本站页内按闸门恢复阶段，保留入参兼容 */
  hasHint?: boolean
}) {
  const { session, mission, chapterId } = input

  // 已完成路线：回选站页可重复观看/游玩，不自动进终局页
  if (session.status === "completed") {
    return `/missions/${session.routeId}/map`
  }

  if (session.latestChapterResult?.chapterId) {
    // 刚通关一站的短结果页仍可恢复；终局页不自动跳
    return `/missions/${session.routeId}/chapters/${session.latestChapterResult.chapterId}/result`
  }

  // 刚开局 / 无章节进度：统一回 map 选站，不再中转 prologue
  const hasProgressArtifacts =
    Object.keys(session.draftHistory).length > 0
    || Object.keys(session.hintHistory).length > 0
    || Object.values(session.chapterProgress || {}).some((item) => item.recognized || item.videoWatched)

  if (
    session.solvedChapterIds.length === 0
    && session.currentChapterIndex === 0
    && !hasProgressArtifacts
  ) {
    return `/missions/${session.routeId}/map`
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
  // 1~11 统一到 brief / narration；页内按闸门展示阶段
  return resolveChapterEnterPath(session.routeId, chapter.id, progress, interactionType)
}
