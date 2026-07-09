import type { MatchPair, PuzzleAnswerDraft, PuzzleDefinition, ReasoningAnswerValue } from "@path-seeker/game-renderer"

function normalizeCode(value: string) {
  return value.replace(/\s+/g, "").toUpperCase()
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isMatchPairArray(value: unknown): value is MatchPair[] {
  return (
    Array.isArray(value)
    && value.every((item) => typeof item === "object" && item !== null && "leftId" in item && "rightId" in item)
  )
}

function isReasoningAnswerValue(value: unknown): value is ReasoningAnswerValue {
  return (
    typeof value === "object"
    && value !== null
    && "evidenceOrder" in value
    && "conclusionId" in value
    && Array.isArray((value as ReasoningAnswerValue).evidenceOrder)
  )
}

export function comparePuzzleAnswer(puzzle: PuzzleDefinition, draft: PuzzleAnswerDraft | null) {
  if (!draft) {
    return false
  }

  if (puzzle.templateType === "observe_choice") {
    return draft.value === puzzle.questionPayload.correctOptionId
  }

  if (puzzle.templateType === "select") {
    if (!isStringArray(draft.value)) {
      return false
    }

    return draft.value.length >= puzzle.questionPayload.minPick
  }

  if (puzzle.templateType === "clue_find") {
    return draft.value === puzzle.questionPayload.correctHotspotId
  }

  if (puzzle.templateType === "sort") {
    if (!isStringArray(draft.value)) {
      return false
    }

    return JSON.stringify(draft.value) === JSON.stringify(puzzle.questionPayload.correctOrder)
  }

  if (puzzle.templateType === "match") {
    if (!isMatchPairArray(draft.value)) {
      return false
    }

    const expected = [...puzzle.questionPayload.correctPairs]
      .sort((left, right) => left.leftId.localeCompare(right.leftId))
      .map((pair) => `${pair.leftId}:${pair.rightId}`)
    const actual = [...draft.value]
      .sort((left, right) => left.leftId.localeCompare(right.leftId))
      .map((pair) => `${pair.leftId}:${pair.rightId}`)

    return JSON.stringify(actual) === JSON.stringify(expected)
  }

  if (puzzle.templateType === "image_puzzle") {
    if (!isStringArray(draft.value)) {
      return false
    }

    return JSON.stringify(draft.value) === JSON.stringify(puzzle.questionPayload.correctOrder)
  }

  if (puzzle.templateType === "story_branch") {
    return draft.value === puzzle.questionPayload.correctOptionId
  }

  if (puzzle.templateType === "multi_step_reasoning") {
    if (!isReasoningAnswerValue(draft.value)) {
      return false
    }

    return (
      JSON.stringify(draft.value.evidenceOrder) === JSON.stringify(puzzle.questionPayload.correctEvidenceOrder)
      && draft.value.conclusionId === puzzle.questionPayload.correctConclusionId
    )
  }

  if (typeof draft.value !== "string") {
    return false
  }

  return normalizeCode(draft.value) === normalizeCode(puzzle.questionPayload.acceptedCode)
}
