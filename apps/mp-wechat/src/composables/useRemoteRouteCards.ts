import { computed, shallowRef, watch } from "vue"
import { request, resolveRequestErrorMessage } from "@/services/http"
import type {
  AgeBand,
  DifficultyLevel,
  MissionRouteCard,
  MissionSchemaMeta,
  TaskKind,
} from "@/types/mission"

interface RouteFilters {
  ageBand: AgeBand | "all"
  difficulty: DifficultyLevel | "all"
  taskKind: TaskKind | "all"
}

interface RoutePageQueryRequest {
  pageIndex: number
  pageSize: number
  museumId?: string | null
  scaleType?: number | null
  difficultyLevel?: number | null
  ageGroup?: number | null
  publishStatus?: number | null
  auditStatus?: number | null
  keyword?: string | null
}

interface RouteAdminResponse {
  id?: string | null
  routeCode?: string | null
  routeType?: number
  museumId?: string | null
  title?: string | null
  theme?: string | null
  coverImageUrl?: string | null
  personaId?: string | null
  scaleType?: number
  difficultyLevel?: number
  ageGroup?: number
  allowTeam?: number
  minTeamSize?: number
  maxTeamSize?: number
  estimatedMinutes?: number | null
  totalScore?: number
  puzzleCount?: number
  intro?: string | null
  rewardTitle?: string | null
  publishStatus?: number
  auditStatus?: number
  auditRemark?: string | null
  sortOrder?: number
}

interface RoutePageResult {
  list?: RouteAdminResponse[] | null
  pageIndex?: number
  pageSize?: number
  total?: number
  totalPages?: number
}

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

const remoteRouteCache = shallowRef<MissionRouteCard[]>([])

function resolveRouteList(response: RoutePageResult | unknown): RouteAdminResponse[] {
  const source = response && typeof response === "object" ? response as Record<string, unknown> : {}
  const candidate = source.list ?? source.items ?? source.records ?? []

  if (Array.isArray(candidate)) {
    return candidate as RouteAdminResponse[]
  }

  if (candidate && typeof candidate === "object" && Array.isArray((candidate as { $values?: unknown[] }).$values)) {
    return (candidate as { $values: RouteAdminResponse[] }).$values
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

function buildTaglines(route: RouteAdminResponse) {
  const taglines: string[] = []

  if ((route.allowTeam ?? 0) === 1) {
    taglines.push('支持组队')
  }

  return taglines
}

function adaptRemoteRoute(route: RouteAdminResponse): MissionRouteCard | null {
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
    hallId: "",
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
      id: normalizeText(route.personaId),
      code: "",
      name: "",
      intro: "",
      avatar: "",
      voiceStyle: "",
    },
    taglines: buildTaglines(route),
    schemaMeta,
  }
}

export function getCachedRemoteRouteCard(routeId: string) {
  return remoteRouteCache.value.find((route) => route.id === routeId) ?? null
}

export function useRemoteRouteCards(getFilters: () => RouteFilters) {
  const routes = shallowRef<MissionRouteCard[]>([])
  const pending = shallowRef(false)
  const error = shallowRef("")
  const total = shallowRef(0)

  async function fetchRemoteRoutes() {
    pending.value = true
    error.value = ""

    try {
      const filters = getFilters()
      const response = await request<RoutePageResult>("/api/Route/PageList", {
        method: "POST",
        data: {
          pageIndex: 1,
          pageSize: 100,
          museumId: DEFAULT_MUSEUM_ID || null,
          scaleType: filters.taskKind === "all" ? null : TASK_KIND_FILTER_MAP[filters.taskKind],
          difficultyLevel: filters.difficulty === "all" ? null : DIFFICULTY_FILTER_MAP[filters.difficulty],
          ageGroup: filters.ageBand === "all" ? null : AGE_GROUP_FILTER_MAP[filters.ageBand],
          publishStatus: 2,
          auditStatus: null,
          keyword: null,
        } satisfies RoutePageQueryRequest,
      })

      const routeList = resolveRouteList(response)
      const nextRoutes = routeList
        .map(adaptRemoteRoute)
        .filter((route): route is MissionRouteCard => Boolean(route))

      routes.value = nextRoutes
      remoteRouteCache.value = nextRoutes
      total.value = resolveTotal(response, nextRoutes.length)
    } catch (fetchError) {
      routes.value = []
      remoteRouteCache.value = []
      total.value = 0
      error.value = resolveRequestErrorMessage(fetchError, "任务列表加载失败")
    } finally {
      pending.value = false
    }
  }

  watch(
    () => ({ ...getFilters() }),
    () => {
      void fetchRemoteRoutes()
    },
    { immediate: true, deep: true },
  )

  return {
    routes: computed(() => routes.value),
    pending,
    error,
    total: computed(() => total.value),
    reload: fetchRemoteRoutes,
  }
}


