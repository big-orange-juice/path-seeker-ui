import { computed, reactive, shallowRef, watch } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import {
  advanceSessionAfterChapterResult,
  finalizeSessionAfterSolve,
} from "@path-seeker/game-runtime"
import { useCinemaStore } from "@/stores/useCinemaStore"
import {
  adaptRouteDetailToMission,
  adaptRouteFootprintList,
  adaptRouteHistoryList,
  adaptRouteResult,
  encodeStageSubmitPayload,
  isRouteProgressCompleted,
  resolveCurrentChapterIndex,
  resolveSolvedChapterIds,
  ROUTE_PROGRESS_STATUS,
} from "@/adapters/gameplayMissionAdapter"
import {
  adaptRemoteRouteCard,
  buildRoutePageQuery,
  buildMissionSubmitResult,
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
import { AGE_BAND_OPTIONS, DIFFICULTY_OPTIONS, SCALE_TYPE_FILTER_OPTIONS } from "@/constants/missionSchema"
import {
  fetchGameplayStages,
  fetchMyCompletedRoutes,
  fetchMyFootprints,
  fetchMyRouteHistory,
  fetchMyRouteProgress,
  fetchRouteDetail,
  fetchPublishedRoutes,
  fetchRouteResult,
  fetchStageHints,
  joinGameplayRoute,
  recordRouteActivity,
  ROUTE_ACTIVITY_TYPE,
  submitGameplayStage,
  unlockStageHint,
  type MyRouteProgressResponse,
  type StagePlayResponse,
} from "@/services/gameplay"
import { resolveRequestErrorMessage } from "@/services/http"
import type {
  AgeBand,
  ChapterGateProgress,
  HintLevel,
  MissionAnswerDraft,
  MissionChapter,
  MissionDetail,
  MissionFilters,
  MissionRouteCard,
  MissionRouteHistoryItem,
  MissionRouteResult,
  MissionSession,
} from "@/types/mission"

const DEFAULT_MUSEUM_ID = String(import.meta.env.VITE_MUSEUM_ID || "345536575083515904").trim()
const HINT_LEVELS: HintLevel[] = ["observe", "relation", "direct"]
/** 展厅列表缓存时长：回 tab / 返回不强制重拉 */
const ROUTE_LIST_TTL_MS = 60_000

function defaultFilters(): MissionFilters {
  return {
    ageBand: "all",
    difficulty: "all",
    scaleType: "all",
    keyword: "",
    guideName: "",
    guideId: "",
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
    /** 仅内存会话：当前访问中的游玩态，不落本地缓存；列表以服务端为准 */
    const activeSession = shallowRef<MissionSession | null>(null)
    const filters = reactive<MissionFilters>(defaultFilters())
    /** 探索 Tab：进行中路线（MyRouteHistory status=1） */
    const playingHistory = shallowRef<MissionRouteHistoryItem[]>([])
    const playingHistoryPending = shallowRef(false)
    const playingHistoryError = shallowRef("")
    /** 游玩历史 Tab：已完成路线 + 足迹 */
    const completedHistory = shallowRef<MissionRouteHistoryItem[]>([])
    const footprintHistory = shallowRef<MissionRouteHistoryItem[]>([])
    const playHistoryPending = shallowRef(false)
    const playHistoryError = shallowRef("")
    /** Stages 缓存：start / restore 复用，减少重复拉 */
    const stagesCache = shallowRef<Record<string, StagePlayResponse[]>>({})
    /** 列表最近一次成功拉取时间（用于 TTL） */
    const routeListFetchedAt = shallowRef(0)
    /** 列表请求序号：丢弃过期响应 */
    let routeListRequestId = 0
    /** Published 列表进行中 Promise：bootstrap + 展厅 mount 共用，避免连打两次 */
    let routeListInflight: Promise<MissionRouteCard[]> | null = null
    /** Detail 进行中 Promise，避免 map 预览与 start 并行打两次 */
    const missionDetailInflight = new Map<string, Promise<MissionDetail | null>>()
    /** restore 进行中 Promise，避免 main + 探索页重复恢复 */
    const restoreInflight = new Map<string, Promise<MissionDetail | null>>()
    /** 筛选序列化，避免 rehydrate / 同值写入重复 force 拉列表 */
    let lastFiltersKey = JSON.stringify(defaultFilters())

    const hasActiveSession = computed(() => Boolean(activeSession.value))

    /**
     * 列表以服务端 Published 筛选为准，不再本地二次过滤
     *（避免与服务端条件不一致导致「接口有数据、UI 仍空」）。
     */
    const filteredRoutes = computed(() => routeCards.value)

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
      scaleTypes: SCALE_TYPE_FILTER_OPTIONS.length,
      /** @deprecated 请用 scaleTypes */
      taskKinds: SCALE_TYPE_FILTER_OPTIONS.length,
      missionCount: routeCards.value.length,
      /** 游玩历史：已完成条数 */
      archiveCount: completedHistory.value.length,
      playingCount: playingHistory.value.length,
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

    /**
     * 写入详情缓存。
     * 首页列表只信 Published 接口结果，禁止把详情/恢复进度注入 routeCards，
     * 否则会出现「接口 4 条、UI 渲染 5 条」（例如会话中的未在列表内路线被 prepend）。
     */
    function putMission(mission: MissionDetail) {
      missionMap.value = {
        ...missionMap.value,
        [mission.id]: mission,
      }
    }

    function putStages(routeId: string, stages: StagePlayResponse[]) {
      stagesCache.value = {
        ...stagesCache.value,
        [routeId]: stages,
      }
    }

    function getCachedStages(routeId: string) {
      return stagesCache.value[routeId] || null
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
      if (payload.scaleType !== undefined) {
        filters.scaleType = payload.scaleType
      }
      if (payload.keyword !== undefined) {
        filters.keyword = String(payload.keyword ?? "")
      }
      if (payload.guideName !== undefined) {
        filters.guideName = String(payload.guideName ?? "")
      }
      if (payload.guideId !== undefined) {
        filters.guideId = String(payload.guideId ?? "")
      }
      // 兼容旧 taskKind 筛选：映射为 scaleType
      if (payload.taskKind && payload.taskKind !== "all") {
        const legacy: Record<string, 1 | 2 | 3> = {
          family_adventure: 1,
          story_detective: 2,
          deep_reasoning: 3,
        }
        filters.scaleType = legacy[payload.taskKind] ?? "all"
      }
    }

    function resetFilters() {
      Object.assign(filters, defaultFilters())
    }

    function serializeFilters() {
      return JSON.stringify({
        ageBand: filters.ageBand ?? "all",
        difficulty: filters.difficulty ?? "all",
        scaleType: filters.scaleType ?? "all",
        keyword: filters.keyword || "",
        guideName: filters.guideName || "",
        guideId: filters.guideId || "",
      })
    }

    /**
     * 拉取路线列表。
     * - force：忽略 TTL
     * - 失败保留旧列表，不把 UI 打成空
     * - requestId 丢弃过期响应，避免筛选竞态
     * - inflight 合并：bootstrap 与展厅 onMounted 共用同一请求，避免连打两次 Published
     */
    async function loadRouteCards(options: { force?: boolean } = {}) {
      const force = Boolean(options.force)
      const freshEnough =
        routeCards.value.length > 0
        && routeListFetchedAt.value > 0
        && Date.now() - routeListFetchedAt.value < ROUTE_LIST_TTL_MS

      if (!force && freshEnough) {
        return routeCards.value
      }

      // 并发：非 force 直接复用进行中请求；force 等完成后再按最新筛选重拉
      if (routeListInflight) {
        if (!force) {
          return routeListInflight
        }
        await routeListInflight
        // 等完后若仍有新的 inflight（他人已 force），继续复用
        if (routeListInflight) {
          return routeListInflight
        }
      }

      const requestId = ++routeListRequestId
      const filtersKeyAtStart = serializeFilters()
      routeListPending.value = true
      routeListError.value = ""

      routeListInflight = (async () => {
        try {
          // 兼容旧持久化筛选（仅有 taskKind、无 scaleType）
          if (filters.scaleType === undefined || filters.scaleType === null) {
            filters.scaleType = "all"
          }
          if (filters.keyword === undefined || filters.keyword === null) {
            filters.keyword = ""
          }
          if (filters.guideName === undefined || filters.guideName === null) {
            filters.guideName = ""
          }
          if (filters.guideId === undefined || filters.guideId === null) {
            filters.guideId = ""
          }

          // 难度/规模已从 UI 移除；导游：guideId 精确 / guideName 模糊
          const response = await fetchPublishedRoutes(
            buildRoutePageQuery({
              museumId: DEFAULT_MUSEUM_ID,
              ageBand: filters.ageBand ?? "all",
              difficulty: "all",
              scaleType: "all",
              keyword: filters.keyword || null,
              guideId: filters.guideId || null,
              guideName: filters.guideName || null,
            }),
          )

          if (requestId !== routeListRequestId) {
            return routeCards.value
          }

          const nextRoutes = resolveRouteList(response)
            .map(adaptRemoteRouteCard)
            .filter((route): route is MissionRouteCard => Boolean(route))

          routeCards.value = nextRoutes
          routeTotal.value = resolveRouteTotal(response, nextRoutes.length)
          routeListFetchedAt.value = Date.now()
          return nextRoutes
        } catch (error) {
          if (requestId !== routeListRequestId) {
            return routeCards.value
          }

          // 失败保留旧数据；仅无缓存时 total 置 0
          if (!routeCards.value.length) {
            routeTotal.value = 0
          }
          routeListError.value = resolveRequestErrorMessage(error, "任务列表加载失败")
          return routeCards.value
        } finally {
          if (requestId === routeListRequestId) {
            routeListPending.value = false
          }
          routeListInflight = null
        }
      })()

      const result = await routeListInflight

      // 请求进行中筛选已变：用最新条件再拉一次
      if (requestId === routeListRequestId && serializeFilters() !== filtersKeyAtStart) {
        return loadRouteCards({ force: true })
      }

      return result
    }

    /** 展厅进入：空列表或过期时再拉；已有进行中请求则复用 */
    async function ensureRouteCards(options: { force?: boolean } = {}) {
      if (routeListInflight) {
        return routeListInflight
      }

      if (options.force) {
        return loadRouteCards({ force: true })
      }

      if (!routeCards.value.length || routeListError.value) {
        return loadRouteCards({ force: true })
      }

      return loadRouteCards({ force: false })
    }

    async function loadMissionDetail(routeId: string, options: { force?: boolean } = {}) {
      if (!routeId) {
        return null
      }

      if (!options.force) {
        const cachedMission = getMission(routeId)
        if (cachedMission) {
          return cachedMission
        }

        const inflight = missionDetailInflight.get(routeId)
        if (inflight) {
          return inflight
        }
      }

      const task = (async () => {
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
          // 渲染只依赖 Route Detail / Stages，不再批量拉 Exhibit/Get
          return mission
        } catch (error) {
          detailError.value = resolveRequestErrorMessage(error, "任务详情加载失败")
          return null
        } finally {
          detailPending.value = false
        }
      })()

      missionDetailInflight.set(routeId, task)
      try {
        return await task
      } finally {
        if (missionDetailInflight.get(routeId) === task) {
          missionDetailInflight.delete(routeId)
        }
      }
    }

    /**
     * 恢复进度：MyRouteProgress 为权威源。
     * 已有 mission 缓存时跳过（force 可强制刷新）。
     */
    async function restoreActiveMission(options: { force?: boolean } = {}) {
      if (!activeSession.value) {
        return null
      }

      const session = activeSession.value
      const routeId = session.routeId

      if (!options.force) {
        const cached = getMission(routeId)
        if (cached) {
          return cached
        }

        const inflight = restoreInflight.get(routeId)
        if (inflight) {
          return inflight
        }
      }

      const task = (async () => {
        gameplayPending.value = true
        gameplayError.value = ""
        const cinema = useCinemaStore()
        const lastSolved = session.solvedChapterIds[session.solvedChapterIds.length - 1] || null
        void recordStageActivity(routeId, lastSolved, "resume")

        try {
          const cachedStages = getCachedStages(routeId)
          const cachedMission = getMission(routeId)

          const { detail, stages, progress } = await cinema.withLoading(
            async () => {
              const [detailRes, stagesRes, progressRes] = await Promise.all([
                cachedMission && !options.force
                  ? Promise.resolve(null)
                  : fetchRouteDetail(routeId),
                cachedStages && !options.force
                  ? Promise.resolve(cachedStages)
                  : fetchGameplayStages(routeId, session.teamId),
                fetchMyRouteProgress(routeId, session.teamId).catch(
                  () => null as MyRouteProgressResponse | null,
                ),
              ])
              return {
                detail: detailRes,
                stages: (stagesRes || cachedStages || []) as StagePlayResponse[],
                progress: progressRes,
              }
            },
            { label: "恢复进度", effect: "cinema" },
          )

          if (stages.length) {
            putStages(routeId, stages)
          }

          let mission: MissionDetail | null = cachedMission
          if (!mission || options.force) {
            if (!detail) {
              gameplayError.value = "探索点数据不完整"
              return null
            }
            mission = adaptRouteDetailToMission(detail, stages)
            if (!mission) {
              gameplayError.value = "探索点数据不完整"
              return null
            }
          }

          putMission(mission)

          const solvedChapterIds = resolveSolvedChapterIds({ progress, stages })
          remoteHintTextMap.value = sanitizeMissionHintTextMap(
            remoteHintTextMap.value,
            mission,
            solvedChapterIds,
          )

          if (!activeSession.value || activeSession.value.routeId !== routeId) {
            return mission
          }

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
            void loadRouteResult(routeId, { silent: true })
          }

          return mission
        } catch (error) {
          gameplayError.value = resolveRequestErrorMessage(error, "任务恢复失败")
          return null
        } finally {
          gameplayPending.value = false
        }
      })()

      restoreInflight.set(routeId, task)
      try {
        return await task
      } finally {
        if (restoreInflight.get(routeId) === task) {
          restoreInflight.delete(routeId)
        }
      }
    }

    async function startRemoteMission(routeId: string, selectedAgeBand?: AgeBand, teamId?: string | null) {
      gameplayPending.value = true
      gameplayError.value = ""
      const cinema = useCinemaStore()
      routeResult.value = null
      routeResultError.value = ""

      try {
        const bundle = await cinema.withLoading(
          async () => {
            // Join 必走；Detail / Stages 有缓存则跳过
            const joinResult = await joinGameplayRoute(routeId, teamId)
            const resolvedTeamId = teamId || joinResult.teamId || null
            const cachedMission = getMission(routeId)
            const cachedStages = getCachedStages(routeId)

            // 若 detail 正在 inflight（map 预览），等同一 Promise 而不是再打接口
            let missionFromInflight: MissionDetail | null = null
            if (!cachedMission) {
              const inflight = missionDetailInflight.get(routeId)
              if (inflight) {
                missionFromInflight = await inflight
              }
            }

            const needDetail = !cachedMission && !missionFromInflight
            const needStages = !cachedStages

            const [detailRes, stagesRes, progressRes] = await Promise.all([
              needDetail ? fetchRouteDetail(routeId) : Promise.resolve(null),
              needStages
                ? fetchGameplayStages(routeId, resolvedTeamId)
                : Promise.resolve(cachedStages),
              fetchMyRouteProgress(routeId, resolvedTeamId).catch(
                () => null as MyRouteProgressResponse | null,
              ),
            ])

            const stages = (stagesRes || []) as StagePlayResponse[]
            if (stages.length) {
              putStages(routeId, stages)
            }

            let mission: MissionDetail | null = cachedMission || missionFromInflight
            if (detailRes) {
              // 有 Detail 时优先用 Stages 重适配，保证玩法字段齐全
              mission = adaptRouteDetailToMission(detailRes, stages) || mission
            }

            return {
              joinResult,
              stages,
              progress: progressRes,
              mission,
              resolvedTeamId,
            }
          },
          { label: "开启探索", effect: "cinema" },
        )

        let mission = bundle.mission
        if (!mission) {
          gameplayError.value = "探索点数据不完整"
          return null
        }

        putMission(mission)

        const { joinResult, stages, progress, resolvedTeamId } = bundle
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
            teamId: progress?.teamId ?? joinResult.teamId ?? resolvedTeamId,
          },
          solvedChapterIds,
          selectedAgeBand,
          teamId: progress?.teamId ?? joinResult.teamId ?? resolvedTeamId,
          previousSession: activeSession.value,
          preferredChapterIndex,
        })

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
          // 完成记录由服务端游玩历史接口提供；预取终局结算
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
     * 终局：GET RouteResult 为唯一权威数据源，不拼本地会话成绩。
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
            routeResultError.value = "完成结果数据不完整"
            routeResult.value = null
          }
          return null
        }

        routeResult.value = adapted

        // 同步会话分数/完成态；游玩历史列表由服务端接口提供
        if (activeSession.value?.routeId === routeId) {
          activeSession.value = {
            ...activeSession.value,
            totalScore: adapted.totalScore,
            status: adapted.completed ? "completed" : activeSession.value.status,
          }
        }

        return adapted
      } catch (error) {
        if (!options.silent) {
          routeResultError.value = resolveRequestErrorMessage(error, "完成结果加载失败")
          routeResult.value = null
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

    /** 探索 Tab：进行中的路线历史 */
    async function loadPlayingHistory(options: { force?: boolean } = {}) {
      if (playingHistoryPending.value && !options.force) {
        return playingHistory.value
      }

      playingHistoryPending.value = true
      playingHistoryError.value = ""

      try {
        const response = await fetchMyRouteHistory({
          status: ROUTE_PROGRESS_STATUS.inProgress,
          pageIndex: 1,
          pageSize: 50,
        })
        playingHistory.value = adaptRouteHistoryList(response?.list)
        return playingHistory.value
      } catch (error) {
        playingHistoryError.value = resolveRequestErrorMessage(error, "进行中路线加载失败")
        return playingHistory.value
      } finally {
        playingHistoryPending.value = false
      }
    }

    /**
     * 游玩历史 Tab：
     * - MyCompletedRoutes 已完成列表
     * - MyFootprints 足迹（含序号）
     */
    async function loadPlayHistory(options: { force?: boolean } = {}) {
      if (playHistoryPending.value && !options.force) {
        return {
          completed: completedHistory.value,
          footprints: footprintHistory.value,
        }
      }

      playHistoryPending.value = true
      playHistoryError.value = ""

      try {
        const [completedRaw, footprintsRaw] = await Promise.all([
          fetchMyCompletedRoutes(),
          fetchMyFootprints({ pageIndex: 1, pageSize: 50 }),
        ])

        completedHistory.value = adaptRouteHistoryList(
          Array.isArray(completedRaw) ? completedRaw : [],
        )
        footprintHistory.value = adaptRouteFootprintList(footprintsRaw?.list)
        return {
          completed: completedHistory.value,
          footprints: footprintHistory.value,
        }
      } catch (error) {
        playHistoryError.value = resolveRequestErrorMessage(error, "探索记录加载失败")
        return {
          completed: completedHistory.value,
          footprints: footprintHistory.value,
        }
      } finally {
        playHistoryPending.value = false
      }
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
        chapter.interactionType ?? chapter.puzzle?.interactionType,
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
          gameplayError.value = "这一站暂时没有可用提示。"
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
      const { nextSession, snapshot } = finalizeSessionAfterSolve({
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
        // 先静默核验：答错不播过渡动画，只靠按钮 pending + toast
        const response = await submitGameplayStage({
          routeId: session.routeId,
          stageId: puzzle.id,
          teamId: session.teamId,
          payload: encodeStageSubmitPayload(puzzle, draft.value),
        })

        if (!response.success) {
          // 答错：写入 gameplayError，供页内文案与 toast 共用（D1）
          const failMessage = response.message || puzzle.failureCopy || "答案错误，再想想看"
          gameplayError.value = failMessage
          return buildMissionSubmitResult(false, failMessage, null)
        }

        // 答对后同步进度；分数仅服务端字段，前端不展示
        const score = response.scoreGained ?? 0
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

    /**
     * 播放门槛状态（对齐 schema RecordChallengeIntroVideo.status）：
     * 1=开始播放 2=播放完成 3=明确跳过
     */
    const PLAY_STATUS = {
      started: 1,
      completed: 2,
      skipped: 3,
    } as const

    function buildSpecialStagePayload(
      source: "narration" | "find_scan",
      options: { skipped?: boolean } = {},
    ) {
      const skipped = Boolean(options.skipped)
      return JSON.stringify({
        completed: true,
        source,
        skipped,
        // 后端可能读 playStatus / status / action 任一字段
        playStatus: skipped ? PLAY_STATUS.skipped : PLAY_STATUS.completed,
        status: skipped ? PLAY_STATUS.skipped : PLAY_STATUS.completed,
        action: skipped ? "skip" : "complete",
      })
    }

    function isPlayGateRejectMessage(message: string) {
      return /完整播放|请先.*播|播完|听完|播放完成|未播放/.test(message)
    }

    /** 找一找 / 识别等后端不接受通用 Submit 的文案 */
    function isFindScanSubmitRejectMessage(message: string) {
      return /拍照|找文物|识别|上传图片|通用\s*Submit|不能通过|必须先|未识别/.test(message)
    }

    /**
     * 强制跳过：后端拒绝时一律本地完成本站（识别未开放 / 播放门槛 / 通用 Submit 不可用等）。
     */
    function shouldLocalForceSkip(skipped: boolean, message: string) {
      if (!skipped) {
        return false
      }
      return (
        !message
        || isPlayGateRejectMessage(message)
        || isFindScanSubmitRejectMessage(message)
        || /失败|不允许|不支持|无法|不能/.test(message)
      )
    }

    /**
     * 非 puzzle 节点完成（10 找一找播片后 / 11 解说听完）：
     * Submit + 写本地闸门 / 章节结果。
     * 强制跳过时：先试 Submit；后端拒绝则本地放行，避免卡死。
     */
    async function completeSpecialStage(
      source: "narration" | "find_scan",
      options: { skipped?: boolean } = {},
    ) {
      if (!activeSession.value || !currentChapter.value || !currentPuzzle.value) {
        return buildMissionSubmitResult(false, "当前没有可完成的探索点。", null)
      }

      const interactionType = Number(
        currentChapter.value.interactionType ?? currentPuzzle.value.interactionType ?? 0,
      )
      if (source === "narration" && interactionType !== 11) {
        return buildMissionSubmitResult(false, "当前探索点不是解说导览。", null)
      }
      if (source === "find_scan" && interactionType !== 10) {
        return buildMissionSubmitResult(false, "当前探索点不是找一找。", null)
      }

      gameplayPending.value = true
      gameplayError.value = ""
      const cinema = useCinemaStore()
      const session = activeSession.value
      const puzzle = currentPuzzle.value
      const skipped = Boolean(options.skipped)
      const label = skipped
        ? (source === "narration" ? "已跳过解说" : "已跳过本站")
        : (source === "narration" ? "解说完成" : "找一找完成")

      // 跳过前先补齐本地闸门，避免回路线后相位错乱
      if (skipped && currentChapter.value) {
        markChapterRecognized(currentChapter.value.id)
        markChapterVideoWatched(currentChapter.value.id)
      }

      try {
        const response = await submitGameplayStage({
          routeId: session.routeId,
          stageId: puzzle.id,
          teamId: session.teamId,
          payload: buildSpecialStagePayload(source, { skipped }),
        })

        const rejectMessage = response.message || ""
        const localOnlySkip = !response.success && shouldLocalForceSkip(skipped, rejectMessage)

        if (!response.success && !localOnlySkip) {
          return buildMissionSubmitResult(false, rejectMessage || `${label}提交失败。`, null)
        }

        const score = localOnlySkip ? 0 : (response.scoreGained ?? 0)
        const snapshot = finalizeSolve(
          skipped,
          score,
          localOnlySkip ? label : (response.message || label),
        )

        if (
          !localOnlySkip
          && shouldMarkRouteCompleted(response)
          && activeSession.value
        ) {
          const latestChapterResult = snapshot
            ? { ...snapshot, finalChapter: true }
            : activeSession.value.latestChapterResult
          activeSession.value = {
            ...activeSession.value,
            latestChapterResult,
            status: "completed",
          }
          void loadRouteResult(session.routeId, { silent: true })
        }

        return buildMissionSubmitResult(
          true,
          localOnlySkip ? label : (response.message || label),
          snapshot,
        )
      } catch (error) {
        const message = resolveRequestErrorMessage(error, `${label}提交失败`)
        if (shouldLocalForceSkip(skipped, message)) {
          const snapshot = finalizeSolve(true, 0, label)
          return buildMissionSubmitResult(true, label, snapshot)
        }

        gameplayError.value = message
        return buildMissionSubmitResult(false, gameplayError.value, null)
      } finally {
        gameplayPending.value = false
      }
    }

    async function completeNarrationStage(options: { skipped?: boolean } = {}) {
      return completeSpecialStage("narration", options)
    }

    async function completeFindScanStage(options: { skipped?: boolean } = {}) {
      return completeSpecialStage("find_scan", options)
    }

    /**
     * 强制跳过当前站（1~10 练习/找一找均可）。
     * 先尝试 Submit(skip)；失败则本地记完成。
     */
    async function forceSkipCurrentStage() {
      if (!activeSession.value || !currentChapter.value || !currentPuzzle.value) {
        return buildMissionSubmitResult(false, "当前没有可跳过的探索点。", null)
      }

      const interactionType = Number(
        currentChapter.value.interactionType ?? currentPuzzle.value.interactionType ?? 0,
      )

      if (interactionType === 11) {
        return completeNarrationStage({ skipped: true })
      }
      if (interactionType === 10) {
        return completeFindScanStage({ skipped: true })
      }

      // 仅 1/6 题面走通用跳过提交；10/11 已在上方分流处理。
      gameplayPending.value = true
      gameplayError.value = ""
      const cinema = useCinemaStore()
      const session = activeSession.value
      const puzzle = currentPuzzle.value
      const chapter = currentChapter.value
      const label = "已跳过本站"

      markChapterRecognized(chapter.id)
      markChapterVideoWatched(chapter.id)

      try {
        const response = await submitGameplayStage({
          routeId: session.routeId,
          stageId: puzzle.id,
          teamId: session.teamId,
          payload: JSON.stringify({
            completed: true,
            skipped: true,
            forceSkip: true,
            action: "skip",
            playStatus: PLAY_STATUS.skipped,
            status: PLAY_STATUS.skipped,
            source: "puzzle",
            templateType: puzzle.templateType,
          }),
        })

        if (response.success) {
          const score = response.scoreGained ?? 0
          const snapshot = finalizeSolve(true, score, response.message || label)
          if (shouldMarkRouteCompleted(response) && activeSession.value) {
            const latestChapterResult = snapshot
              ? { ...snapshot, finalChapter: true }
              : activeSession.value.latestChapterResult
            activeSession.value = {
              ...activeSession.value,
              latestChapterResult,
              status: "completed",
            }
            void loadRouteResult(session.routeId, { silent: true })
          }
          return buildMissionSubmitResult(true, response.message || label, snapshot)
        }

        // 后端不接受跳过答案：本地完成本站
        const snapshot = finalizeSolve(true, 0, label)
        return buildMissionSubmitResult(true, label, snapshot)
      } catch {
        const snapshot = finalizeSolve(true, 0, label)
        return buildMissionSubmitResult(true, label, snapshot)
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

    // 筛选变更强制重拉；跳过同值（含 persist rehydrate），避免与 bootstrap 叠两次 Published
    watch(
      () => ({ ...filters }),
      (next) => {
        const key = JSON.stringify(next)
        if (key === lastFiltersKey) {
          return
        }
        lastFiltersKey = key
        void loadRouteCards({ force: true })
      },
      { deep: true },
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
      coverageSummary,
      unlockedClueTitles,
      detailPending,
      detailError,
      routeListPending,
      routeListError,
      routeTotal,
      routeListFetchedAt,
      gameplayPending,
      gameplayError,
      routeResult,
      routeResultPending,
      routeResultError,
      playingHistory,
      playingHistoryPending,
      playingHistoryError,
      completedHistory,
      footprintHistory,
      playHistoryPending,
      playHistoryError,
      hasActiveSession,
      getMission,
      getMissionDraft,
      setFilters,
      resetFilters,
      loadRouteCards,
      ensureRouteCards,
      loadMissionDetail,
      restoreActiveMission,
      startRemoteMission,
      loadRouteResult,
      clearRouteResult,
      loadPlayingHistory,
      loadPlayHistory,
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
      completeNarrationStage,
      completeFindScanStage,
      forceSkipCurrentStage,
      advanceFromChapterResult,
      replayMission,
    }
  },
  {
    persist: {
      key: "path-seeker:h5-client:mission",
      // 游玩进度 / 历史只信服务端，本地仅保留筛选偏好
      pick: ["filters"],
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMissionStore, import.meta.hot))
}
