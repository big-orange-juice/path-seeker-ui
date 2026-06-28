import { computed, reactive, ref, shallowRef, watch } from "vue"
import { defineStore } from "pinia"
import { MOCK_MISSION_MAP, MOCK_MISSIONS, MOCK_ROUTE_CARDS } from "@/mock/missions"
import { AGE_BAND_OPTIONS, DIFFICULTY_OPTIONS, TASK_KIND_OPTIONS } from "@/mock/schema"
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
  MissionSession,
  ShellTab,
  TaskKind,
} from "@/types/mission"

const STORAGE_KEY_SESSION = "path-seeker:mission-session"
const STORAGE_KEY_ARCHIVE = "path-seeker:mission-archive"
const STORAGE_KEY_FILTERS = "path-seeker:mission-filters"

const HINT_LEVELS: HintLevel[] = ["observe", "relation", "direct"]

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

function compareAnswer(puzzle: MissionPuzzle, draft: MissionAnswerDraft | null) {
  if (!draft) {
    return false
  }

  if (puzzle.templateType === "observe_choice") {
    return draft.value === puzzle.questionPayload.correctOptionId
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
    selectedAgeBand: session.selectedAgeBand,
    taskKind: mission.taskKind,
    totalScore: session.totalScore,
    solvedCount: session.solvedChapterIds.length,
    puzzleCount: mission.chapterCount,
    usedHintCount: countUsedHints(session),
  }
}

export const useMissionStore = defineStore("mission", () => {
  const missions = shallowRef(MOCK_MISSIONS)
  const routeCards = shallowRef(MOCK_ROUTE_CARDS)
  const activeShellTab = shallowRef<ShellTab>("hall")
  const activeSession = ref<MissionSession | null>(readStorage<MissionSession | null>(STORAGE_KEY_SESSION, null))
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
      const matchDifficulty = filters.difficulty === "all" ? true : route.difficultyLevel === filters.difficulty
      return matchDifficulty
    }),
  )

  const activeMission = computed(() => {
    if (!activeSession.value) {
      return null
    }

    return MOCK_MISSION_MAP[activeSession.value.routeId] || null
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

    return currentPuzzle.value.hintPayload[currentHintLevel.value]
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
    missionCount: missions.value.length,
  }))

  function setShellTab(tab: ShellTab) {
    activeShellTab.value = tab
  }

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
    return MOCK_MISSION_MAP[routeId] || null
  }

  function getMissionDraft(puzzleId: string) {
    if (!activeSession.value) {
      return null
    }

    return activeSession.value.draftHistory[puzzleId] || null
  }

  function startMission(routeId: string, selectedAgeBand: AgeBand) {
    const mission = getMission(routeId)

    if (!mission) {
      return null
    }

    activeSession.value = {
      sessionId: `session-${routeId}-${Date.now()}`,
      routeId,
      selectedAgeBand,
      currentChapterIndex: 0,
      solvedChapterIds: [],
      unlockedClueIds: [],
      unlockedRewardIds: [],
      hintHistory: {},
      draftHistory: {},
      totalScore: 0,
      startedAt: new Date().toISOString(),
      status: "in_progress",
      latestChapterResult: null,
    }

    activeShellTab.value = "playing"
    return activeSession.value
  }

  function requestHint() {
    if (!activeSession.value || !currentPuzzle.value) {
      return null
    }

    const used = activeSession.value.hintHistory[currentPuzzle.value.id] || []
    const nextLevel = HINT_LEVELS[used.length]

    if (!nextLevel) {
      return null
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

  function finalizeSolve(skipped = false) {
    if (!activeSession.value || !activeMission.value || !currentChapter.value || !currentPuzzle.value) {
      return null
    }

    const hints = activeSession.value.hintHistory[currentPuzzle.value.id] || []
    const gainedScore = scoreForPuzzle(currentPuzzle.value, hints.length, skipped)
    const snapshot = {
      routeId: activeMission.value.id,
      chapterId: currentChapter.value.id,
      chapterTitle: currentChapter.value.title,
      narrative: skipped
        ? `${currentChapter.value.title} 已跳过，你仍然拿到了基础情报，但本章不计完美通关。`
        : currentChapter.value.resultNarrative,
      unlockedClue: currentPuzzle.value.reward,
      gainedScore,
      usedHints: hints,
      perfectClear: !skipped && hints.length === 0,
      finalChapter: activeSession.value.currentChapterIndex === activeMission.value.chapterCount - 1,
    }

    const nextSession: MissionSession = {
      ...activeSession.value,
      totalScore: activeSession.value.totalScore + gainedScore,
      solvedChapterIds: [...activeSession.value.solvedChapterIds, currentChapter.value.id],
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

  function submitCurrentDraft(draft: MissionAnswerDraft) {
    if (!activeSession.value || !currentPuzzle.value) {
      return {
        isCorrect: false,
        message: "当前没有可作答题目。",
        snapshot: null,
      }
    }

    saveDraft(draft)

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

  function replayMission(routeId?: string) {
    const mission = routeId ? getMission(routeId) : activeMission.value

    if (!mission) {
      return null
    }

    return startMission(mission.id, mission.recommendedAgeBand)
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
    missions,
    filteredRoutes,
    filters,
    activeShellTab,
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
    hasActiveSession,
    setShellTab,
    setFilters,
    getMission,
    getMissionDraft,
    startMission,
    requestHint,
    saveDraft,
    submitCurrentDraft,
    skipCurrentPuzzle,
    advanceFromChapterResult,
    replayMission,
  }
})



