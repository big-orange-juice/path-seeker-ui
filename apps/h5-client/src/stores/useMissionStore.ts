import { computed, reactive, shallowRef, watch } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import {
  advanceSessionAfterChapterResult,
  finalizeSessionAfterSolve,
  resolveResumeRoutePath as resolveRuntimeResumeRoutePath,
} from "@path-seeker/game-runtime"
import {
  adaptRouteDetailToMission,
  encodeStageSubmitPayload,
  getSolvedStageIds,
  resolveCurrentChapterIndex,
} from "@/adapters/gameplayMissionAdapter"
import {
  adaptRemoteRouteCard,
  appendArchiveEntry,
  buildRoutePageQuery,
  buildMissionSubmitResult,
  buildMissionArchiveEntry,
  resolveRouteList,
  resolveRouteTotal,
  resolveStageHintTarget,
  resolveUnlockedHintText,
  shouldMarkRouteCompleted,
} from "@/adapters/missionGameplayAdapter"
import {
  buildRestoredMissionSession,
  buildStartedMissionSession,
  sanitizeMissionHintTextMap,
} from "@/adapters/missionSessionAdapter"
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
import { resolveRequestErrorMessage } from "@/services/http"
import { getDifficultyLabel } from "@/utils/puzzleLabels"
import type {
  AgeBand,
  HintLevel,
  MissionAnswerDraft,
  MissionArchiveEntry,
  MissionChapter,
  MissionDetail,
  MissionFilters,
  MissionRouteCard,
  MissionSession,
} from "@/types/mission"

const DEFAULT_MUSEUM_ID = String(import.meta.env.VITE_MUSEUM_ID || "345536575083515904").trim()
const HINT_LEVELS: HintLevel[] = ["observe", "relation", "direct"]

function defaultFilters(): MissionFilters {
  return {
    ageBand: "all",
    difficulty: "all",
    taskKind: "all",
  }
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
        const response = await fetchRoutePageList(
          buildRoutePageQuery({
            museumId: DEFAULT_MUSEUM_ID,
            ageBand: filters.ageBand,
            difficulty: filters.difficulty,
            taskKind: filters.taskKind,
          }),
        )

        const nextRoutes = resolveRouteList(response)
          .map(adaptRemoteRouteCard)
          .filter((route): route is MissionRouteCard => Boolean(route))

        routeCards.value = nextRoutes
        routeTotal.value = resolveRouteTotal(response, nextRoutes.length)
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
        remoteHintTextMap.value = sanitizeMissionHintTextMap(
          remoteHintTextMap.value,
          mission,
          solvedChapterIds,
        )

        activeSession.value = buildRestoredMissionSession(activeSession.value, mission, solvedChapterIds)

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
        const preferredChapterIndex = joinResult.currentStageId ? restoredIndex : undefined
        const nextSession = buildStartedMissionSession({
          routeId,
          mission,
          joinResult,
          solvedChapterIds,
          selectedAgeBand,
          teamId,
          previousSession: activeSession.value,
          preferredChapterIndex,
        })

        activeSession.value = nextSession
        remoteHintTextMap.value = activeSession.value?.routeId === routeId
          ? sanitizeMissionHintTextMap(remoteHintTextMap.value, mission, solvedChapterIds)
          : {}

        if (nextSession.status === "completed") {
          const nextEntry = buildMissionArchiveEntry(nextSession, mission, getDifficultyLabel(mission.difficultyLevel))
          archiveEntries.value = appendArchiveEntry(archiveEntries.value, nextEntry)
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

    function getNextUnsolvedChapter(afterChapterId?: string) {
      if (!activeMission.value || !activeSession.value) {
        return null
      }

      const currentId = afterChapterId || currentChapter.value?.id || ""
      const currentIndex = activeMission.value.chapters.findIndex((chapter) => chapter.id === currentId)
      const chapters = activeMission.value.chapters

      const nextChapter = chapters.find(
        (chapter, index) => index > currentIndex && !activeSession.value?.solvedChapterIds.includes(chapter.id),
      )

      if (nextChapter) {
        return nextChapter
      }

      return chapters.find((chapter) => !activeSession.value?.solvedChapterIds.includes(chapter.id)) || null
    }

    function clearActiveSession() {
      activeSession.value = null
    }

    function resolveResumeRoutePath() {
      if (!activeSession.value || !activeMission.value || !currentChapter.value) {
        return null
      }

      return resolveRuntimeResumeRoutePath({
        session: activeSession.value,
        mission: activeMission.value,
        chapter: currentChapter.value,
        currentPuzzleId: currentChapter.value.puzzle.id,
        currentHintLevels: currentHintLevels.value,
        hasDraft: Boolean(getMissionDraft(currentChapter.value.puzzle.id)),
      })
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
        const targetHint = resolveStageHintTarget(hints, used.length)

        if (!targetHint?.clueId) {
          gameplayError.value = "当前节点暂时没有可用提示。"
          return null
        }

        const unlocked = targetHint.isUnlocked
          ? { hint: targetHint, message: null }
          : await unlockStageHint({
              routeId: activeSession.value.routeId,
              stageId: currentPuzzle.value.id,
              teamId: activeSession.value.teamId,
              clueId: targetHint.clueId,
              hintId: targetHint.clueId,
            })
        const hintText = resolveUnlockedHintText(unlocked, targetHint)

        if (!hintText) {
          gameplayError.value = "提示内容暂时不可用。"
          return null
        }

        remoteHintTextMap.value = {
          ...remoteHintTextMap.value,
          [currentPuzzle.value.id]: hintText,
        }
      } catch (error) {
        gameplayError.value = resolveRequestErrorMessage(error, "提示加载失败")
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

    function clearCurrentPuzzleDraft() {
      if (!activeSession.value || !currentPuzzle.value) {
        return
      }

      const nextDraftHistory = {
        ...activeSession.value.draftHistory,
      }

      delete nextDraftHistory[currentPuzzle.value.id]

      activeSession.value = {
        ...activeSession.value,
        draftHistory: nextDraftHistory,
      }
    }

    function finalizeSolve(skipped = false, scoreOverride?: number, narrativeOverride = "") {
      if (!activeSession.value || !activeMission.value || !currentChapter.value || !currentPuzzle.value) {
        return null
      }

      const hints = activeSession.value.hintHistory[currentPuzzle.value.id] || []
      const { nextSession, routeCompleted, snapshot } = finalizeSessionAfterSolve({
        session: activeSession.value,
        mission: activeMission.value,
        chapter: currentChapter.value,
        hintLevels: hints,
        skipped,
        scoreOverride,
        narrativeOverride,
      })

      activeSession.value = nextSession

      if (routeCompleted) {
        const nextEntry = buildMissionArchiveEntry(nextSession, activeMission.value, getDifficultyLabel(activeMission.value.difficultyLevel))
        archiveEntries.value = appendArchiveEntry(archiveEntries.value, nextEntry)
      }

      return snapshot
    }

    async function submitCurrentDraft(draft: MissionAnswerDraft) {
      if (!activeSession.value || !currentPuzzle.value) {
        return buildMissionSubmitResult(false, "当前没有可作答题目。", null)
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
          return buildMissionSubmitResult(false, response.message || currentPuzzle.value.failureCopy, null)
        }

        const snapshot = finalizeSolve(false, response.scoreGained ?? 0, response.message || "")
        clearCurrentPuzzleDraft()
        if (shouldMarkRouteCompleted(response) && activeSession.value) {
          const latestChapterResult = snapshot ? { ...snapshot, finalChapter: true } : activeSession.value.latestChapterResult
          activeSession.value = {
            ...activeSession.value,
            latestChapterResult,
            status: "completed",
          }
        }

        return buildMissionSubmitResult(true, response.message || currentPuzzle.value.successCopy, snapshot)
      } catch (error) {
        gameplayError.value = resolveRequestErrorMessage(error, "答案提交失败")
        return buildMissionSubmitResult(false, gameplayError.value, null)
      } finally {
        gameplayPending.value = false
      }
    }

    function advanceFromChapterResult() {
      if (!activeSession.value || !activeMission.value || !activeSession.value.latestChapterResult) {
        return false
      }

      const { advanced, nextSession } = advanceSessionAfterChapterResult(activeSession.value, activeMission.value)
      activeSession.value = nextSession

      return advanced
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
      getNextUnsolvedChapter,
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
