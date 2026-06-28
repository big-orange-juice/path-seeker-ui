/**
 * Keep the shared renderer contract intentionally small.
 * The first phase only supports a fixed set of puzzle templates so both the
 * mini app runtime and any future admin preview can register renderers 1:1.
 */
export const FIXED_PUZZLE_TEMPLATE_TYPES = [
  'observe_choice',
  'clue_find',
  'sort',
  'match',
  'code_break'
] as const

export type PuzzleTemplateType = (typeof FIXED_PUZZLE_TEMPLATE_TYPES)[number]

export type HintLevel = 'observe' | 'relation' | 'direct'

export interface PuzzleDefinition {
  id: string
  templateType: PuzzleTemplateType
  title: string
  prompt?: string
  introText?: string
  questionPayload?: Record<string, unknown>
  answerPayload?: Record<string, unknown>
  hintPayload?: Partial<Record<HintLevel, string>>
}

export interface PuzzleRendererInput {
  puzzle: PuzzleDefinition
  readonlyMode?: boolean
  activeHintLevel?: HintLevel | null
}
