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
 * 这样做的目的不是减少能力，而是先稳定住运行时：
 * - 每个题型对应一个专用 renderer
 * - 后台预览后面也能复用同一套注册表
 * - 埋点、配置、mock 数据都围绕固定 templateType 工作
 */
export const FIXED_PUZZLE_TEMPLATE_TYPES = [
  "observe_choice",
  "clue_find",
  "sort",
  "match",
  "code_break"
] as const

/**
 * 题型模板 id。
 *
 * 主要用于：
 * - 渲染器注册
 * - payload 类型收窄
 * - 后台配置与运行时对齐
 */
export type PuzzleTemplateType = (typeof FIXED_PUZZLE_TEMPLATE_TYPES)[number]

/**
 * 渲染器侧的提示层级。
 *
 * 命名直接对齐玩家体验：
 * - observe：把用户拉回观察行为
 * - relation：说明线索之间的关系
 * - direct：给出最后一步的直接帮助
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

/**
 * `observe_choice` 的题面 payload。
 *
 * 这个 renderer 只需要：
 * - 提示文案
 * - 有限选项列表
 * - 正确选项 id
 *
 * 评分、审核、后台统计等信息不应该进入这个层。
 */
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
}

/**
 * `clue_find` 的题面 payload。
 */
export interface ClueFindPayload {
  prompt: string
  imageUrl: string
  targetDescription?: string | null
  hotspots: HotspotArea[]
  correctHotspotId: string
}

/**
 * `sort` 题型中的单个排序项。
 */
export interface SortItem {
  id: string
  label: string
  imageUrl?: string | null
}

/**
 * `sort` 的题面 payload。
 */
export interface SortPayload {
  prompt: string
  items: SortItem[]
  correctOrder: string[]
}

/**
 * `match` 题型中单侧的一项。
 */
export interface MatchEntry {
  id: string
  label: string
  imageUrl?: string | null
}

/**
 * `match` 题型里的一条正确配对关系。
 */
export interface MatchPair {
  leftId: string
  rightId: string
}

/**
 * `match` 的题面 payload。
 */
export interface MatchPayload {
  prompt: string
  left: MatchEntry[]
  right: MatchEntry[]
  correctPairs: MatchPair[]
}

/**
 * `code_break` 的题面 payload。
 *
 * 线索碎片是可选的，因为有些路线会把线索展示放在章节页，而不是直接放在
 * 渲染器内部。
 */
export interface CodeBreakPayload {
  prompt: string
  codeLength: number
  acceptedCode: string
  clueFragments?: string[]
  maskCharacter?: string | null
}

/**
 * templateType 到具体 payload 的映射表。
 *
 * 这一层非常重要，因为后续可以直接据此构建：
 * `Record<PuzzleTemplateType, RendererComponent>`
 */
export interface PuzzlePayloadMap {
  observe_choice: ObserveChoicePayload
  clue_find: ClueFindPayload
  sort: SortPayload
  match: MatchPayload
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
export type CodeBreakPuzzleDefinition = BasePuzzleDefinition<"code_break">

/**
 * 固定题型的判别联合。
 *
 * 应用层可以通过 `templateType` 自动收窄到对应 payload。
 */
export type PuzzleDefinition =
  | ObserveChoicePuzzleDefinition
  | ClueFindPuzzleDefinition
  | SortPuzzleDefinition
  | MatchPuzzleDefinition
  | CodeBreakPuzzleDefinition

/**
 * 所有具体 renderer 统一接收的输入对象。
 */
export interface PuzzleRendererInput<TPuzzle extends PuzzleDefinition = PuzzleDefinition> {
  puzzle: TPuzzle
  readonlyMode?: boolean
  activeHintLevel?: HintLevel | null
}

/**
 * renderer 输出给应用外壳的归一化答案草稿。
 *
 * 这一步还不是最终 transport payload，只是把各类交互结果先收敛成统一结构。
 * 真正发请求前，应用 adapter 还可以继续编码或转换。
 */
export interface PuzzleAnswerDraft {
  templateType: PuzzleTemplateType
  value: string | string[] | MatchPair[] | HotspotArea | null
}
