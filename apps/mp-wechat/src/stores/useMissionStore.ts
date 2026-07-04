import { computed, reactive, ref, shallowRef, watch } from "vue"
import { defineStore } from "pinia"
import {
  adaptRouteDetailToMission,
  encodeStageSubmitPayload,
  getSolvedStageIds,
  resolveCurrentChapterIndex,
} from "@/adapters/gameplayMissionAdapter"
import { AGE_BAND_OPTIONS, DIFFICULTY_OPTIONS, TASK_KIND_OPTIONS } from "@/mock/schema"
import {
  fetchGameplayStages,
  fetchRouteDetail,
  fetchStageHints,
  joinGameplayRoute,
  submitGameplayStage,
  unlockStageHint,
} from "@/services/gameplay"
import { resolveRequestErrorMessage } from "@/services/http"
import { getDifficultyLabel } from "@/utils/puzzleLabels"
import type {
  AgeBand,
  DifficultyLevel,
  HintLevel,
  MatchPair,
  MissionAnswerDraft,
  MissionArchiveEntry,
  MissionChapter,
  MissionDetail,
  MissionPuzzle,
  MissionRouteCard,
  MissionSession,
  ReasoningAnswerValue,
  TaskKind,
} from "@/types/mission"

const STORAGE_KEY_SESSION = "path-seeker:mission-session"
const STORAGE_KEY_ARCHIVE = "path-seeker:mission-archive"
const STORAGE_KEY_FILTERS = "path-seeker:mission-filters"

const HINT_LEVELS: HintLevel[] = ["observe", "relation", "direct"]

function readStoredSession() {
  const session = readStorage<MissionSession | null>(STORAGE_KEY_SESSION, null)
  return session?.source === "mock" ? null : session
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = uni.getStorageSync(key)
    return value ? (value as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    uni.setStorageSync(key, value)
  } catch {
    console.warn(`persist failed: ${key}`)
  }
}

function countUsedHints(session: MissionSession) {
  return Object.values(session.hintHistory).reduce((total, item) => total + item.length, 0)
}

function normalizeCode(value: string) {
  return value.replace(/\s+/g, "").toUpperCase()
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isMatchPairArray(value: unknown): value is MatchPair[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "object" && item !== null && "leftId" in item && "rightId" in item)
  )
}

function isReasoningAnswerValue(value: unknown): value is ReasoningAnswerValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "evidenceOrder" in value &&
    "conclusionId" in value &&
    Array.isArray((value as ReasoningAnswerValue).evidenceOrder)
  )
}

function compareAnswer(puzzle: MissionPuzzle, draft: MissionAnswerDraft | null) {
  if (!draft) {
    return false
  }

  if (puzzle.templateType === "observe_choice") {
    return draft.value === puzzle.questionPayload.correctOptionId
  }

  if (puzzle.templateType === "select") {
    if (!isStringArray(draft.value)) {
      return false
    }

    return draft.value.length >= puzzle.questionPayload.minPick
  }

  if (puzzle.templateType === "clue_find") {
    return draft.value === puzzle.questionPayload.correctHotspotId
  }

  if (puzzle.templateType === "sort") {
    if (!isStringArray(draft.value)) {
      return false
    }

    return JSON.stringify(draft.value) === JSON.stringify(puzzle.questionPayload.correctOrder)
  }

  if (puzzle.templateType === "match") {
    if (!isMatchPairArray(draft.value)) {
      return false
    }

    const expected = [...puzzle.questionPayload.correctPairs]
      .sort((left, right) => left.leftId.localeCompare(right.leftId))
      .map((pair) => `${pair.leftId}:${pair.rightId}`)
    const actual = [...draft.value]
      .sort((left, right) => left.leftId.localeCompare(right.leftId))
      .map((pair) => `${pair.leftId}:${pair.rightId}`)

    return JSON.stringify(actual) === JSON.stringify(expected)
  }

  if (puzzle.templateType === "image_puzzle") {
    if (!isStringArray(draft.value)) {
      return false
    }

    return JSON.stringify(draft.value) === JSON.stringify(puzzle.questionPayload.correctOrder)
  }

  if (puzzle.templateType === "story_branch") {
    return draft.value === puzzle.questionPayload.correctOptionId
  }

  if (puzzle.templateType === "multi_step_reasoning") {
    if (!isReasoningAnswerValue(draft.value)) {
      return false
    }

    return (
      JSON.stringify(draft.value.evidenceOrder) === JSON.stringify(puzzle.questionPayload.correctEvidenceOrder) &&
      draft.value.conclusionId === puzzle.questionPayload.correctConclusionId
    )
  }

  if (typeof draft.value !== "string") {
    return false
  }

  return normalizeCode(draft.value) === normalizeCode(puzzle.questionPayload.acceptedCode)
}

function scoreForPuzzle(puzzle: MissionPuzzle, hintCount: number, skipped = false) {
  if (skipped) {
    return 0
  }

  const base = puzzle.difficultyLevel === "L1" ? 12 : puzzle.difficultyLevel === "L2" ? 18 : 24
  return Math.max(base - hintCount * 3, 6)
}

function createArchiveEntry(session: MissionSession, mission: MissionDetail): MissionArchiveEntry {
  return {
    routeId: mission.id,
    routeTitle: mission.title,
    rewardTitle: mission.rewardTitle,
    completedAt: new Date().toISOString(),
    difficultyLabel: getDifficultyLabel(mission.difficultyLevel),
    taskKind: mission.taskKind,
    totalScore: session.totalScore,
    solvedCount: session.solvedChapterIds.length,
    puzzleCount: mission.chapterCount,
    usedHintCount: countUsedHints(session),
  }
}

export const useMissionStore = defineStore("mission", () => {
  const routeCards = shallowRef<MissionRouteCard[]>([])
  const remoteMissionMap = shallowRef<Record<string, MissionDetail>>({})
  const remoteHintTextMap = shallowRef<Record<string, string>>({})
  const detailPending = shallowRef(false)
  const detailError = shallowRef("")
  const gameplayPending = shallowRef(false)
  const gameplayError = shallowRef("")
  const activeSession = ref<MissionSession | null>(readStoredSession())
  const archiveEntries = shallowRef<MissionArchiveEntry[]>(readStorage<MissionArchiveEntry[]>(STORAGE_KEY_ARCHIVE, []))
  const filters = reactive<{
    ageBand: AgeBand | "all"
    difficulty: DifficultyLevel | "all"
    taskKind: TaskKind | "all"
  }>(
    readStorage(STORAGE_KEY_FILTERS, {
      ageBand: "all",
      difficulty: "all",
      taskKind: "all",
    }),
  )

  const hasActiveSession = computed(() => Boolean(activeSession.value))

  const filteredRoutes = computed(() =>
    routeCards.value.filter((route) => {
      const matchAgeBand = filters.ageBand === "all" ? true : route.availableAgeBands.includes(filters.ageBand)
      const matchDifficulty = filters.difficulty === "all" ? true : route.difficultyLevel === filters.difficulty
      const matchTaskKind = filters.taskKind === "all" ? true : route.taskKind === filters.taskKind
      return matchAgeBand && matchDifficulty && matchTaskKind
    }),
  )

  const activeMission = computed(() => {
    if (!activeSession.value) {
      return null
    }

    return remoteMissionMap.value[activeSession.value.routeId] || null
  })

  const currentChapter = computed<MissionChapter | null>(() => {
    if (!activeMission.value || !activeSession.value) {
      return null
    }

    return activeMission.value.chapters[activeSession.value.currentChapterIndex] || null
  })

  const currentPuzzle = computed(() => currentChapter.value?.puzzle ?? null)
  const currentArtifact = computed(() => currentChapter.value?.artifact ?? null)

  const currentHintLevels = computed(() => {
    if (!activeSession.value || !currentPuzzle.value) {
      return [] as HintLevel[]
    }

    return activeSession.value.hintHistory[currentPuzzle.value.id] || []
  })

  const currentHintLevel = computed(() => {
    const used = currentHintLevels.value
    return used.length ? used[used.length - 1] : null
  })

  const currentHintText = computed(() => {
    if (!currentPuzzle.value || !currentHintLevel.value) {
      return ""
    }

    return remoteHintTextMap.value[currentPuzzle.value.id] || currentPuzzle.value.hintPayload[currentHintLevel.value]
  })

  const progressPercent = computed(() => {
    if (!activeMission.value || !activeSession.value) {
      return 0
    }

    return Math.round((activeSession.value.solvedChapterIds.length / activeMission.value.chapterCount) * 100)
  })

  const unlockedClueTitles = computed(() => {
    if (!activeMission.value || !activeSession.value) {
      return [] as string[]
    }

    return activeMission.value.chapters
      .filter((chapter) => activeSession.value?.unlockedClueIds.includes(chapter.puzzle.reward.clueId))
      .map((chapter) => chapter.puzzle.reward.clueTitle)
  })

  const coverageSummary = computed(() => ({
    ageBands: AGE_BAND_OPTIONS.length,
    difficulties: DIFFICULTY_OPTIONS.length,
    taskKinds: TASK_KIND_OPTIONS.length,
    missionCount: routeCards.value.length,
  }))

  function setFilters(payload: Partial<typeof filters>) {
    if (payload.ageBand) {
      filters.ageBand = payload.ageBand
    }

    if (payload.difficulty) {
      filters.difficulty = payload.difficulty
    }

    if (payload.taskKind) {
      filters.taskKind = payload.taskKind
    }
  }

  function getMission(routeId: string) {
    return remoteMissionMap.value[routeId] || null
  }

  function getMissionDraft(puzzleId: string) {
    if (!activeSession.value) {
      return null
    }

    return activeSession.value.draftHistory[puzzleId] || null
  }

  async function loadMissionDetail(routeId: string) {
    const cachedMission = getMission(routeId)
    if (cachedMission) {
      return cachedMission
    }

    detailPending.value = true
    detailError.value = ""

    try {
      const detail = await fetchRouteDetail(routeId)
      const mission = adaptRouteDetailToMission(detail)

      if (!mission) {
        detailError.value = "任务详情数据不完整"
        return null
      }

      remoteMissionMap.value = {
        ...remoteMissionMap.value,
        [mission.id]: mission,
      }

      return mission
    } catch (error) {
      detailError.value = resolveRequestErrorMessage(error, "任务详情加载失败")
      return null
    } finally {
      detailPending.value = false
    }
  }

  async function restoreActiveMission() {
    if (!activeSession.value) {
      return null
    }

    if (remoteMissionMap.value[activeSession.value.routeId]) {
      return remoteMissionMap.value[activeSession.value.routeId]
    }

    gameplayPending.value = true
    gameplayError.value = ""

    try {
      const [detail, stages] = await Promise.all([
        fetchRouteDetail(activeSession.value.routeId),
        fetchGameplayStages(activeSession.value.routeId, activeSession.value.teamId),
      ])
      const mission = adaptRouteDetailToMission(detail, stages)

      if (!mission) {
        gameplayError.value = "任务节点数据不完整"
        return null
      }

      remoteMissionMap.value = {
        ...remoteMissionMap.value,
        [mission.id]: mission,
      }

      const solvedChapterIds = getSolvedStageIds(stages)
      if (solvedChapterIds.length) {
        const firstUnsolvedIndex = mission.chapters.findIndex((chapter) => !solvedChapterIds.includes(chapter.id))
        activeSession.value = {
          ...activeSession.value,
          solvedChapterIds,
          unlockedClueIds: solvedChapterIds.map((id) => `clue-${id}`),
          unlockedRewardIds: solvedChapterIds.map((id) => `fragment-${id}`),
          currentChapterIndex: Math.max(firstUnsolvedIndex, 0),
          status: solvedChapterIds.length >= mission.chapterCount && mission.chapterCount > 0 ? "completed" : "in_progress",
        }
      }

      return mission
    } catch (error) {
      gameplayError.value = resolveRequestErrorMessage(error, "任务恢复失败")
      return null
    } finally {
      gameplayPending.value = false
    }
  }
  async function startRemoteMission(routeId: string, selectedAgeBand?: AgeBand, teamId?: string | null) {
    gameplayPending.value = true
    gameplayError.value = ""

    try {
      const [detail, joinResult, stages] = await Promise.all([
        fetchRouteDetail(routeId),
        joinGameplayRoute(routeId, teamId),
        fetchGameplayStages(routeId, teamId),
      ])
      const mission = adaptRouteDetailToMission(detail, stages)

      if (!mission) {
        gameplayError.value = "任务节点数据不完整"
        return null
      }

      remoteMissionMap.value = {
        ...remoteMissionMap.value,
        [mission.id]: mission,
      }

      const solvedChapterIds = getSolvedStageIds(stages)
      const restoredIndex = resolveCurrentChapterIndex(mission, joinResult)
      const firstUnsolvedIndex = mission.chapters.findIndex((chapter) => !solvedChapterIds.includes(chapter.id))

      activeSession.value = {
        sessionId: joinResult.progressId || `remote-session-${routeId}-${Date.now()}`,
        routeId,
        source: "remote",
        teamId: teamId || null,
        selectedAgeBand: selectedAgeBand || mission.recommendedAgeBand,
        currentChapterIndex: joinResult.currentStageId ? restoredIndex : Math.max(firstUnsolvedIndex, 0),
        solvedChapterIds,
        unlockedClueIds: solvedChapterIds.map((id) => `clue-${id}`),
        unlockedRewardIds: solvedChapterIds.map((id) => `fragment-${id}`),
        hintHistory: {},
        draftHistory: {},
        totalScore: joinResult.myTotalScore ?? 0,
        startedAt: joinResult.startedAt || new Date().toISOString(),
        status: solvedChapterIds.length >= mission.chapterCount && mission.chapterCount > 0 ? "completed" : "in_progress",
        latestChapterResult: null,
      }

      return activeSession.value
    } catch (error) {
      gameplayError.value = resolveRequestErrorMessage(error, "任务开始失败")
      return null
    } finally {
      gameplayPending.value = false
    }
  }

  async function requestHint() {
    if (!activeSession.value || !currentPuzzle.value) {
      return null
    }

    const used = activeSession.value.hintHistory[currentPuzzle.value.id] || []
    const nextLevel = HINT_LEVELS[used.length]

    if (!nextLevel) {
      return null
    }

    if (activeSession.value.source === "remote") {
      try {
        const hints = await fetchStageHints(activeSession.value.routeId, currentPuzzle.value.id, activeSession.value.teamId)
        const sortedHints = [...hints].sort((left, right) => Number(left.sortOrder ?? left.clueNo ?? 0) - Number(right.sortOrder ?? right.clueNo ?? 0))
        const targetHint = sortedHints[used.length] || sortedHints.find((hint) => !hint.isUnlocked) || sortedHints[0]

        if (targetHint?.clueId) {
          const unlocked = targetHint.isUnlocked
            ? { hint: targetHint, message: null }
            : await unlockStageHint({
                routeId: activeSession.value.routeId,
                stageId: currentPuzzle.value.id,
                teamId: activeSession.value.teamId,
                clueId: targetHint.clueId,
                hintId: targetHint.clueId,
              })
          const hintText = unlocked.hint?.content || targetHint.content || unlocked.message || ""

          if (hintText) {
            remoteHintTextMap.value = {
              ...remoteHintTextMap.value,
              [currentPuzzle.value.id]: hintText,
            }
          }
        }
      } catch (error) {
        gameplayError.value = resolveRequestErrorMessage(error, "提示加载失败")
      }
    }

    activeSession.value = {
      ...activeSession.value,
      hintHistory: {
        ...activeSession.value.hintHistory,
        [currentPuzzle.value.id]: [...used, nextLevel],
      },
    }

    return nextLevel
  }

  function saveDraft(draft: MissionAnswerDraft) {
    if (!activeSession.value || !currentPuzzle.value) {
      return
    }

    activeSession.value = {
      ...activeSession.value,
      draftHistory: {
        ...activeSession.value.draftHistory,
        [currentPuzzle.value.id]: draft,
      },
    }
  }

  function finalizeSolve(skipped = false, scoreOverride?: number, narrativeOverride = "") {
    if (!activeSession.value || !activeMission.value || !currentChapter.value || !currentPuzzle.value) {
      return null
    }

    const hints = activeSession.value.hintHistory[currentPuzzle.value.id] || []
    const gainedScore = typeof scoreOverride === "number" ? scoreOverride : scoreForPuzzle(currentPuzzle.value, hints.length, skipped)
    const snapshot = {
      routeId: activeMission.value.id,
      chapterId: currentChapter.value.id,
      chapterTitle: currentChapter.value.title,
      narrative: narrativeOverride || (skipped ? `${currentChapter.value.title} 已跳过。` : currentChapter.value.resultNarrative),
      unlockedClue: currentPuzzle.value.reward,
      gainedScore,
      usedHints: hints,
      perfectClear: !skipped && hints.length === 0,
      finalChapter: activeSession.value.currentChapterIndex === activeMission.value.chapterCount - 1,
    }

    const nextSession: MissionSession = {
      ...activeSession.value,
      totalScore: activeSession.value.totalScore + gainedScore,
      solvedChapterIds: [...new Set([...activeSession.value.solvedChapterIds, currentChapter.value.id])],
      unlockedClueIds: [...new Set([...activeSession.value.unlockedClueIds, currentPuzzle.value.reward.clueId])],
      unlockedRewardIds: [...new Set([...activeSession.value.unlockedRewardIds, currentPuzzle.value.reward.fragmentId])],
      latestChapterResult: snapshot,
      status: snapshot.finalChapter ? "completed" : activeSession.value.status,
    }

    activeSession.value = nextSession

    if (snapshot.finalChapter) {
      const nextEntry = createArchiveEntry(nextSession, activeMission.value)
      archiveEntries.value = [nextEntry, ...archiveEntries.value.filter((item) => item.routeId !== nextEntry.routeId)].slice(0, 8)
    }

    return snapshot
  }

  async function submitCurrentDraft(draft: MissionAnswerDraft) {
    if (!activeSession.value || !currentPuzzle.value) {
      return {
        isCorrect: false,
        message: "当前没有可作答题目。",
        snapshot: null,
      }
    }

    saveDraft(draft)

    if (activeSession.value.source === "remote") {
      gameplayPending.value = true
      gameplayError.value = ""

      try {
        const response = await submitGameplayStage({
          routeId: activeSession.value.routeId,
          stageId: currentPuzzle.value.id,
          teamId: activeSession.value.teamId,
          payload: encodeStageSubmitPayload(currentPuzzle.value, draft.value),
        })

        if (!response.success) {
          return {
            isCorrect: false,
            message: response.message || currentPuzzle.value.failureCopy,
            snapshot: null,
          }
        }

        const snapshot = finalizeSolve(false, response.scoreGained ?? 0, response.message || '')
        if ((response.routeCompleted || response.teamRouteCompleted) && activeSession.value) {
          activeSession.value = {
            ...activeSession.value,
            status: "completed",
          }
        }

        return {
          isCorrect: true,
          message: response.message || currentPuzzle.value.successCopy,
          snapshot,
        }
      } catch (error) {
        gameplayError.value = resolveRequestErrorMessage(error, "答案提交失败")
        return {
          isCorrect: false,
          message: gameplayError.value,
          snapshot: null,
        }
      } finally {
        gameplayPending.value = false
      }
    }

    const isCorrect = compareAnswer(currentPuzzle.value, draft)

    if (!isCorrect) {
      return {
        isCorrect: false,
        message: currentPuzzle.value.failureCopy,
        snapshot: null,
      }
    }

    return {
      isCorrect: true,
      message: currentPuzzle.value.successCopy,
      snapshot: finalizeSolve(false),
    }
  }

  function skipCurrentPuzzle() {
    if (!activeSession.value || !currentPuzzle.value) {
      return null
    }

    if (activeSession.value.source === "remote") {
      gameplayError.value = "在线任务需要完成当前节点后继续。"
      return null
    }

    const used = activeSession.value.hintHistory[currentPuzzle.value.id] || []

    if (!used.includes("direct")) {
      activeSession.value = {
        ...activeSession.value,
        hintHistory: {
          ...activeSession.value.hintHistory,
          [currentPuzzle.value.id]: [...used, "direct"],
        },
      }
    }

    return finalizeSolve(true)
  }

  function advanceFromChapterResult() {
    if (!activeSession.value || !activeSession.value.latestChapterResult) {
      return
    }

    if (!activeSession.value.latestChapterResult.finalChapter) {
      activeSession.value = {
        ...activeSession.value,
        currentChapterIndex: activeSession.value.currentChapterIndex + 1,
        latestChapterResult: null,
      }
    }
  }

  async function replayMission(routeId?: string) {
    const mission = routeId ? getMission(routeId) : activeMission.value

    if (!mission) {
      return null
    }

    return startRemoteMission(mission.id, mission.recommendedAgeBand)
  }

  watch(
    activeSession,
    (value) => {
      writeStorage(STORAGE_KEY_SESSION, value)
    },
    { deep: true },
  )

  watch(
    archiveEntries,
    (value) => {
      writeStorage(STORAGE_KEY_ARCHIVE, value)
    },
    { deep: true },
  )

  watch(
    filters,
    (value) => {
      writeStorage(STORAGE_KEY_FILTERS, value)
    },
    { deep: true },
  )

  return {
    routeCards,
    filteredRoutes,
    filters,
    activeSession,
    activeMission,
    currentChapter,
    currentPuzzle,
    currentArtifact,
    currentHintLevel,
    currentHintText,
    currentHintLevels,
    progressPercent,
    unlockedClueTitles,
    archiveEntries,
    coverageSummary,
    detailPending,
    detailError,
    gameplayPending,
    gameplayError,
    hasActiveSession,
    setFilters,
    getMission,
    loadMissionDetail,
    getMissionDraft,
    startRemoteMission,
    restoreActiveMission,
    requestHint,
    saveDraft,
    submitCurrentDraft,
    skipCurrentPuzzle,
    advanceFromChapterResult,
    replayMission,
  }
})


