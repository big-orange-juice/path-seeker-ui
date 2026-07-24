import type {
  ChoiceOption,
  HintLevel,
  ObserveChoicePayload,
  PuzzleAnswerDraft,
  PuzzlePayloadMap,
  PuzzleTemplateType,
} from "@path-seeker/game-renderer"
import type {
  AgeBand,
  DifficultyLevel,
  ScaleTypeCode,
} from "@path-seeker/ts-shared"

export type { AgeBand, DifficultyLevel, ScaleTypeCode }

/** @deprecated 规模请用 ScaleTypeCode；保留兼容旧存档字段 */
export type TaskKind = "family_adventure" | "story_detective" | "deep_reasoning"

export type ShellTab = "hall" | "playing" | "archive"

export interface SchemaMappedOption<TValue extends string> {
  label: string
  value: TValue
  schemaValue: number
  description: string
}

export interface MissionPersona {
  id: string
  code: string
  name: string
  intro?: string
  avatar?: string
  voiceStyle?: string
}

export interface MissionSchemaMeta {
  ageGroup: number
  difficultyLevel: number
  scaleType: number
}

export interface MissionRouteCard {
  id: string
  hallId?: string
  routeCode?: string
  title: string
  /** schema 有则展示，无则隐藏 */
  theme?: string
  /** 详情 intro；列表卡不保证 */
  summary?: string
  recommendedAgeBand: AgeBand
  availableAgeBands: AgeBand[]
  /** 产品键 L1/L2/L3，对应后端 1/2/3 = 简单/中等/困难 */
  difficultyLevel: DifficultyLevel
  /** 后端 scaleType：1 小型 / 2 中型 / 3 大型 */
  scaleType: ScaleTypeCode
  /** @deprecated 请用 scaleType */
  taskKind: TaskKind
  estimatedMinutes?: number
  totalScore?: number
  puzzleCount: number
  chapterCount: number
  allowTeam: boolean
  /** 列表卡 schema 不保证；终局见 RouteResult.rewardTitle */
  rewardTitle?: string
  startLocation?: string
  badgeLabel?: string
  coverImageUrl?: string
  persona?: MissionPersona | null
  taglines?: string[]
  schemaMeta: MissionSchemaMeta
}

export interface StoryBeat {
  eyebrow?: string
  title?: string
  content?: string
}

export interface ArtifactClue {
  id: string
  title: string
  subtitle?: string
  location?: string
  observationPoint?: string
  storyFragment?: string
  suspiciousPoint?: string
  checklist: string[]
  detailCallout?: string
}

export type {
  ChoiceOption,
  HintLevel,
  ObserveChoicePayload,
  PuzzlePayloadMap,
  PuzzleTemplateType,
}

export interface PuzzleReward {
  clueId: string
  clueTitle: string
  fragmentId: string
  fragmentTitle: string
}

export interface BaseMissionPuzzle<TTemplate extends PuzzleTemplateType> {
  id: string
  puzzleTypeId: number
  interactionType?: number | null
  templateType: TTemplate
  title: string
  introText: string
  prompt: string
  difficultyLevel: DifficultyLevel
  schemaMeta: MissionSchemaMeta
  questionPayload: PuzzlePayloadMap[TTemplate]
  hintPayload: Record<HintLevel, string>
  reward: PuzzleReward
  successCopy: string
  failureCopy: string
}

export type MissionPuzzle =
  | BaseMissionPuzzle<"observe_choice">
  | BaseMissionPuzzle<"image_puzzle">

/** 节点运行时分类：决定 H5 进入哪条页面链路 */
export type MissionStageKind = "observe_choice" | "image_puzzle" | "find_scan" | "narration"

export interface MissionChapter {
  id: string
  stageNo: number
  /** 展示序号优先 sortOrder */
  sortOrder?: number
  title: string
  objective?: string
  /** 有则展示；Stages 无位置时可能为空，由 Detail.nodes / Exhibit 回填 */
  targetLocation?: string
  resultNarrative?: string
  nextTarget?: string
  /** 关联展品 ID（string 透传） */
  refExhibitId?: string
  /** 短视频可播放 URL；无则播片页用默认片 + 跳过 */
  videoUrl?: string
  /** 运行时仅接受 1/6 题面、10 找一找与 11 解说；非法类型在适配层过滤。 */
  interactionType: number
  /** 由 interactionType 推导的页面分流 */
  stageKind: MissionStageKind
  artifact: ArtifactClue
  puzzle: MissionPuzzle
}

export interface MissionFinale {
  title?: string
  truth?: string
  debrief?: string
  knowledgeNotes: string[]
  scoreTitle?: string
  shareLine?: string
}

/** 服务端 RouteResult 映射，终局页优先展示 */
export interface MissionRouteBadge {
  id: string
  name: string
  description?: string
  iconUrl?: string
  rarity?: number
}

export interface MissionRouteCollectible {
  id: string
  name: string
  description?: string
  iconUrl?: string
  type?: number
  rarity?: number
}

export interface MissionShareCard {
  nickname?: string
  routeTitle?: string
  theme?: string
  rewardTitle?: string
  totalScore: number
  solvedCount: number
  puzzleCount: number
  durationSec?: number | null
  noCluePerfect: boolean
  completedAt?: string | null
  shareCode?: string
}

export interface MissionRouteResult {
  routeId: string
  teamId?: string | null
  isTeamMode: boolean
  routeTitle: string
  theme?: string
  rewardTitle?: string
  status: number
  completed: boolean
  totalScore: number
  solvedCount: number
  puzzleCount: number
  usedClueCount: number
  noCluePerfect: boolean
  durationSec?: number | null
  startedAt?: string | null
  completedAt?: string | null
  badges: MissionRouteBadge[]
  collectibles: MissionRouteCollectible[]
  shareCard?: MissionShareCard | null
}

export interface MissionDetail extends MissionRouteCard {
  museumName: string
  prologue: StoryBeat[]
  chapters: MissionChapter[]
  finale: MissionFinale
}

export type MissionAnswerDraft = PuzzleAnswerDraft

export interface ChapterResultSnapshot {
  routeId: string
  chapterId: string
  chapterTitle: string
  narrative: string
  unlockedClue: PuzzleReward
  gainedScore: number
  usedHints: HintLevel[]
  perfectClear: boolean
  finalChapter: boolean
}

/** 单站本地闸门进度（识别/播片暂无公开后端接口，前端本地维护，可跳过） */
export interface ChapterGateProgress {
  recognized: boolean
  videoWatched: boolean
  solved: boolean
}

export interface MissionSession {
  sessionId: string
  routeId: string
  routeTitle: string
  source: "remote"
  teamId?: string | null
  selectedAgeBand: AgeBand
  currentChapterIndex: number
  solvedChapterIds: string[]
  unlockedClueIds: string[]
  unlockedRewardIds: string[]
  hintHistory: Record<string, HintLevel[]>
  draftHistory: Record<string, MissionAnswerDraft | null>
  /** 按章节 ID 记录识别/播片/通关闸门；识别与播片可跳过 */
  chapterProgress: Record<string, ChapterGateProgress>
  totalScore: number
  startedAt: string
  status: "in_progress" | "completed"
  latestChapterResult: ChapterResultSnapshot | null
}

/** @deprecated 本地归档已废弃，请用 MissionRouteHistoryItem */
export interface MissionArchiveEntry {
  routeId: string
  routeTitle: string
  rewardTitle: string
  completedAt: string
  difficultyLabel: string
  /** 规模文案：小型 / 中型 / 大型 */
  scaleLabel: string
  /** @deprecated 请用 scaleLabel */
  taskKind?: TaskKind
  totalScore: number
  solvedCount: number
  puzzleCount: number
  usedHintCount: number
}

/** 服务端游玩历史 / 已完成路线条目 */
export interface MissionRouteHistoryItem {
  routeId: string
  routeTitle: string
  theme?: string
  coverImageUrl?: string
  museumId?: string
  teamId?: string | null
  /** 1=进行中 2=已完成 3=已放弃 4=失败 */
  status: number
  solvedCount: number
  puzzleCount: number
  totalScore: number
  usedClueCount: number
  startedAt?: string | null
  completedAt?: string | null
  durationSec?: number | null
  /** 足迹序号（MyFootprints 有值） */
  footprintNo?: number
}

export interface MissionFilters {
  /** @deprecated 首页筛选不再用年龄 */
  ageBand?: AgeBand | "all"
  difficulty: DifficultyLevel | "all"
  /** 规模筛选，对应 scaleType 1-3 */
  scaleType: ScaleTypeCode | "all"
  /** 标题关键字 */
  keyword: string
  /** @deprecated 请用 scaleType */
  taskKind?: TaskKind | "all"
}
