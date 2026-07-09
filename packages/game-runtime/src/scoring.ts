import type { RuntimeDifficultyLevel } from "./contracts"

export function scorePuzzle(difficultyLevel: RuntimeDifficultyLevel, hintCount: number, skipped = false) {
  if (skipped) {
    return 0
  }

  const base = difficultyLevel === "L1" ? 12 : difficultyLevel === "L2" ? 18 : 24
  return Math.max(base - hintCount * 3, 6)
}
