import type {
  RuntimeMissionChapter,
  RuntimeMissionDetail,
  RuntimeMissionSession,
} from "./contracts"

interface ResolveResumeRoutePathInput<THintLevel extends string> {
  session: RuntimeMissionSession<THintLevel, any, any>
  mission: RuntimeMissionDetail
  chapter: RuntimeMissionChapter | null
  currentPuzzleId?: string | null
  currentHintLevels?: THintLevel[]
  hasDraft?: boolean
}

export function resolveResumeRoutePath<THintLevel extends string>(input: ResolveResumeRoutePathInput<THintLevel>) {
  const {
    session,
    mission,
    chapter,
    currentPuzzleId,
    currentHintLevels = [],
    hasDraft = false,
  } = input

  if (!chapter) {
    return null
  }

  if (session.status === "completed" || session.latestChapterResult?.finalChapter) {
    return `/missions/${session.routeId}/finale`
  }

  if (session.latestChapterResult?.chapterId) {
    return `/missions/${session.routeId}/chapters/${session.latestChapterResult.chapterId}/result`
  }

  const hasProgressArtifacts = Object.keys(session.draftHistory).length > 0 || Object.keys(session.hintHistory).length > 0

  if (
    mission.prologue.length > 0
    && session.solvedChapterIds.length === 0
    && session.currentChapterIndex === 0
    && !hasProgressArtifacts
  ) {
    return `/missions/${session.routeId}/prologue`
  }

  if (currentPuzzleId && (hasDraft || currentHintLevels.length > 0)) {
    return `/missions/${session.routeId}/chapters/${chapter.id}/puzzle`
  }

  return `/missions/${session.routeId}/chapters/${chapter.id}/clue`
}
