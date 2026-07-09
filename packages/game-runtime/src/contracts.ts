import type { PuzzleAnswerDraft, PuzzleDefinition } from "@path-seeker/game-renderer"

export type RuntimeDifficultyLevel = "L1" | "L2" | "L3"

export interface RuntimePuzzleReward {
  clueId: string
  clueTitle: string
  fragmentId: string
  fragmentTitle: string
}

export type RuntimeMissionPuzzle = PuzzleDefinition & {
  difficultyLevel: RuntimeDifficultyLevel
  reward: RuntimePuzzleReward
  successCopy?: string
  failureCopy?: string
}

export interface RuntimeMissionChapter {
  id: string
  title: string
  resultNarrative?: string
  puzzle: RuntimeMissionPuzzle
}

export interface RuntimeMissionDetail {
  id: string
  chapterCount: number
  prologue: Array<unknown>
  chapters: RuntimeMissionChapter[]
}

export interface RuntimeChapterResultSnapshot<THintLevel extends string = string> {
  routeId: string
  chapterId: string
  chapterTitle: string
  narrative: string
  unlockedClue: RuntimePuzzleReward
  gainedScore: number
  usedHints: THintLevel[]
  perfectClear: boolean
  finalChapter: boolean
}

export interface RuntimeMissionSession<
  THintLevel extends string = string,
  TDraft extends PuzzleAnswerDraft | null = PuzzleAnswerDraft | null,
  TSnapshot extends RuntimeChapterResultSnapshot<THintLevel> | null = RuntimeChapterResultSnapshot<THintLevel> | null,
> {
  routeId: string
  currentChapterIndex: number
  solvedChapterIds: string[]
  unlockedClueIds: string[]
  unlockedRewardIds: string[]
  hintHistory: Record<string, THintLevel[]>
  draftHistory: Record<string, TDraft>
  totalScore: number
  status: "in_progress" | "completed"
  latestChapterResult: TSnapshot
}
