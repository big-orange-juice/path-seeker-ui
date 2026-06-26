export type PuzzleTemplateType =
  | "single_choice"
  | "hotspot"
  | "sort"
  | "match"
  | "password"
  | "story_branch"

export interface PuzzleDefinition {
  id: string
  templateType: PuzzleTemplateType
  title: string
}

