/**
 * 渲染器侧共享题型契约。
 *
 * 边界要非常清楚：
 * - 这里只描述渲染器真正需要的输入和输出
 * - 不尝试完整镜像后端 swagger 的所有题目字段
 * - transport DTO -> 渲染器契约 的映射仍由应用自己的 adapter 完成
 */

/**
 * 首期固定的题型集合。
 *
 * 当前直接对齐后端规划的 8 类核心交互：
 * - 基础观察与判断
 * - 排序 / 配对 / 密码
 * - 更强调动效反馈的拼图 / 剧情分支 / 多步推理
 */
export const FIXED_PUZZLE_TEMPLATE_TYPES = [
  "observe_choice",
  "clue_find",
  "sort",
  "match",
  "image_puzzle",
  "story_branch",
  "multi_step_reasoning",
  "code_break",
] as const

/**
 * 题型模板 id。
 */
export type PuzzleTemplateType = (typeof FIXED_PUZZLE_TEMPLATE_TYPES)[number]

/**
 * 渲染器侧的提示层级。
 */
export type HintLevel = "observe" | "relation" | "direct"

/**
 * 观察选择题里的单个选项。
 */
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

/**
 * `clue_find` 题型里的单个热点区域。
 *
 * 坐标统一采用百分比，避免不同屏幕尺寸下还要重新计算后端返回值。
 */
export interface HotspotArea {
  id: string
  x: number
  y: number
  width: number
  height: number
  label?: string | null
}

export interface ClueFindPayload {
  prompt: string
  imageUrl?: string | null
  targetDescription?: string | null
  hotspots: HotspotArea[]
  correctHotspotId: string
}

export interface SortItem {
  id: string
  label: string
  imageUrl?: string | null
}

export interface SortPayload {
  prompt: string
  items: SortItem[]
  correctOrder: string[]
}

export interface MatchEntry {
  id: string
  label: string
  imageUrl?: string | null
}

export interface MatchPair {
  leftId: string
  rightId: string
}

export interface MatchPayload {
  prompt: string
  left: MatchEntry[]
  right: MatchEntry[]
  correctPairs: MatchPair[]
}

/**
 * 拼图题使用文本碎片和槽位定义。
 *
 * 这样 mock 阶段不依赖真实图片切片，也能先把交互和动效完整跑通。
 */
export interface ImagePuzzlePiece {
  id: string
  label: string
  hint?: string | null
}

export interface ImagePuzzlePayload {
  prompt: string
  imageUrl?: string | null
  gridSize: number
  pieces: ImagePuzzlePiece[]
  correctOrder: string[]
  revealTitle?: string | null
  trayTitle?: string | null
}

export interface StoryBranchOption {
  id: string
  label: string
  summary?: string | null
  outcomeTitle?: string | null
  outcomeText?: string | null
}

export interface StoryBranchPayload {
  prompt: string
  sceneIntro?: string | null
  options: StoryBranchOption[]
  correctOptionId: string
}

export interface ReasoningEvidence {
  id: string
  label: string
  note?: string | null
  tag?: string | null
}

export interface ReasoningConclusion {
  id: string
  label: string
  summary?: string | null
}

export interface MultiStepReasoningPayload {
  prompt: string
  evidence: ReasoningEvidence[]
  correctEvidenceOrder: string[]
  conclusions: ReasoningConclusion[]
  correctConclusionId: string
  chainTitle?: string | null
  slotLabels?: string[]
  conclusionTitle?: string | null
}

export interface CodeDerivationStep {
  id: string
  chapterLabel?: string | null
  sourceTitle: string
  rule: string
  result: string
}

export interface CodeBreakPayload {
  prompt: string
  codeLength: number
  acceptedCode: string
  clueFragments?: string[]
  derivationSteps?: CodeDerivationStep[]
  clueSourceTitle?: string | null
  maskCharacter?: string | null
}

/**
 * templateType 到具体 payload 的映射表。
 */
export interface PuzzlePayloadMap {
  observe_choice: ObserveChoicePayload
  clue_find: ClueFindPayload
  sort: SortPayload
  match: MatchPayload
  image_puzzle: ImagePuzzlePayload
  story_branch: StoryBranchPayload
  multi_step_reasoning: MultiStepReasoningPayload
  code_break: CodeBreakPayload
}

/**
 * 所有固定题型共享的基础字段。
 */
export interface BasePuzzleDefinition<TTemplate extends PuzzleTemplateType> {
  id: string
  templateType: TTemplate
  title: string
  prompt?: string
  introText?: string
  hintPayload?: Partial<Record<HintLevel, string>>
  answerPayload?: Record<string, unknown>
  questionPayload: PuzzlePayloadMap[TTemplate]
}

export type ObserveChoicePuzzleDefinition = BasePuzzleDefinition<"observe_choice">
export type ClueFindPuzzleDefinition = BasePuzzleDefinition<"clue_find">
export type SortPuzzleDefinition = BasePuzzleDefinition<"sort">
export type MatchPuzzleDefinition = BasePuzzleDefinition<"match">
export type ImagePuzzleDefinition = BasePuzzleDefinition<"image_puzzle">
export type StoryBranchPuzzleDefinition = BasePuzzleDefinition<"story_branch">
export type MultiStepReasoningPuzzleDefinition = BasePuzzleDefinition<"multi_step_reasoning">
export type CodeBreakPuzzleDefinition = BasePuzzleDefinition<"code_break">

/**
 * 固定题型的判别联合。
 */
export type PuzzleDefinition =
  | ObserveChoicePuzzleDefinition
  | ClueFindPuzzleDefinition
  | SortPuzzleDefinition
  | MatchPuzzleDefinition
  | ImagePuzzleDefinition
  | StoryBranchPuzzleDefinition
  | MultiStepReasoningPuzzleDefinition
  | CodeBreakPuzzleDefinition

export interface PuzzleRendererInput<TPuzzle extends PuzzleDefinition = PuzzleDefinition> {
  puzzle: TPuzzle
  readonlyMode?: boolean
  activeHintLevel?: HintLevel | null
}

export interface ReasoningAnswerValue {
  evidenceOrder: string[]
  conclusionId: string | null
}

/**
 * renderer 输出给应用外壳的归一化答案草稿。
 */
export interface PuzzleAnswerDraft {
  templateType: PuzzleTemplateType
  value: string | string[] | MatchPair[] | ReasoningAnswerValue | null
}

export interface GameplayPreviewStage {
  stageId: string
  interactionType: number
  title: string
  subtitle?: string | null
  exhibitName?: string | null
  galleryName?: string | null
  score?: number
  config: Record<string, unknown>
}
