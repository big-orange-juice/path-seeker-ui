import type {
  ChoiceOption,
  ClueFindPayload,
  CodeBreakPayload,
  HintLevel,
  MatchPair,
  MatchPayload,
  ObserveChoicePayload,
  PuzzleAnswerDraft,
  PuzzlePayloadMap,
  PuzzleTemplateType,
  ReasoningAnswerValue,
  SelectPayload,
  SortPayload,
} from "@path-seeker/game-renderer"

export type AgeBand = "6-10" | "10-15" | "15+"

export type DifficultyLevel = "L1" | "L2" | "L3"

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
  hallId: string
  routeCode: string
  title: string
  theme: string
  summary: string
  recommendedAgeBand: AgeBand
  availableAgeBands: AgeBand[]
  difficultyLevel: DifficultyLevel
  taskKind: TaskKind
  estimatedMinutes: number
  totalScore?: number
  puzzleCount: number
  chapterCount: number
  allowTeam: boolean
  rewardTitle?: string
  startLocation?: string
  badgeLabel?: string
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
  subtitle: string
  location: string
  observationPoint?: string
  storyFragment?: string
  suspiciousPoint?: string
  checklist: string[]
  detailCallout?: string
}

export type {
  ChoiceOption,
  ClueFindPayload,
  CodeBreakPayload,
  HintLevel,
  MatchPair,
  MatchPayload,
  ObserveChoicePayload,
  PuzzlePayloadMap,
  PuzzleTemplateType,
  ReasoningAnswerValue,
  SelectPayload,
  SortPayload,
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
  | BaseMissionPuzzle<"select">
  | BaseMissionPuzzle<"clue_find">
  | BaseMissionPuzzle<"sort">
  | BaseMissionPuzzle<"match">
  | BaseMissionPuzzle<"image_puzzle">
  | BaseMissionPuzzle<"story_branch">
  | BaseMissionPuzzle<"multi_step_reasoning">
  | BaseMissionPuzzle<"code_break">

export interface MissionChapter {
  id: string
  stageNo: number
  title: string
  objective?: string
  targetLocation: string
  resultNarrative?: string
  nextTarget?: string
  artifact: ArtifactClue
  puzzle: MissionPuzzle
}

export interface MissionFinale {
  title: string
  truth: string
  debrief: string
  knowledgeNotes: string[]
  scoreTitle: string
  shareLine: string
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

export interface MissionArchiveEntry {
  routeId: string
  routeTitle: string
  rewardTitle: string
  completedAt: string
  difficultyLabel: string
  taskKind: TaskKind
  totalScore: number
  solvedCount: number
  puzzleCount: number
  usedHintCount: number
}

export interface MissionFilters {
  ageBand: AgeBand | "all"
  difficulty: DifficultyLevel | "all"
  taskKind: TaskKind | "all"
}
