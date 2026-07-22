/**
 * 渲染器侧共享题型契约。
 *
 * transport DTO 到这里的映射只允许经过 adaptStage.ts。渲染层只保留当前
 * 产品实际支持的两种答题玩法；扫描和导览是独立的页面流。
 */
export const FIXED_PUZZLE_TEMPLATE_TYPES = [
  "observe_choice",
  "image_puzzle",
] as const

export type PuzzleTemplateType = (typeof FIXED_PUZZLE_TEMPLATE_TYPES)[number]

/** 当前产品仅支持的路线节点交互类型。 */
export const SUPPORTED_INTERACTION_TYPES = [1, 6, 10, 11] as const

export type SupportedInteractionType = (typeof SUPPORTED_INTERACTION_TYPES)[number]

export const INTERACTION_TYPE_META = {
  1: { label: "线性答题", className: "answer" },
  6: { label: "纹样拼图", className: "jigsaw" },
  10: { label: "找一找", className: "find" },
  11: { label: "解说导览", className: "narration" },
} as const

export type InteractionType = keyof typeof INTERACTION_TYPE_META

export function isSupportedInteractionType(
  interactionType?: number | null,
): interactionType is SupportedInteractionType {
  return SUPPORTED_INTERACTION_TYPES.includes(
    Number(interactionType) as SupportedInteractionType,
  )
}

export function getInteractionTypeMeta(interactionType?: number | null) {
  return INTERACTION_TYPE_META[interactionType as InteractionType] ?? null
}

export type HintLevel = "observe" | "relation" | "direct"

export interface ChoiceOption {
  id: string
  label: string
  imageUrl?: string | null
  description?: string | null
}

export interface ObserveChoicePayload {
  prompt: string
  options: ChoiceOption[]
  correctOptionId: string
}

export interface ImagePuzzlePiece {
  id: string
  label: string
  hint?: string | null
  imageUrl?: string | null
}

export interface ImagePuzzlePayload {
  prompt: string
  imageUrl?: string | null
  gridSize: number
  gridRows?: number
  gridCols?: number
  pieces: ImagePuzzlePiece[]
  correctOrder: string[]
  revealTitle?: string | null
  trayTitle?: string | null
}

export interface PuzzlePayloadMap {
  observe_choice: ObserveChoicePayload
  image_puzzle: ImagePuzzlePayload
}

export interface BasePuzzleDefinition<TTemplate extends PuzzleTemplateType> {
  id: string
  templateType: TTemplate
  interactionType?: number | null
  title: string
  prompt?: string
  introText?: string
  hintPayload?: Partial<Record<HintLevel, string>>
  answerPayload?: Record<string, unknown>
  questionPayload: PuzzlePayloadMap[TTemplate]
}

export type ObserveChoicePuzzleDefinition = BasePuzzleDefinition<"observe_choice">
export type ImagePuzzleDefinition = BasePuzzleDefinition<"image_puzzle">
export type PuzzleDefinition = ObserveChoicePuzzleDefinition | ImagePuzzleDefinition

export interface PuzzleRendererInput<TPuzzle extends PuzzleDefinition = PuzzleDefinition> {
  puzzle: TPuzzle
  readonlyMode?: boolean
  activeHintLevel?: HintLevel | null
}

export interface PuzzleAnswerDraft {
  templateType: PuzzleTemplateType
  value: string | string[] | null
}

export const NARRATION_AUDIO_STATUS = {
  NotGenerated: 0,
  Queued: 1,
  Generating: 2,
  Completed: 3,
  Failed: 4,
  Stale: 5,
} as const

export type NarrationAudioStatusCode =
  (typeof NARRATION_AUDIO_STATUS)[keyof typeof NARRATION_AUDIO_STATUS]

/**
 * 解说配图（来自 Narration detail.images，不在 node.config 内）。
 * id 为雪花主键，一律 string。
 */
export interface NarrationImageItem {
  id?: string | null
  imageUrl?: string | null
  sortOrder?: number | null
}

export interface GameplayPreviewNarration {
  narrationText?: string | null
  audioUrl?: string | null
  guideId?: string | null
  guideName?: string | null
  resolvedStyle?: string | null
  durationMs?: number | null
  textStatus?: number | null
  audioStatus?: number | null
  textError?: string | null
  /** 配图列表；渲染侧优先展示，不读 config.user_style_input / scene_context */
  images?: NarrationImageItem[] | null
}

export type GameplayPreviewNarrationStatus = "idle" | "loading" | "ready" | "error"

export interface GameplayPreviewStage {
  stageId: string
  interactionType: number
  title: string
  subtitle?: string | null
  exhibitName?: string | null
  galleryName?: string | null
  score?: number
  config: Record<string, unknown>
  narration?: GameplayPreviewNarration | null
  narrationStatus?: GameplayPreviewNarrationStatus
  narrationErrorMessage?: string | null
}

/**
 * 解说节点 config 仍可含风格/场景（生成用）；
 * 渲染侧不再展示 user_style_input / scene_context，配图走 detail.images。
 */
export interface NarrationStageConfig {
  guide_id?: number | string | null
  user_style_input?: string | null
  scene_context?: string | null
  target_duration_seconds?: number | null
  hints?: unknown
  narration_text?: string | null
  audio_url?: string | null
}

export interface FindScanStageConfig {
  clue_text?: string | null
  clue?: string | null
  rule_hint?: string | null
  target_hint?: string | null
  scene_context?: string | null
  location?: string | null
  gallery_name?: string | null
  target_exhibit_name?: string | null
}