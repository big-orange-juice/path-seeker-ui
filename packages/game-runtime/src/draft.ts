import type { PuzzleAnswerDraft, PuzzleDefinition } from "@path-seeker/game-renderer"

export function createDeterministicShuffle(ids: string[], seed: string) {
  const next = [...ids]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const seedCode = seed.charCodeAt(index % seed.length) || index
    const swapIndex = (seedCode + index) % (index + 1)
    const current = next[index]
    next[index] = next[swapIndex]
    next[swapIndex] = current
  }

  return next
}

export function createPuzzleDraft(puzzle: PuzzleDefinition): PuzzleAnswerDraft {
  if (puzzle.templateType === "image_puzzle") {
    const ids = puzzle.questionPayload.pieces.map((item) => item.id)
    let shuffled = createDeterministicShuffle(ids, `${puzzle.id}:image`)
    if (ids.length > 1 && shuffled.every((id, index) => id === ids[index])) {
      shuffled = [...ids.slice(1), ids[0]!]
    }
    return { templateType: "image_puzzle", value: shuffled }
  }

  return { templateType: "observe_choice", value: "" }
}