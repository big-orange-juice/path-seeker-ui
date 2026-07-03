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
  difficulty: DifficultyLevel | "all"
}

interface PublishedRouteQueryRequest {
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

const TASK_KIND_LABEL_MAP: Record<TaskKind, string> = {
  family_adventure: "亲子冒险",
  story_detective: "剧情推理",
  deep_reasoning: "深度推理",
}

const remoteRouteCache = shallowRef<MissionRouteCard[]>([])

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

function buildTaglines(route: RouteAdminResponse, taskKind: TaskKind) {
  const taglines: string[] = []

  if ((route.allowTeam ?? 0) === 1) {
    taglines.push("支持组队")
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
    theme: normalizeText(route.theme) || TASK_KIND_LABEL_MAP[taskKind],
    summary: normalizeText(route.intro) || "暂无简介",
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
    rewardTitle: normalizeText(route.rewardTitle) || "完成任务",
    startLocation: "",
    badgeLabel: route.publishStatus === 2 ? "已发布" : "草稿",
    persona: {
      id: normalizeText(route.personaId) || "remote-persona",
      code: "remote-persona",
      name: "任务",
      intro: "",
      avatar: "任",
      voiceStyle: "",
    },
    taglines: buildTaglines(route, taskKind),
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
      const response = await request<RoutePageResult>("/api/Route/Published", {
        method: "POST",
        data: {
          pageIndex: 1,
          pageSize: 100,
          difficultyLevel: filters.difficulty === "all" ? null : DIFFICULTY_FILTER_MAP[filters.difficulty],
          keyword: null,
        } satisfies PublishedRouteQueryRequest,
      })

      const nextRoutes = (Array.isArray(response?.list) ? response.list : [])
        .map(adaptRemoteRoute)
        .filter((route): route is MissionRouteCard => Boolean(route))

      routes.value = nextRoutes
      remoteRouteCache.value = nextRoutes
      total.value = Number(response?.total || nextRoutes.length)
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
