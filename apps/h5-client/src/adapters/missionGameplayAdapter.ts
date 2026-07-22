import type {
  PublishedRouteQueryRequest,
  RouteCardResponse,
  RoutePageResult,
  StageHintResponse,
  StageSubmitResponse,
  UnlockHintResponse,
} from "@/services/gameplay"
import {
  difficultyLevelCodeToKey,
  difficultyLevelKeyToCode,
  getDifficultyLevelLabel,
  getScaleTypeLabel,
  toScaleTypeCode,
  type AgeBand,
  type DifficultyLevel,
  type ScaleTypeCode,
} from "@path-seeker/ts-shared"
import type {
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

/** 兼容旧 taskKind 字段的展示映射（不再表示玩法类型） */
const SCALE_TO_TASK_KIND: Record<ScaleTypeCode, TaskKind> = {
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

function resolveDifficultyLevel(level?: number | null): DifficultyLevel {
  return difficultyLevelCodeToKey(level)
}

function resolveScaleType(scaleType?: number | null): ScaleTypeCode {
  return toScaleTypeCode(scaleType, 2)
}

export function buildMissionArchiveEntry(
  session: MissionSession,
  mission: MissionDetail,
  difficultyLabel: string,
  overrides?: {
    rewardTitle?: string
    totalScore?: number
    solvedCount?: number
    puzzleCount?: number
    usedHintCount?: number
    completedAt?: string | null
  },
): MissionArchiveEntry {
  const scaleType = mission.scaleType ?? resolveScaleType(mission.schemaMeta?.scaleType)
  return {
    routeId: mission.id,
    routeTitle: mission.title,
    rewardTitle: overrides?.rewardTitle || mission.rewardTitle || "",
    completedAt: overrides?.completedAt || new Date().toISOString(),
    difficultyLabel: difficultyLabel || getDifficultyLevelLabel(mission.difficultyLevel),
    scaleLabel: getScaleTypeLabel(scaleType),
    taskKind: SCALE_TO_TASK_KIND[scaleType],
    totalScore: overrides?.totalScore ?? session.totalScore,
    solvedCount: overrides?.solvedCount ?? session.solvedChapterIds.length,
    puzzleCount: overrides?.puzzleCount ?? mission.chapterCount,
    usedHintCount: overrides?.usedHintCount ?? countUsedHints(session),
  }
}

export function buildRouteTaglines(input: { allowTeam?: number | null }) {
  const taglines: string[] = []

  if ((input.allowTeam ?? 0) === 1) {
    taglines.push("支持组队")
  }

  return taglines
}

/** 构建 C 端已发布路线查询体（POST /Route/Published） */
export function buildRoutePageQuery(input: {
  museumId?: string | null
  ageBand: AgeBand | "all"
  difficulty: DifficultyLevel | "all"
  scaleType: ScaleTypeCode | "all"
  keyword?: string | null
  pageIndex?: number
  pageSize?: number
}): PublishedRouteQueryRequest {
  return {
    pageIndex: input.pageIndex ?? 1,
    pageSize: input.pageSize ?? 100,
    museumId: input.museumId || null,
    scaleType: input.scaleType === "all" ? null : input.scaleType,
    difficultyLevel:
      input.difficulty === "all" ? null : difficultyLevelKeyToCode(input.difficulty),
    ageGroup: input.ageBand === "all" ? null : AGE_GROUP_FILTER_MAP[input.ageBand],
    keyword: input.keyword?.trim() || null,
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
  const scaleType = resolveScaleType(route.scaleType)
  const taskKind = SCALE_TO_TASK_KIND[scaleType]
  const puzzleCount = route.puzzleCount ?? 0
  const schemaMeta: MissionSchemaMeta = {
    ageGroup: route.ageGroup ?? AGE_GROUP_FILTER_MAP[recommendedAgeBand],
    difficultyLevel: route.difficultyLevel ?? difficultyLevelKeyToCode(difficultyLevel),
    scaleType: route.scaleType ?? scaleType,
  }

  // 列表卡严格跟 schema：无 intro/rewardTitle 则不编造；有则展示
  const theme = normalizeText(route.theme) || undefined
  const summary = normalizeText(route.intro) || undefined
  const rewardTitle = normalizeText(route.rewardTitle) || undefined
  const hallId = normalizeText(route.museumId) || undefined
  const routeCode = normalizeText(route.routeCode) || undefined
  const coverImageUrl = normalizeText(route.coverImageUrl) || undefined

  return {
    id,
    hallId,
    routeCode,
    title,
    theme,
    summary,
    recommendedAgeBand,
    availableAgeBands: [recommendedAgeBand],
    difficultyLevel,
    scaleType,
    taskKind,
    estimatedMinutes: route.estimatedMinutes ?? undefined,
    totalScore: route.totalScore ?? undefined,
    puzzleCount,
    chapterCount: puzzleCount,
    allowTeam: (route.allowTeam ?? 0) === 1,
    rewardTitle,
    coverImageUrl,
    startLocation: undefined,
    badgeLabel: undefined,
    persona: route.persona || route.personaId
      ? {
        id: normalizeText(route.persona?.id ?? route.personaId),
        code: normalizeText(route.persona?.personaCode),
        name: normalizeText(route.persona?.name),
        avatar: normalizeText(route.persona?.avatarUrl) || undefined,
        intro: normalizeText(route.persona?.intro) || undefined,
        voiceStyle: normalizeText(route.persona?.voiceStyle) || undefined,
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
