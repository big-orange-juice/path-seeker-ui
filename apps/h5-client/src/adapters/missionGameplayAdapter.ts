import type {
  RouteCardResponse,
  RoutePageQueryRequest,
  RoutePageResult,
  StageHintResponse,
  StageSubmitResponse,
  UnlockHintResponse,
} from "@/services/gameplay"
import type {
  AgeBand,
  DifficultyLevel,
  HintLevel,
  MissionArchiveEntry,
  MissionChapter,
  MissionDetail,
  MissionRouteCard,
  MissionSchemaMeta,
  MissionSession,
  TaskKind,
} from "@/types/mission"

function countUsedHints(session: MissionSession) {
  return Object.values(session.hintHistory).reduce((total, item) => total + item.length, 0)
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

export function buildMissionArchiveEntry(
  session: MissionSession,
  mission: MissionDetail,
  difficultyLabel: string,
): MissionArchiveEntry {
  return {
    routeId: mission.id,
    routeTitle: mission.title,
    rewardTitle: mission.rewardTitle || "",
    completedAt: new Date().toISOString(),
    difficultyLabel,
    taskKind: mission.taskKind,
    totalScore: session.totalScore,
    solvedCount: session.solvedChapterIds.length,
    puzzleCount: mission.chapterCount,
    usedHintCount: countUsedHints(session),
  }
}

export function buildRouteTaglines(input: { allowTeam?: number | null }) {
  const taglines: string[] = []

  if ((input.allowTeam ?? 0) === 1) {
    taglines.push("支持组队")
  }

  return taglines
}

export function buildRoutePageQuery(input: {
  museumId?: string | null
  ageBand: AgeBand | "all"
  difficulty: DifficultyLevel | "all"
  taskKind: TaskKind | "all"
}): RoutePageQueryRequest {
  return {
    pageIndex: 1,
    pageSize: 100,
    museumId: input.museumId || null,
    scaleType: input.taskKind === "all" ? null : TASK_KIND_FILTER_MAP[input.taskKind],
    difficultyLevel: input.difficulty === "all" ? null : DIFFICULTY_FILTER_MAP[input.difficulty],
    ageGroup: input.ageBand === "all" ? null : AGE_GROUP_FILTER_MAP[input.ageBand],
    publishStatus: 2,
    auditStatus: null,
    keyword: null,
  }
}

export function adaptRemoteRouteCard(route: RouteCardResponse): MissionRouteCard | null {
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
    recommendedAgeBand,
    availableAgeBands: [recommendedAgeBand],
    difficultyLevel,
    taskKind,
    estimatedMinutes: route.estimatedMinutes ?? 0,
    totalScore: route.totalScore ?? 0,
    puzzleCount,
    chapterCount: puzzleCount,
    allowTeam: (route.allowTeam ?? 0) === 1,
    rewardTitle: normalizeText(route.rewardTitle) || undefined,
    startLocation: undefined,
    badgeLabel: undefined,
    persona: route.persona || route.personaId
      ? {
        id: normalizeText(route.persona?.id ?? route.personaId),
        code: normalizeText(route.persona?.personaCode),
        name: normalizeText(route.persona?.name),
        avatar: normalizeText(route.persona?.avatarUrl) || undefined,
      }
      : null,
    taglines: buildRouteTaglines(route),
    schemaMeta,
  }
}

export function resolveRouteList(response: RoutePageResult | unknown): RouteCardResponse[] {
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

export function resolveRouteTotal(response: RoutePageResult | unknown, fallback: number) {
  if (!response || typeof response !== "object") {
    return fallback
  }

  const value = (response as RoutePageResult).total
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export interface MissionSubmitResult {
  isCorrect: boolean
  message: string
  snapshot: MissionSession["latestChapterResult"]
}

export function buildMissionSubmitResult(
  success: boolean,
  message: string,
  snapshot: MissionSession["latestChapterResult"],
): MissionSubmitResult {
  return {
    isCorrect: success,
    message,
    snapshot,
  }
}

export function appendArchiveEntry(
  entries: MissionArchiveEntry[],
  nextEntry: MissionArchiveEntry,
) {
  return [nextEntry, ...entries.filter((item) => item.routeId !== nextEntry.routeId)].slice(0, 20)
}

export function resolveStageHintTarget(
  hints: StageHintResponse[],
  usedCount: number,
) {
  const sortedHints = [...hints].sort(
    (left, right) => Number(left.sortOrder ?? left.clueNo ?? 0) - Number(right.sortOrder ?? right.clueNo ?? 0),
  )

  return sortedHints[usedCount] || sortedHints.find((hint) => !hint.isUnlocked) || sortedHints[0] || null
}

export function resolveUnlockedHintText(
  unlocked: UnlockHintResponse | { hint?: StageHintResponse | null; message?: string | null },
  fallbackHint?: StageHintResponse | null,
) {
  return unlocked.hint?.content || fallbackHint?.content || unlocked.message || ""
}

export function shouldMarkRouteCompleted(response: StageSubmitResponse) {
  return Boolean(response.routeCompleted || response.teamRouteCompleted)
}
