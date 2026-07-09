import type {
  RuntimeChapterResultSnapshot,
  RuntimeMissionChapter,
  RuntimeMissionDetail,
  RuntimeMissionSession,
} from "./contracts"
import { scorePuzzle } from "./scoring"

interface FinalizeSolveInput<THintLevel extends string, TSnapshot extends RuntimeChapterResultSnapshot<THintLevel> | null> {
  session: RuntimeMissionSession<THintLevel, any, TSnapshot>
  mission: RuntimeMissionDetail
  chapter: RuntimeMissionChapter
  hintLevels: THintLevel[]
  skipped?: boolean
  scoreOverride?: number
  narrativeOverride?: string
}

export function finalizeSessionAfterSolve<
  THintLevel extends string,
  TSnapshot extends RuntimeChapterResultSnapshot<THintLevel> | null,
  TSession extends RuntimeMissionSession<THintLevel, any, TSnapshot>,
>(
  input: FinalizeSolveInput<THintLevel, TSnapshot> & { session: TSession },
) {
  const {
    session,
    mission,
    chapter,
    hintLevels,
    skipped = false,
    scoreOverride,
    narrativeOverride = "",
  } = input

  const wasSolved = session.solvedChapterIds.includes(chapter.id)
  const calculatedScore = typeof scoreOverride === "number"
    ? scoreOverride
    : scorePuzzle(chapter.puzzle.difficultyLevel, hintLevels.length, skipped)
  const gainedScore = wasSolved ? 0 : calculatedScore
  const nextSolvedChapterIds = [...new Set([...session.solvedChapterIds, chapter.id])]
  const nextUnlockedClueIds = [...new Set([...session.unlockedClueIds, chapter.puzzle.reward.clueId])]
  const nextUnlockedRewardIds = [...new Set([...session.unlockedRewardIds, chapter.puzzle.reward.fragmentId])]
  const routeCompleted = nextSolvedChapterIds.length >= mission.chapterCount && mission.chapterCount > 0

  const snapshot: RuntimeChapterResultSnapshot<THintLevel> = {
    routeId: mission.id,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    narrative: narrativeOverride || chapter.resultNarrative || "",
    unlockedClue: chapter.puzzle.reward,
    gainedScore,
    usedHints: hintLevels,
    perfectClear: !skipped && hintLevels.length === 0,
    finalChapter: routeCompleted,
  }

  const nextSession: TSession = {
    ...session,
    totalScore: session.totalScore + gainedScore,
    solvedChapterIds: nextSolvedChapterIds,
    unlockedClueIds: nextUnlockedClueIds,
    unlockedRewardIds: nextUnlockedRewardIds,
    latestChapterResult: snapshot as TSnapshot,
    status: routeCompleted ? "completed" : session.status,
  } as TSession

  return {
    snapshot,
    nextSession,
    routeCompleted,
  }
}

export function advanceSessionAfterChapterResult<
  THintLevel extends string,
  TSnapshot extends RuntimeChapterResultSnapshot<THintLevel> | null,
  TSession extends RuntimeMissionSession<THintLevel, any, TSnapshot>,
>(
  session: TSession,
  mission: RuntimeMissionDetail,
) {
  if (!session.latestChapterResult) {
    return {
      advanced: false,
      nextSession: session,
    }
  }

  if (session.latestChapterResult.finalChapter) {
    return {
      advanced: true,
      nextSession: {
        ...session,
        currentChapterIndex: Math.max(mission.chapterCount - 1, 0),
        latestChapterResult: null as TSnapshot,
      } as TSession,
    }
  }

  const currentIndex = mission.chapters.findIndex((chapter) => chapter.id === session.latestChapterResult?.chapterId)
  const nextIndex = mission.chapters.findIndex((chapter, index) => index > currentIndex && !session.solvedChapterIds.includes(chapter.id))

  return {
    advanced: true,
    nextSession: {
      ...session,
      currentChapterIndex: nextIndex >= 0 ? nextIndex : Math.min(currentIndex + 1, mission.chapterCount - 1),
      latestChapterResult: null as TSnapshot,
    } as TSession,
  }
}
