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
/** 展厅列表缓存时长：回 tab / 返回不强制重拉 */
const ROUTE_LIST_TTL_MS = 60_000
/** 展品补全并发上限，避免一进站打爆 Get */
const EXHIBIT_FETCH_CONCURRENCY = 3

function defaultFilters(): MissionFilters {
  return {
    ageBand: "all",
    difficulty: "all",
    taskKind: "all",
  }
}

/** 有限并发执行异步任务，保持结果顺序 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) {
    return []
  }

  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
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
    /** Stages 缓存：start / restore 复用，减少重复拉 */
    const stagesCache = shallowRef<Record<string, StagePlayResponse[]>>({})
    /** 列表最近一次成功拉取时间（用于 TTL） */
    const routeListFetchedAt = shallowRef(0)
    /** 列表请求序号：丢弃过期响应 */
    let routeListRequestId = 0
    /** Detail 进行中 Promise，避免 map 预览与 start 并行打两次 */
    const missionDetailInflight = new Map<string, Promise<MissionDetail | null>>()
    /** restore 进行中 Promise，避免 main + 探索页重复恢复 */
    const restoreInflight = new Map<string, Promise<MissionDetail | null>>()

    const hasActiveSession = computed(() => Boolean(activeSession.value))

    /**
     * 列表以服务端 PageList 筛选为准，不再本地二次过滤
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

    function putStages(routeId: string, stages: StagePlayResponse[]) {
      stagesCache.value = {
        ...stagesCache.value,
        [routeId]: stages,
      }
    }

    function getCachedStages(routeId: string) {
      return stagesCache.value[routeId] || null
    }

    /**
     * 可选：用 Exhibit/Get 补位置与短视频。
     * 失败不阻断主链路；仅回填可展示字段。
     * 有限并发，避免一次打开路线打出大量 Get。
     */
    async function enrichMissionExhibits(mission: MissionDetail) {
      const exhibitIds = collectChapterExhibitIds(mission)
      if (!exhibitIds.length) {
        return mission
      }

      const missingIds = exhibitIds.filter((id) => !(id in exhibitCache.value))
      if (missingIds.length) {
        const fetched = await mapWithConcurrency(
          missingIds,
          EXHIBIT_FETCH_CONCURRENCY,
          async (id) => {
            try {
              const exhibit = await fetchExhibit(id)
              return { id, exhibit }
            } catch {
              return { id, exhibit: null as ExhibitResponse | null }
            }
          },
        )

        const nextCache = { ...exhibitCache.value }
        fetched.forEach(({ id, exhibit }) => {
          nextCache[id] = exhibit
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

    /**
     * 拉取路线列表。
     * - force：忽略 TTL
     * - 失败保留旧列表，不把 UI 打成空
     * - requestId 丢弃过期响应，避免筛选竞态
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

      const requestId = ++routeListRequestId
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
      }
    }

    /** 展厅进入：空列表或过期时再拉 */
    async function ensureRouteCards(options: { force?: boolean } = {}) {
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
          mission = await enrichMissionExhibits(mission)
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
              gameplayError.value = "任务节点数据不完整"
              return null
            }
            mission = adaptRouteDetailToMission(detail, stages)
            if (!mission) {
              gameplayError.value = "任务节点数据不完整"
              return null
            }
          }

          putMission(mission)
          mission = await enrichMissionExhibits(mission)

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
          gameplayError.value = "任务节点数据不完整"
          return null
        }

        putMission(mission)
        mission = await enrichMissionExhibits(mission)

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
        // 先静默核验：答错不播过渡动画，只靠按钮 pending + toast
        const response = await submitGameplayStage({
          routeId: session.routeId,
          stageId: puzzle.id,
          teamId: session.teamId,
          payload: encodeStageSubmitPayload(puzzle, draft.value),
        })

        if (!response.success) {
          return buildMissionSubmitResult(false, response.message || puzzle.failureCopy, null)
        }

        // 仅答对：得分闪烁；跳转 result/finale 时由路由 win 过场承接
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
        return buildMissionSubmitResult(false, "当前没有可完成的节点。", null)
      }

      const interactionType = Number(
        currentChapter.value.interactionType ?? currentPuzzle.value.interactionType ?? 0,
      )
      if (source === "narration" && interactionType !== 11) {
        return buildMissionSubmitResult(false, "当前节点不是解说导览。", null)
      }
      if (source === "find_scan" && interactionType !== 10) {
        return buildMissionSubmitResult(false, "当前节点不是找一找。", null)
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
        if (score > 0) {
          cinema.showScore(score)
        }

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
        return buildMissionSubmitResult(false, "当前没有可跳过的节点。", null)
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

      // 1~9 闯关：同样强制跳过
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
          if (score > 0) {
            cinema.showScore(score)
          }
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

    // 筛选变更强制重拉；不在 store 创建时 immediate，避免抢在鉴权前打 PageList
    watch(
      () => ({ ...filters }),
      () => {
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
      archiveEntries,
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
      pick: ["activeSession", "archiveEntries", "filters"],
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMissionStore, import.meta.hot))
}
