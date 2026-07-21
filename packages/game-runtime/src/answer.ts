import type { PuzzleAnswerDraft, PuzzleDefinition } from "@path-seeker/game-renderer"

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

export function comparePuzzleAnswer(puzzle: PuzzleDefinition, draft: PuzzleAnswerDraft | null) {
  if (!draft) {
    return false
  }

  if (puzzle.templateType === "observe_choice") {
    return draft.value === puzzle.questionPayload.correctOptionId
  }

  if (puzzle.templateType === "image_puzzle") {
    return isStringArray(draft.value)
      && JSON.stringify(draft.value) === JSON.stringify(puzzle.questionPayload.correctOrder)
  }

  return false
}