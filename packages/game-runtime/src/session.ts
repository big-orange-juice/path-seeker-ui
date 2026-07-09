import type { PuzzleAnswerDraft } from "@path-seeker/game-renderer"
import type {
  RuntimeChapterResultSnapshot,
  RuntimeMissionDetail,
  RuntimeMissionSession,
} from "./contracts"

export function clampChapterIndex(index: number, chapterCount: number) {
  if (chapterCount <= 0) {
    return 0
  }

  return Math.min(Math.max(index, 0), chapterCount - 1)
}

export function resolveUnlockedRewardState(mission: RuntimeMissionDetail, solvedChapterIds: string[]) {
  const solvedSet = new Set(solvedChapterIds)
  const unlockedClueIds = mission.chapters
    .filter((chapter) => solvedSet.has(chapter.id))
    .map((chapter) => chapter.puzzle.reward.clueId)
  const unlockedRewardIds = mission.chapters
    .filter((chapter) => solvedSet.has(chapter.id))
    .map((chapter) => chapter.puzzle.reward.fragmentId)

  return {
    unlockedClueIds,
    unlockedRewardIds,
  }
}

export function sanitizeDraftHistory<TDraft>(
  draftHistory: Record<string, TDraft>,
  mission: RuntimeMissionDetail,
  solvedChapterIds: string[],
) {
  const nextDraftHistory: Record<string, TDraft> = {}
  const solvedSet = new Set(solvedChapterIds)

  mission.chapters.forEach((chapter) => {
    if (solvedSet.has(chapter.id)) {
      return
    }

    const draft = draftHistory[chapter.puzzle.id]
    if (draft) {
      nextDraftHistory[chapter.puzzle.id] = draft
    }
  })

  return nextDraftHistory
}

export function sanitizeHintHistory<THintLevel extends string>(
  hintHistory: Record<string, THintLevel[]>,
  mission: RuntimeMissionDetail,
  solvedChapterIds: string[],
) {
  const nextHintHistory: Record<string, THintLevel[]> = {}
  const solvedSet = new Set(solvedChapterIds)

  mission.chapters.forEach((chapter) => {
    if (solvedSet.has(chapter.id)) {
      return
    }

    const hints = hintHistory[chapter.puzzle.id]
    if (hints?.length) {
      nextHintHistory[chapter.puzzle.id] = hints
    }
  })

  return nextHintHistory
}

interface ResolveSessionProgressStateInput<
  THintLevel extends string,
  TDraft,
  TSnapshot extends RuntimeChapterResultSnapshot<THintLevel> | null,
> {
  mission: RuntimeMissionDetail
  solvedChapterIds: string[]
  preferredChapterIndex?: number
  draftHistory: Record<string, TDraft>
  hintHistory: Record<string, THintLevel[]>
  latestChapterResult?: TSnapshot
}

export function resolveSessionProgressState<
  THintLevel extends string,
  TDraft extends PuzzleAnswerDraft | null,
  TSnapshot extends RuntimeChapterResultSnapshot<THintLevel> | null,
>(
  input: ResolveSessionProgressStateInput<THintLevel, TDraft, TSnapshot>,
) {
  const {
    mission,
    solvedChapterIds,
    preferredChapterIndex,
    draftHistory,
    hintHistory,
    latestChapterResult = null as TSnapshot,
  } = input
  const chapterCount = mission.chapterCount
  const routeCompleted = solvedChapterIds.length >= chapterCount && chapterCount > 0
  const firstUnsolvedIndex = mission.chapters.findIndex((chapter) => !solvedChapterIds.includes(chapter.id))
  const currentChapterIndex = routeCompleted
    ? clampChapterIndex(chapterCount - 1, chapterCount)
    : clampChapterIndex(
        typeof preferredChapterIndex === "number"
          ? preferredChapterIndex
          : firstUnsolvedIndex >= 0
            ? firstUnsolvedIndex
            : 0,
        chapterCount,
      )

  return {
    routeCompleted,
    currentChapterIndex,
    draftHistory: sanitizeDraftHistory(draftHistory, mission, solvedChapterIds),
    hintHistory: sanitizeHintHistory(hintHistory, mission, solvedChapterIds),
    latestChapterResult: routeCompleted ? null as TSnapshot : latestChapterResult,
    ...resolveUnlockedRewardState(mission, solvedChapterIds),
  }
}

export function applyResolvedSessionProgress<
  THintLevel extends string,
  TDraft extends PuzzleAnswerDraft | null,
  TSnapshot extends RuntimeChapterResultSnapshot<THintLevel> | null,
  TSession extends RuntimeMissionSession<THintLevel, TDraft, TSnapshot>,
>(
  session: TSession,
  mission: RuntimeMissionDetail,
  solvedChapterIds: string[],
  preferredChapterIndex?: number,
) {
  const resolvedState = resolveSessionProgressState({
    mission,
    solvedChapterIds,
    preferredChapterIndex,
    draftHistory: session.draftHistory,
    hintHistory: session.hintHistory,
    latestChapterResult: session.latestChapterResult,
  })

  return {
    ...session,
    solvedChapterIds,
    unlockedClueIds: resolvedState.unlockedClueIds,
    unlockedRewardIds: resolvedState.unlockedRewardIds,
    currentChapterIndex: resolvedState.currentChapterIndex,
    draftHistory: resolvedState.draftHistory,
    hintHistory: resolvedState.hintHistory,
    latestChapterResult: resolvedState.latestChapterResult,
    status: resolvedState.routeCompleted ? "completed" : "in_progress",
  } as TSession
}
