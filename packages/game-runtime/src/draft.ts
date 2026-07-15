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
  if (puzzle.templateType === "sort") {
    return {
      templateType: "sort",
      value: createDeterministicShuffle(puzzle.questionPayload.items.map((item) => item.id), puzzle.id),
    }
  }

  if (puzzle.templateType === "match") {
    return { templateType: "match", value: [] }
  }

  if (puzzle.templateType === "select") {
    return { templateType: "select", value: [] }
  }

  if (puzzle.templateType === "image_puzzle") {
    const ids = puzzle.questionPayload.pieces.map((item) => item.id)
    let shuffled = createDeterministicShuffle(ids, `${puzzle.id}:image`)
    // 避免确定性打乱后仍是正解（尤其 2 块或种子巧合时）
    if (ids.length > 1 && shuffled.every((id, index) => id === ids[index])) {
      shuffled = [...ids.slice(1), ids[0]!]
    }
    return {
      templateType: "image_puzzle",
      value: shuffled,
    }
  }

  if (puzzle.templateType === "multi_step_reasoning") {
    return {
      templateType: "multi_step_reasoning",
      value: {
        evidenceOrder: [],
        conclusionId: null,
      },
    }
  }

  return {
    templateType: puzzle.templateType,
    value: "",
  }
}
