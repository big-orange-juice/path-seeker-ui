export type AgeBand = "6-10" | "10-15" | "15+"

export type DifficultyLevel = "L1" | "L2" | "L3"

export type HintLevel = "observe" | "relation" | "direct"

export type PuzzleTemplateType = "observe_choice" | "clue_find" | "sort" | "match" | "code_break"

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
  intro: string
  avatar: string
  voiceStyle: string
}

export interface MissionSchemaMeta {
  ageGroup: number
  difficultyLevel: number
  scaleType: number
}

export interface MissionRouteCard {
  id: string
  routeCode: string
  title: string
  theme: string
  summary: string
  highlight: string
  recommendedAgeBand: AgeBand
  availableAgeBands: AgeBand[]
  difficultyLevel: DifficultyLevel
  taskKind: TaskKind
  estimatedMinutes: number
  puzzleCount: number
  chapterCount: number
  allowTeam: boolean
  rewardTitle: string
  startLocation: string
  badgeLabel: string
  persona: MissionPersona
  taglines: string[]
  schemaMeta: MissionSchemaMeta
}

export interface StoryBeat {
  eyebrow: string
  title: string
  content: string
}

export interface ArtifactClue {
  id: string
  title: string
  subtitle: string
  location: string
  observationPoint: string
  storyFragment: string
  suspiciousPoint: string
  checklist: string[]
  detailCallout: string
}

export interface ChoiceOption {
  id: string
  label: string
  description?: string
}

export interface HotspotArea {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
}

export interface ObserveChoicePayload {
  prompt: string
  options: ChoiceOption[]
  correctOptionId: string
}

export interface ClueFindPayload {
  prompt: string
  targetDescription: string
  hotspots: HotspotArea[]
  correctHotspotId: string
}

export interface SortPayload {
  prompt: string
  items: Array<{ id: string; label: string }>
  correctOrder: string[]
}

export interface MatchPair {
  leftId: string
  rightId: string
}

export interface MatchPayload {
  prompt: string
  left: Array<{ id: string; label: string }>
  right: Array<{ id: string; label: string }>
  correctPairs: MatchPair[]
}

export interface CodeBreakPayload {
  prompt: string
  codeLength: number
  acceptedCode: string
  clueFragments: string[]
  maskCharacter?: string
}

export interface PuzzlePayloadMap {
  observe_choice: ObserveChoicePayload
  clue_find: ClueFindPayload
  sort: SortPayload
  match: MatchPayload
  code_break: CodeBreakPayload
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
  | BaseMissionPuzzle<"clue_find">
  | BaseMissionPuzzle<"sort">
  | BaseMissionPuzzle<"match">
  | BaseMissionPuzzle<"code_break">

export interface MissionChapter {
  id: string
  stageNo: number
  title: string
  objective: string
  targetLocation: string
  resultNarrative: string
  nextTarget: string
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
  introPanel: {
    narrative: string
    playbook: string[]
    rewardPreview: string[]
  }
  chapters: MissionChapter[]
  finale: MissionFinale
}

export interface MissionAnswerDraft {
  templateType: PuzzleTemplateType
  value: string | string[] | MatchPair[] | null
}

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

export interface MissionSession {
  sessionId: string
  routeId: string
  selectedAgeBand: AgeBand
  currentChapterIndex: number
  solvedChapterIds: string[]
  unlockedClueIds: string[]
  unlockedRewardIds: string[]
  hintHistory: Record<string, HintLevel[]>
  draftHistory: Record<string, MissionAnswerDraft | null>
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
  selectedAgeBand: AgeBand
  taskKind: TaskKind
  totalScore: number
  solvedCount: number
  puzzleCount: number
  usedHintCount: number
}
