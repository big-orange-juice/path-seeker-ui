import { computed, reactive, shallowRef, watch } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import {
  advanceSessionAfterChapterResult,
  finalizeSessionAfterSolve,
} from "@path-seeker/game-runtime"
import { useCinemaStore } from "@/stores/useCinemaStore"
import {
  adaptRouteDetailToMission,
  adaptRouteResult,
  collectChapterExhibitIds,
  encodeStageSubmitPayload,
  enrichMissionWithExhibits,
  isRouteProgressCompleted,
  resolveCurrentChapterIndex,
  resolveSolvedChapterIds,
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
  buildChapterProgressMap,
  buildRestoredMissionSession,
  buildStartedMissionSession,
  getChapterGateProgress,
  resolveChapterEnterPath,
  resolveMissionResumePath,
  sanitizeMissionHintTextMap,
} from "@/adapters/missionSessionAdapter"
import { AGE_BAND_OPTIONS, DIFFICULTY_OPTIONS, TASK_KIND_OPTIONS } from "@/constants/missionSchema"
import {
  fetchExhibit,
  fetchGameplayStages,
  fetchMyRouteProgress,
  fetchRouteDetail,
  fetchRoutePageList,
  fetchRouteResult,
  fetchStageHints,
  joinGameplayRoute,
  recordRouteActivity,
  ROUTE_ACTIVITY_TYPE,
  submitGameplayStage,
  unlockStageHint,
  type ExhibitResponse,
  type MyRouteProgressResponse,
  type StagePlayResponse,
} from "@/services/gameplay"
import { resolveRequestErrorMessage } from "@/services/http"
import { getDifficultyLabel } from "@/utils/puzzleLabels"
import type {
  AgeBand,
  ChapterGateProgress,
  HintLevel,
  MissionAnswerDraft,
  MissionArchiveEntry,
  MissionChapter,
  MissionDetail,
  MissionFilters,
  MissionRouteCard,
  MissionRouteResult,
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
    const routeResultPending = shallowRef(false)
    const routeResultError = shallowRef("")
    const routeResult = shallowRef<MissionRouteResult | null>(null)
    const activeSession = shallowRef<MissionSession | null>(null)
    const archiveEntries = shallowRef<MissionArchiveEntry[]>([])
    const filters = reactive<MissionFilters>(defaultFilters())
    /** 展品缓存，避免同一路线重复拉 Exhibit/Get */
    const exhibitCache = shallowRef<Record<string, ExhibitResponse | null>>({})

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

    function putMission(mission: MissionDetail) {
      missionMap.value = {
        ...missionMap.value,
        [mission.id]: mission,
      }

      if (!routeCards.value.find((item) => item.id === mission.id)) {
        routeCards.value = [mission, ...routeCards.value]
      }
    }

    /**
     * 可选：用 Exhibit/Get 补位置与短视频。
     * 失败不阻断主链路；仅回填可展示字段。
     */
    async function enrichMissionExhibits(mission: MissionDetail) {
      const exhibitIds = collectChapterExhibitIds(mission)
      if (!exhibitIds.length) {
        return mission
      }

      const missingIds = exhibitIds.filter((id) => !(id in exhibitCache.value))
      if (missingIds.length) {
        const settled = await Promise.allSettled(
          missingIds.map(async (id) => {
            const exhibit = await fetchExhibit(id)
            return { id, exhibit }
          }),
        )

        const nextCache = { ...exhibitCache.value }
        settled.forEach((result, index) => {
          const id = missingIds[index]
          if (result.status === "fulfilled") {
            nextCache[id] = result.value.exhibit
          } else {
            nextCache[id] = null
          }
        })
        exhibitCache.value = nextCache
      }

      const exhibitMap: Record<string, ExhibitResponse | null | undefined> = {}
      exhibitIds.forEach((id) => {
        exhibitMap[id] = exhibitCache.value[id]
      })

      const enriched = enrichMissionWithExhibits(mission, exhibitMap)
      putMission(enriched)
      return enriched
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
        // 列表筛选较频繁，不用全屏 cinema；任务主链路接口才走 cinema loading
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
      const cinema = useCinemaStore()

      try {
        const detail = await cinema.withLoading(
          () => fetchRouteDetail(routeId),
          { label: "打开任务", effect: "swirl" },
        )
        let mission = adaptRouteDetailToMission(detail)

        if (!mission) {
          detailError.value = "任务详情数据不完整"
          return null
        }

        putMission(mission)
        // 详情页可先展示，展品补全异步进行
        mission = await enrichMissionExhibits(mission)
        return mission
      } catch (error) {
        detailError.value = resolveRequestErrorMessage(error, "任务详情加载失败")
        return null
      } finally {
        detailPending.value = false
      }
    }

    /**
     * 恢复进度：MyRouteProgress 为权威源（分数/当前站/已解），
     * Stages ⊕ Detail.nodes 构建可玩章节；可选 Exhibit 补位置/视频。
     */
    async function restoreActiveMission() {
      if (!activeSession.value) {
        return null
      }

      gameplayPending.value = true
      gameplayError.value = ""
      const cinema = useCinemaStore()
      const session = activeSession.value
      const lastSolved = session.solvedChapterIds[session.solvedChapterIds.length - 1] || null
      void recordStageActivity(session.routeId, lastSolved, "resume")

      try {
        const { detail, stages, progress } = await cinema.withLoading(
          async () => {
            const [detailRes, stagesRes, progressRes] = await Promise.all([
              fetchRouteDetail(session.routeId),
              fetchGameplayStages(session.routeId, session.teamId),
              fetchMyRouteProgress(session.routeId, session.teamId).catch(() => null as MyRouteProgressResponse | null),
            ])
            return {
              detail: detailRes,
              stages: stagesRes as StagePlayResponse[],
              progress: progressRes,
            }
          },
          { label: "恢复进度", effect: "cinema" },
        )
        let mission = adaptRouteDetailToMission(detail, stages)

        if (!mission) {
          gameplayError.value = "任务节点数据不完整"
          return null
        }

        putMission(mission)
        mission = await enrichMissionExhibits(mission)

        const solvedChapterIds = resolveSolvedChapterIds({ progress, stages })
        remoteHintTextMap.value = sanitizeMissionHintTextMap(
          remoteHintTextMap.value,
          mission,
          solvedChapterIds,
        )

        activeSession.value = buildRestoredMissionSession(
          activeSession.value,
          mission,
          solvedChapterIds,
          {
            currentStageId: progress?.currentStageId ?? null,
            totalScore: progress?.myTotalScore,
            routeCompleted: isRouteProgressCompleted(progress),
            teamId: progress?.teamId ?? session.teamId,
          },
        )

        if (activeSession.value.status === "completed") {
          // 已通关则预拉终局，失败不阻断
          void loadRouteResult(session.routeId, { silent: true })
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
      const cinema = useCinemaStore()
      routeResult.value = null
      routeResultError.value = ""

      try {
        const { detail, joinResult, stages, progress } = await cinema.withLoading(
          async () => {
            // 先 Join，再并行拉 Stages + MyRouteProgress（进度接口依赖已加入）
            const [detailRes, joinRes] = await Promise.all([
              fetchRouteDetail(routeId),
              joinGameplayRoute(routeId, teamId),
            ])
            const resolvedTeamId = teamId || joinRes.teamId || null
            const [stagesRes, progressRes] = await Promise.all([
              fetchGameplayStages(routeId, resolvedTeamId),
              fetchMyRouteProgress(routeId, resolvedTeamId).catch(() => null as MyRouteProgressResponse | null),
            ])
            return {
              detail: detailRes,
              joinResult: joinRes,
              stages: stagesRes as StagePlayResponse[],
              progress: progressRes,
            }
          },
          { label: "开启探索", effect: "cinema" },
        )
        let mission = adaptRouteDetailToMission(detail, stages)

        if (!mission) {
          gameplayError.value = "任务节点数据不完整"
          return null
        }

        putMission(mission)
        mission = await enrichMissionExhibits(mission)

        const solvedChapterIds = resolveSolvedChapterIds({ progress, stages })
        const progressForIndex = progress?.currentStageId
          ? progress
          : joinResult
        const restoredIndex = resolveCurrentChapterIndex(mission, progressForIndex)
        const preferredChapterIndex =
          progressForIndex.currentStageId ? restoredIndex : undefined
        const nextSession = buildStartedMissionSession({
          routeId,
          mission,
          joinResult: {
            ...joinResult,
            myTotalScore: progress?.myTotalScore ?? joinResult.myTotalScore,
            currentStageId: progress?.currentStageId ?? joinResult.currentStageId,
            teamId: progress?.teamId ?? joinResult.teamId ?? teamId,
          },
          solvedChapterIds,
          selectedAgeBand,
          teamId: progress?.teamId ?? joinResult.teamId ?? teamId,
          previousSession: activeSession.value,
          preferredChapterIndex,
        })

        // 服务端已完成时以进度状态为准
        if (isRouteProgressCompleted(progress) && nextSession.status !== "completed") {
          nextSession.status = "completed"
          if (typeof progress?.myTotalScore === "number") {
            nextSession.totalScore = progress.myTotalScore
          }
        }

        activeSession.value = nextSession
        remoteHintTextMap.value = activeSession.value?.routeId === routeId
          ? sanitizeMissionHintTextMap(remoteHintTextMap.value, mission, solvedChapterIds)
          : {}

        if (nextSession.status === "completed") {
          const nextEntry = buildMissionArchiveEntry(nextSession, mission, getDifficultyLabel(mission.difficultyLevel))
          archiveEntries.value = appendArchiveEntry(archiveEntries.value, nextEntry)
          void loadRouteResult(routeId, { silent: true })
        }

        return nextSession
      } catch (error) {
        gameplayError.value = resolveRequestErrorMessage(error, "任务开始失败")
        return null
      } finally {
        gameplayPending.value = false
      }
    }

    /**
     * 终局：GET RouteResult 为权威数据源。
     * silent：通关后预取时不抢 cinema / 不写硬错误。
     */
    async function loadRouteResult(routeId: string, options: { silent?: boolean } = {}) {
      const teamId = activeSession.value?.routeId === routeId
        ? activeSession.value.teamId
        : null

      routeResultPending.value = true
      if (!options.silent) {
        routeResultError.value = ""
      }

      const cinema = useCinemaStore()

      try {
        const fetchResult = () => fetchRouteResult(routeId, teamId)
        const raw = options.silent
          ? await fetchResult()
          : await cinema.withLoading(fetchResult, { label: "结算成绩", effect: "swirl" })

        const adapted = adaptRouteResult(raw)
        if (!adapted) {
          if (!options.silent) {
            routeResultError.value = "终局数据不完整"
          }
          return null
        }

        routeResult.value = adapted

        // 同步会话分数/完成态
        if (activeSession.value?.routeId === routeId) {
          activeSession.value = {
            ...activeSession.value,
            totalScore: adapted.totalScore,
            status: adapted.completed ? "completed" : activeSession.value.status,
          }

          const mission = getMission(routeId) || activeMission.value
          if (mission && adapted.completed) {
            const nextEntry = buildMissionArchiveEntry(
              activeSession.value,
              mission,
              getDifficultyLabel(mission.difficultyLevel),
              {
                rewardTitle: adapted.rewardTitle,
                totalScore: adapted.totalScore,
                solvedCount: adapted.solvedCount,
                puzzleCount: adapted.puzzleCount,
                usedHintCount: adapted.usedClueCount,
                completedAt: adapted.completedAt,
              },
            )
            archiveEntries.value = appendArchiveEntry(archiveEntries.value, nextEntry)
          }
        }

        return adapted
      } catch (error) {
        if (!options.silent) {
          routeResultError.value = resolveRequestErrorMessage(error, "终局结果加载失败")
        }
        return null
      } finally {
        routeResultPending.value = false
      }
    }

    function clearRouteResult() {
      routeResult.value = null
      routeResultError.value = ""
    }

    /**
     * 弱行为上报：失败静默，不打断主链路。
     * kind: enter | leave | resume
     */
    async function recordStageActivity(
      routeId: string,
      stageId: string | null | undefined,
      kind: "enter" | "leave" | "resume",
    ) {
      const activityType =
        kind === "enter"
          ? ROUTE_ACTIVITY_TYPE.enterStage
          : kind === "leave"
            ? ROUTE_ACTIVITY_TYPE.leaveStage
            : ROUTE_ACTIVITY_TYPE.resumeRoute

      const teamId = activeSession.value?.routeId === routeId
        ? activeSession.value.teamId
        : null

      try {
        await recordRouteActivity({
          routeId,
          stageId: stageId || null,
          teamId,
          activityType,
          clientEventId: `act-${kind}-${routeId}-${stageId || "route"}-${Date.now()}`,
        })
      } catch {
        // 弱行为：忽略错误
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

    function selectChapterById(chapterId: string) {
      if (!activeMission.value) {
        return false
      }

      const index = activeMission.value.chapters.findIndex((chapter) => chapter.id === chapterId)
      if (index < 0) {
        return false
      }

      return selectChapter(index)
    }

    function getChapterProgress(chapterId: string): ChapterGateProgress {
      return getChapterGateProgress(activeSession.value, chapterId)
    }

    function patchChapterProgress(chapterId: string, partial: Partial<ChapterGateProgress>) {
      if (!activeSession.value) {
        return
      }

      const current = getChapterGateProgress(activeSession.value, chapterId)
      activeSession.value = {
        ...activeSession.value,
        chapterProgress: {
          ...(activeSession.value.chapterProgress || {}),
          [chapterId]: {
            ...current,
            ...partial,
          },
        },
      }
    }

    /** 临时：识别接口未定，前端本地标记（含跳过） */
    function markChapterRecognized(chapterId: string) {
      patchChapterProgress(chapterId, { recognized: true })
    }

    /** 临时：播片接口未定，前端本地标记（含跳过） */
    function markChapterVideoWatched(chapterId: string) {
      patchChapterProgress(chapterId, {
        recognized: true,
        videoWatched: true,
      })
    }

    function resolveEnterChapterPath(chapterId?: string) {
      if (!activeSession.value || !activeMission.value) {
        return null
      }

      const chapter =
        (chapterId
          ? activeMission.value.chapters.find((item) => item.id === chapterId)
          : currentChapter.value) || null

      if (!chapter) {
        return `/missions/${activeSession.value.routeId}/map`
      }

      return resolveChapterEnterPath(
        activeSession.value.routeId,
        chapter.id,
        getChapterGateProgress(activeSession.value, chapter.id),
      )
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
      if (!activeSession.value || !activeMission.value) {
        return null
      }

      const chapter = currentChapter.value
      const puzzleId = chapter?.puzzle.id

      return resolveMissionResumePath({
        session: {
          ...activeSession.value,
          chapterProgress:
            activeSession.value.chapterProgress
            || buildChapterProgressMap(activeMission.value, activeSession.value.solvedChapterIds),
        },
        mission: activeMission.value,
        chapterId: chapter?.id || null,
        hasDraft: puzzleId ? Boolean(getMissionDraft(puzzleId)) : false,
        hasHint: puzzleId ? Boolean((activeSession.value.hintHistory[puzzleId] || []).length) : false,
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
      const chapterId = currentChapter.value.id
      const previousProgress = activeSession.value.chapterProgress || {}
      const { nextSession, routeCompleted, snapshot } = finalizeSessionAfterSolve({
        session: activeSession.value,
        mission: activeMission.value,
        chapter: currentChapter.value,
        hintLevels: hints,
        skipped,
        scoreOverride,
        narrativeOverride,
      })

      activeSession.value = {
        ...activeSession.value,
        ...nextSession,
        chapterProgress: {
          ...previousProgress,
          [chapterId]: {
            recognized: true,
            videoWatched: true,
            solved: true,
          },
        },
      }

      if (routeCompleted) {
        const nextEntry = buildMissionArchiveEntry(
          activeSession.value,
          activeMission.value,
          getDifficultyLabel(activeMission.value.difficultyLevel),
        )
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
      const cinema = useCinemaStore()
      const session = activeSession.value
      const puzzle = currentPuzzle.value

      try {
        const response = await cinema.withLoading(
          () =>
            submitGameplayStage({
              routeId: session.routeId,
              stageId: puzzle.id,
              teamId: session.teamId,
              payload: encodeStageSubmitPayload(puzzle, draft.value),
            }),
          { label: "核验答案", effect: "cinema" },
        )

        if (!response.success) {
          return buildMissionSubmitResult(false, response.message || puzzle.failureCopy, null)
        }

        const score = response.scoreGained ?? 0
        if (score > 0) {
          cinema.showScore(score)
        }

        const snapshot = finalizeSolve(false, score, response.message || "")
        clearCurrentPuzzleDraft()
        if (shouldMarkRouteCompleted(response) && activeSession.value) {
          const latestChapterResult = snapshot ? { ...snapshot, finalChapter: true } : activeSession.value.latestChapterResult
          activeSession.value = {
            ...activeSession.value,
            latestChapterResult,
            status: "completed",
          }
          // 通关后预取 RouteResult，终局页直接用服务端数据
          void loadRouteResult(session.routeId, { silent: true })
        }

        return buildMissionSubmitResult(true, response.message || puzzle.successCopy, snapshot)
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
      routeResult,
      routeResultPending,
      routeResultError,
      hasActiveSession,
      getMission,
      getMissionDraft,
      setFilters,
      resetFilters,
      loadRouteCards,
      loadMissionDetail,
      restoreActiveMission,
      startRemoteMission,
      loadRouteResult,
      clearRouteResult,
      recordStageActivity,
      selectChapter,
      selectChapterById,
      getChapterProgress,
      markChapterRecognized,
      markChapterVideoWatched,
      resolveEnterChapterPath,
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
