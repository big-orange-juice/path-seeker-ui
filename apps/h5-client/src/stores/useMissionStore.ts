import { computed, reactive, shallowRef, watch } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import {
  adaptRouteDetailToMission,
  encodeStageSubmitPayload,
  getSolvedStageIds,
  resolveCurrentChapterIndex,
} from "@/adapters/gameplayMissionAdapter"
import { AGE_BAND_OPTIONS, DIFFICULTY_OPTIONS, TASK_KIND_OPTIONS } from "@/constants/missionSchema"
import {
  fetchGameplayStages,
  fetchRouteDetail,
  fetchRoutePageList,
  fetchStageHints,
  joinGameplayRoute,
  submitGameplayStage,
  unlockStageHint,
} from "@/services/gameplay"
import type {
  RouteCardResponse,
  RoutePageResult,
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
  MissionFilters,
  MissionPuzzle,
  MissionRouteCard,
  MissionSchemaMeta,
  MissionSession,
  ReasoningAnswerValue,
  TaskKind,
} from "@/types/mission"

const AGE_GROUP_FILTER_MAP: Record<AgeBand, number> = {
  "6-10": 2,
  "10-15": 3,
  "15+": 4,
}

const AGE_GROUP_VALUE_MAP: Record<number, AgeBand> = {
  2: "6-10",
  3: "10-15",
  4: "15+",
}

const DIFFICULTY_FILTER_MAP: Record<DifficultyLevel, number> = {
  L1: 1,
  L2: 2,
  L3: 3,
}

const DIFFICULTY_VALUE_MAP: Record<number, DifficultyLevel> = {
  1: "L1",
  2: "L2",
  3: "L3",
}

const TASK_KIND_FILTER_MAP: Record<TaskKind, number> = {
  family_adventure: 1,
  story_detective: 2,
  deep_reasoning: 3,
}

const TASK_KIND_VALUE_MAP: Record<number, TaskKind> = {
  1: "family_adventure",
  2: "story_detective",
  3: "deep_reasoning",
}

const DEFAULT_MUSEUM_ID = String(import.meta.env.VITE_MUSEUM_ID || "345536575083515904").trim()
const HINT_LEVELS: HintLevel[] = ["observe", "relation", "direct"]

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

function defaultFilters(): MissionFilters {
  return {
    ageBand: "all",
    difficulty: "all",
    taskKind: "all",
  }
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim()
}

function resolveAgeBand(ageGroup?: number | null) {
  return AGE_GROUP_VALUE_MAP[ageGroup || 0] ?? "10-15"
}

function resolveDifficultyLevel(level?: number | null) {
  return DIFFICULTY_VALUE_MAP[level || 0] ?? "L2"
}

function resolveTaskKind(scaleType?: number | null) {
  return TASK_KIND_VALUE_MAP[scaleType || 0] ?? "story_detective"
}

function buildTaglines(route: RouteCardResponse) {
  const taglines: string[] = []

  if ((route.allowTeam ?? 0) === 1) {
    taglines.push("支持组队")
  }

  return taglines
}

function adaptRemoteRoute(route: RouteCardResponse): MissionRouteCard | null {
  const id = normalizeText(route.id)
  const title = normalizeText(route.title)

  if (!id || !title) {
    return null
  }

  const recommendedAgeBand = resolveAgeBand(route.ageGroup)
  const difficultyLevel = resolveDifficultyLevel(route.difficultyLevel)
  const taskKind = resolveTaskKind(route.scaleType)
  const puzzleCount = route.puzzleCount ?? 0
  const schemaMeta: MissionSchemaMeta = {
    ageGroup: route.ageGroup ?? AGE_GROUP_FILTER_MAP[recommendedAgeBand],
    difficultyLevel: route.difficultyLevel ?? DIFFICULTY_FILTER_MAP[difficultyLevel],
    scaleType: route.scaleType ?? TASK_KIND_FILTER_MAP[taskKind],
  }

  return {
    id,
    hallId: normalizeText(route.museumId),
    routeCode: normalizeText(route.routeCode) || title,
    title,
    theme: normalizeText(route.theme),
    summary: normalizeText(route.intro),
    highlight: "",
    recommendedAgeBand,
    availableAgeBands: [recommendedAgeBand],
    difficultyLevel,
    taskKind,
    estimatedMinutes: route.estimatedMinutes ?? 0,
    totalScore: route.totalScore ?? 0,
    puzzleCount,
    chapterCount: puzzleCount,
    allowTeam: (route.allowTeam ?? 0) === 1,
    rewardTitle: normalizeText(route.rewardTitle),
    startLocation: "",
    badgeLabel: route.publishStatus === 2 ? "已发布" : "",
    persona: {
      id: normalizeText(route.persona?.id ?? route.personaId),
      code: normalizeText(route.persona?.personaCode),
      name: normalizeText(route.persona?.name),
      intro: "",
      avatar: normalizeText(route.persona?.avatarUrl),
      voiceStyle: "",
    },
    taglines: buildTaglines(route),
    schemaMeta,
  }
}

function resolveRouteList(response: RoutePageResult | unknown): RouteCardResponse[] {
  const source = response && typeof response === "object" ? (response as Record<string, unknown>) : {}
  const candidate = source.list ?? source.items ?? source.records ?? []

  if (Array.isArray(candidate)) {
    return candidate as RouteCardResponse[]
  }

  if (candidate && typeof candidate === "object" && Array.isArray((candidate as { $values?: unknown[] }).$values)) {
    return (candidate as { $values: RouteCardResponse[] }).$values
  }

  return []
}

function resolveTotal(response: RoutePageResult | unknown, fallback: number) {
  if (!response || typeof response !== "object") {
    return fallback
  }

  const value = (response as RoutePageResult).total
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export const useMissionStore = defineStore(
  "mission",
  () => {
    const routeCards = shallowRef<MissionRouteCard[]>([])
    const missionMap = shallowRef<Record<string, MissionDetail>>({})
    const remoteHintTextMap = shallowRef<Record<string, string>>({})
    const detailPending = shallowRef(false)
    const detailError = shallowRef("")
    const routeListPending = shallowRef(false)
    const routeListError = shallowRef("")
    const routeTotal = shallowRef(0)
    const gameplayPending = shallowRef(false)
    const gameplayError = shallowRef("")
    const activeSession = shallowRef<MissionSession | null>(null)
    const archiveEntries = shallowRef<MissionArchiveEntry[]>([])
    const filters = reactive<MissionFilters>(defaultFilters())

    const hasActiveSession = computed(() => Boolean(activeSession.value))

    const filteredRoutes = computed(() =>
      routeCards.value.filter((route) => {
        const ageMatched = filters.ageBand === "all" || route.availableAgeBands.includes(filters.ageBand)
        const difficultyMatched = filters.difficulty === "all" || route.difficultyLevel === filters.difficulty
        const taskKindMatched = filters.taskKind === "all" || route.taskKind === filters.taskKind
        return ageMatched && difficultyMatched && taskKindMatched
      }),
    )

    const activeMission = computed(() => {
      if (!activeSession.value) {
        return null
      }

      return missionMap.value[activeSession.value.routeId] || null
    })

    const currentChapter = computed<MissionChapter | null>(() => {
      if (!activeMission.value || !activeSession.value) {
        return null
      }

      return activeMission.value.chapters[activeSession.value.currentChapterIndex] || null
    })

    const currentPuzzle = computed(() => currentChapter.value?.puzzle ?? null)
    const currentArtifact = computed(() => currentChapter.value?.artifact ?? null)
    const currentChapterSolved = computed(() => {
      if (!activeSession.value || !currentChapter.value) {
        return false
      }

      return activeSession.value.solvedChapterIds.includes(currentChapter.value.id)
    })

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

    const coverageSummary = computed(() => ({
      ageBands: AGE_BAND_OPTIONS.length,
      difficulties: DIFFICULTY_OPTIONS.length,
      taskKinds: TASK_KIND_OPTIONS.length,
      missionCount: routeCards.value.length,
      archiveCount: archiveEntries.value.length,
      hasActiveSession: hasActiveSession.value,
    }))

    const unlockedClueTitles = computed(() => {
      if (!activeMission.value || !activeSession.value) {
        return [] as string[]
      }

      return activeMission.value.chapters
        .filter((chapter) => activeSession.value?.unlockedClueIds.includes(chapter.puzzle.reward.clueId))
        .map((chapter) => chapter.puzzle.reward.clueTitle)
    })

    function getMission(routeId: string) {
      return missionMap.value[routeId] || null
    }

    function getMissionDraft(puzzleId: string) {
      if (!activeSession.value) {
        return null
      }

      return activeSession.value.draftHistory[puzzleId] || null
    }

    function setFilters(payload: Partial<MissionFilters>) {
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

    function resetFilters() {
      Object.assign(filters, defaultFilters())
    }

    async function loadRouteCards() {
      routeListPending.value = true
      routeListError.value = ""

      try {
        const response = await fetchRoutePageList({
          pageIndex: 1,
          pageSize: 100,
          museumId: DEFAULT_MUSEUM_ID || null,
          scaleType: filters.taskKind === "all" ? null : TASK_KIND_FILTER_MAP[filters.taskKind],
          difficultyLevel: filters.difficulty === "all" ? null : DIFFICULTY_FILTER_MAP[filters.difficulty],
          ageGroup: filters.ageBand === "all" ? null : AGE_GROUP_FILTER_MAP[filters.ageBand],
          publishStatus: 2,
          auditStatus: null,
          keyword: null,
        })

        const nextRoutes = resolveRouteList(response)
          .map(adaptRemoteRoute)
          .filter((route): route is MissionRouteCard => Boolean(route))

        routeCards.value = nextRoutes
        routeTotal.value = resolveTotal(response, nextRoutes.length)
      } catch (error) {
        routeCards.value = []
        routeTotal.value = 0
        routeListError.value = resolveRequestErrorMessage(error, "任务列表加载失败")
      } finally {
        routeListPending.value = false
      }
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

        missionMap.value = {
          ...missionMap.value,
          [mission.id]: mission,
        }

        if (!routeCards.value.find((item) => item.id === mission.id)) {
          routeCards.value = [mission, ...routeCards.value]
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

        missionMap.value = {
          ...missionMap.value,
          [mission.id]: mission,
        }

        const solvedChapterIds = getSolvedStageIds(stages)
        const firstUnsolvedIndex = mission.chapters.findIndex((chapter) => !solvedChapterIds.includes(chapter.id))

        activeSession.value = {
          ...activeSession.value,
          routeTitle: mission.title,
          solvedChapterIds,
          unlockedClueIds: solvedChapterIds.map((id) => `clue-${id}`),
          unlockedRewardIds: solvedChapterIds.map((id) => `fragment-${id}`),
          currentChapterIndex: Math.max(firstUnsolvedIndex, 0),
          status: solvedChapterIds.length >= mission.chapterCount && mission.chapterCount > 0 ? "completed" : "in_progress",
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

        missionMap.value = {
          ...missionMap.value,
          [mission.id]: mission,
        }

        const solvedChapterIds = getSolvedStageIds(stages)
        const restoredIndex = resolveCurrentChapterIndex(mission, joinResult)
        const firstUnsolvedIndex = mission.chapters.findIndex((chapter) => !solvedChapterIds.includes(chapter.id))

        const nextSession: MissionSession = {
          sessionId: joinResult.progressId || `remote-session-${routeId}-${Date.now()}`,
          routeId,
          routeTitle: mission.title,
          source: "remote",
          teamId: teamId || null,
          selectedAgeBand: selectedAgeBand || mission.recommendedAgeBand,
          currentChapterIndex: joinResult.currentStageId ? restoredIndex : Math.max(firstUnsolvedIndex, 0),
          solvedChapterIds,
          unlockedClueIds: solvedChapterIds.map((id) => `clue-${id}`),
          unlockedRewardIds: solvedChapterIds.map((id) => `fragment-${id}`),
          hintHistory: activeSession.value?.routeId === routeId ? activeSession.value.hintHistory : {},
          draftHistory: activeSession.value?.routeId === routeId ? activeSession.value.draftHistory : {},
          totalScore: joinResult.myTotalScore ?? 0,
          startedAt: joinResult.startedAt || new Date().toISOString(),
          status: solvedChapterIds.length >= mission.chapterCount && mission.chapterCount > 0 ? "completed" : "in_progress",
          latestChapterResult: null,
        }

        activeSession.value = nextSession

        if (nextSession.status === "completed") {
          const nextEntry = createArchiveEntry(nextSession, mission)
          archiveEntries.value = [nextEntry, ...archiveEntries.value.filter((item) => item.routeId !== nextEntry.routeId)].slice(0, 20)
        }

        return nextSession
      } catch (error) {
        gameplayError.value = resolveRequestErrorMessage(error, "任务开始失败")
        return null
      } finally {
        gameplayPending.value = false
      }
    }

    function selectChapter(index: number) {
      if (!activeSession.value || !activeMission.value) {
        return false
      }

      if (index < 0 || index >= activeMission.value.chapters.length) {
        return false
      }

      activeSession.value = {
        ...activeSession.value,
        currentChapterIndex: index,
      }

      return true
    }

    function clearActiveSession() {
      activeSession.value = null
    }

    function resolveResumeRoutePath() {
      if (!activeSession.value || !activeMission.value || !currentChapter.value) {
        return null
      }

      if (activeSession.value.status === "completed" || activeSession.value.latestChapterResult?.finalChapter) {
        return `/missions/${activeSession.value.routeId}/finale`
      }

      if (activeSession.value.latestChapterResult?.chapterId) {
        return `/missions/${activeSession.value.routeId}/chapters/${activeSession.value.latestChapterResult.chapterId}/result`
      }

      const hasProgressArtifacts =
        Object.keys(activeSession.value.draftHistory).length > 0
        || Object.keys(activeSession.value.hintHistory).length > 0

      if (
        activeMission.value.prologue.length > 0
        && activeSession.value.solvedChapterIds.length === 0
        && activeSession.value.currentChapterIndex === 0
        && !hasProgressArtifacts
      ) {
        return `/missions/${activeSession.value.routeId}/prologue`
      }

      if (getMissionDraft(currentChapter.value.puzzle.id) || currentHintLevels.value.length > 0) {
        return `/missions/${activeSession.value.routeId}/chapters/${currentChapter.value.id}/puzzle`
      }

      return `/missions/${activeSession.value.routeId}/chapters/${currentChapter.value.id}/clue`
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
      const wasSolved = activeSession.value.solvedChapterIds.includes(currentChapter.value.id)
      const calculatedScore = typeof scoreOverride === "number" ? scoreOverride : scoreForPuzzle(currentPuzzle.value, hints.length, skipped)
      const gainedScore = wasSolved ? 0 : calculatedScore
      const nextSolvedChapterIds = [...new Set([...activeSession.value.solvedChapterIds, currentChapter.value.id])]
      const nextUnlockedClueIds = [...new Set([...activeSession.value.unlockedClueIds, currentPuzzle.value.reward.clueId])]
      const nextUnlockedRewardIds = [...new Set([...activeSession.value.unlockedRewardIds, currentPuzzle.value.reward.fragmentId])]
      const routeCompleted = nextSolvedChapterIds.length >= activeMission.value.chapterCount && activeMission.value.chapterCount > 0
      const snapshot = {
        routeId: activeMission.value.id,
        chapterId: currentChapter.value.id,
        chapterTitle: currentChapter.value.title,
        narrative: narrativeOverride || (skipped ? `${currentChapter.value.title} 已跳过。` : currentChapter.value.resultNarrative),
        unlockedClue: currentPuzzle.value.reward,
        gainedScore,
        usedHints: hints,
        perfectClear: !skipped && hints.length === 0,
        finalChapter: routeCompleted,
      }

      const nextSession: MissionSession = {
        ...activeSession.value,
        totalScore: activeSession.value.totalScore + gainedScore,
        solvedChapterIds: nextSolvedChapterIds,
        unlockedClueIds: nextUnlockedClueIds,
        unlockedRewardIds: nextUnlockedRewardIds,
        latestChapterResult: snapshot,
        status: routeCompleted ? "completed" : activeSession.value.status,
      }

      activeSession.value = nextSession

      if (routeCompleted) {
        const nextEntry = createArchiveEntry(nextSession, activeMission.value)
        archiveEntries.value = [nextEntry, ...archiveEntries.value.filter((item) => item.routeId !== nextEntry.routeId)].slice(0, 20)
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

        const snapshot = finalizeSolve(false, response.scoreGained ?? 0, response.message || "")
        if ((response.routeCompleted || response.teamRouteCompleted) && activeSession.value) {
          const latestChapterResult = snapshot ? { ...snapshot, finalChapter: true } : activeSession.value.latestChapterResult
          activeSession.value = {
            ...activeSession.value,
            latestChapterResult,
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

    function advanceFromChapterResult() {
      if (!activeSession.value || !activeMission.value || !activeSession.value.latestChapterResult) {
        return false
      }

      if (activeSession.value.latestChapterResult.finalChapter) {
        activeSession.value = {
          ...activeSession.value,
          currentChapterIndex: Math.max(activeMission.value.chapterCount - 1, 0),
        }
        return true
      }

      const currentIndex = activeMission.value.chapters.findIndex((chapter) => chapter.id === activeSession.value?.latestChapterResult?.chapterId)
      const nextIndex = activeMission.value.chapters.findIndex((chapter, index) => index > currentIndex && !activeSession.value?.solvedChapterIds.includes(chapter.id))

      activeSession.value = {
        ...activeSession.value,
        currentChapterIndex: nextIndex >= 0 ? nextIndex : Math.min(currentIndex + 1, activeMission.value.chapterCount - 1),
      }

      return true
    }

    async function replayMission(routeId: string) {
      const mission = getMission(routeId) || await loadMissionDetail(routeId)
      if (!mission) {
        return null
      }

      return startRemoteMission(routeId, mission.recommendedAgeBand)
    }

    watch(
      () => ({ ...filters }),
      () => {
        void loadRouteCards()
      },
      { immediate: true, deep: true },
    )

    return {
      routeCards,
      missionMap,
      filteredRoutes,
      filters,
      activeSession,
      activeMission,
      currentChapter,
      currentPuzzle,
      currentArtifact,
      currentChapterSolved,
      currentHintLevels,
      currentHintLevel,
      currentHintText,
      progressPercent,
      archiveEntries,
      coverageSummary,
      unlockedClueTitles,
      detailPending,
      detailError,
      routeListPending,
      routeListError,
      routeTotal,
      gameplayPending,
      gameplayError,
      hasActiveSession,
      getMission,
      getMissionDraft,
      setFilters,
      resetFilters,
      loadRouteCards,
      loadMissionDetail,
      restoreActiveMission,
      startRemoteMission,
      selectChapter,
      clearActiveSession,
      resolveResumeRoutePath,
      requestHint,
      saveDraft,
      submitCurrentDraft,
      advanceFromChapterResult,
      replayMission,
    }
  },
  {
    persist: {
      key: "path-seeker:h5-client:mission",
      pick: ["activeSession", "archiveEntries", "filters"],
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMissionStore, import.meta.hot))
}
