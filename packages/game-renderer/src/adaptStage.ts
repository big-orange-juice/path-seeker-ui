/**
 * 后端 stage config 到渲染器 PuzzleDefinition 的唯一映射入口。
 *
 * 只有 interactionType 1 和 6 是答题节点。10（扫描）与 11（导览）走各自的
 * 页面流；其余历史类型一律不构造题目，避免被错误地降级为观察选择题。
 */
import type {
  ChoiceOption,
  ImagePuzzlePiece,
  PuzzleDefinition,
  PuzzleTemplateType,
} from "./contracts"

export const INTERACTION_TO_TEMPLATE_MAP = {
  1: "observe_choice",
  6: "image_puzzle",
} as const satisfies Record<number, PuzzleTemplateType>

export const PRIMARY_PUZZLE_TEMPLATES = [
  "observe_choice",
  "image_puzzle",
] as const satisfies readonly PuzzleTemplateType[]

export type StageKind = "observe_choice" | "image_puzzle" | "find_scan" | "narration"

export interface StageAdaptInput {
  stageId?: string | null
  title?: string | null
  subtitle?: string | null
  interactionType?: number | null
  puzzleType?: number | null
  config?: unknown
  answerExtra?: unknown
  puzzleContent?: string | null
  index?: number
}

export function isPrimaryPuzzleTemplate(type: PuzzleTemplateType) {
  return PRIMARY_PUZZLE_TEMPLATES.includes(type)
}

export function resolvePuzzleTemplateType(
  interactionType?: number | null,
): PuzzleTemplateType | null {
  return INTERACTION_TO_TEMPLATE_MAP[Number(interactionType) as keyof typeof INTERACTION_TO_TEMPLATE_MAP] ?? null
}

export function resolveStageKind(interactionType?: number | null): StageKind | null {
  switch (Number(interactionType)) {
    case 1:
      return "observe_choice"
    case 6:
      return "image_puzzle"
    case 10:
      return "find_scan"
    case 11:
      return "narration"
    default:
      return null
  }
}

export function isNarrationStage(interactionType?: number | null) {
  return resolveStageKind(interactionType) === "narration"
}

export function isFindScanStage(interactionType?: number | null) {
  return resolveStageKind(interactionType) === "find_scan"
}

export function isPuzzleInteraction(interactionType?: number | null) {
  const kind = resolveStageKind(interactionType)
  return kind === "observe_choice" || kind === "image_puzzle"
}

export function normalizeText(value: unknown, fallback = "") {
  const text = typeof value === "string" ? value.trim() : ""
  return text || fallback
}

export function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value
  }

  const text = value.trim()
  if (!text) {
    return null
  }

  try {
    const parsed = JSON.parse(text) as unknown
    return typeof parsed === "string" ? parseJsonValue(parsed) : parsed
  } catch {
    return value
  }
}

export function parseStageConfig(value: unknown): Record<string, any> {
  const parsed = parseJsonValue(value)
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, any>
    : {}
}

function asArray<T = any>(value: unknown): T[] {
  const parsed = parseJsonValue(value)
  if (Array.isArray(parsed)) {
    return parsed as T[]
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { $values?: unknown[] }).$values)) {
    return (parsed as { $values: T[] }).$values
  }
  return []
}

function pickValue(source: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null) {
      return value
    }
  }
  return undefined
}

function readItemText(item: any, ...keys: string[]) {
  for (const key of keys) {
    const value = item?.[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }
  return ""
}

function getAnswerExtra(config: Record<string, any>, answerExtra?: unknown) {
  return {
    ...parseStageConfig(pickValue(config, "answer_extra", "answerExtra", "AnswerExtra")),
    ...parseStageConfig(answerExtra),
  }
}

function makeChoiceOptions(rawOptions: any[], fallbackPrefix: string): ChoiceOption[] {
  return rawOptions.map((item, index) => ({
    id: normalizeText(item?.id ?? item?.key ?? item?.value, `${fallbackPrefix}-${index + 1}`),
    label: normalizeText(item?.label ?? item?.text ?? item?.title, `选项 ${index + 1}`),
    imageUrl: item?.image_url ?? item?.imageUrl ?? null,
    description: item?.description ?? item?.summary ?? null,
  }))
}

export function buildHintPayloadFromConfig(config: Record<string, any>) {
  const hints = asArray(config.hints)
  const values = [...hints]
    .sort((left: any, right: any) => Number(left?.sort_order ?? left?.sortOrder ?? 0) - Number(right?.sort_order ?? right?.sortOrder ?? 0))
    .map((item: any) => normalizeText(item?.content ?? item))
    .filter(Boolean)

  return { observe: values[0] || "", relation: values[1] || "", direct: values[2] || "" }
}

function resolveStageId(input: StageAdaptInput) {
  return normalizeText(input.stageId) || `stage-${(input.index ?? 0) + 1}`
}

function resolveContent(input: StageAdaptInput, config: Record<string, any>) {
  return normalizeText(input.puzzleContent, normalizeText(
    pickValue(config, "content", "Content", "prompt", "Prompt", "theme", "Theme", "rule_hint", "ruleHint", "RuleHint"),
  ))
}

function makeImagePieces(config: Record<string, any>): ImagePuzzlePiece[] {
  return asArray(config.pieces ?? config.items ?? config.fragments ?? config.options).map((item: any, index) => ({
    id: readItemText(item, "id", "Id", "key", "Key", "value", "Value") || `piece-${index + 1}`,
    label: readItemText(item, "label", "Label", "text", "Text", "title", "Title", "name", "Name") || `碎片 ${index + 1}`,
    hint: normalizeText(item?.hint ?? item?.description) || null,
    imageUrl: pickValue(item ?? {}, "image_url", "imageUrl", "ImageUrl", "url", "Url") ?? null,
  }))
}

export function adaptStageToPuzzle(input: StageAdaptInput): PuzzleDefinition | null {
  const config = parseStageConfig(input.config)
  const interactionType = Number(input.interactionType ?? input.puzzleType ?? 0)
  const templateType = resolvePuzzleTemplateType(interactionType)
  if (!templateType) {
    return null
  }

  const content = resolveContent(input, config)
  const base = {
    id: resolveStageId(input),
    interactionType,
    title: normalizeText(input.title, "未命名节点"),
    introText: normalizeText(input.subtitle) || undefined,
    prompt: content,
    hintPayload: buildHintPayloadFromConfig(config),
  }
  const answerExtra = getAnswerExtra(config, input.answerExtra)

  if (templateType === "observe_choice") {
    const options = makeChoiceOptions(asArray(config.options ?? config.choices ?? answerExtra.options), base.id)
    const correctOptionId = normalizeText(
      pickValue(answerExtra, "correct_option_id", "correctOptionId", "answer", "correct_answer")
      ?? pickValue(config, "correct_option_id", "correctOptionId", "answer", "correct_answer"),
    )
    return {
      ...base,
      templateType,
      questionPayload: { prompt: content, options, correctOptionId },
    }
  }

  const pieces = makeImagePieces(config)
  const correctOrder = asArray<string>(
    pickValue(answerExtra, "correct_order", "correctOrder", "answer")
    ?? pickValue(config, "correct_order", "correctOrder", "answer"),
  ).map((value) => String(value))

  return {
    ...base,
    templateType,
    questionPayload: {
      prompt: content,
      imageUrl: normalizeText(pickValue(config, "image_url", "imageUrl", "ImageUrl")) || null,
      gridSize: Math.max(1, Number(pickValue(config, "grid_size", "gridSize") ?? 3)),
      gridRows: Number(pickValue(config, "grid_rows", "gridRows")) || undefined,
      gridCols: Number(pickValue(config, "grid_cols", "gridCols")) || undefined,
      pieces,
      correctOrder,
      revealTitle: normalizeText(pickValue(config, "reveal_title", "revealTitle")) || null,
      trayTitle: normalizeText(pickValue(config, "tray_title", "trayTitle")) || null,
    },
  }
}