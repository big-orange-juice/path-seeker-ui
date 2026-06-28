/**
 * Keep this package limited to product vocabulary that is stable and truly
 * shared across apps. App-local view models should stay inside each app.
 */
export type AgeGroup = "6-10" | "10-15" | "15+"

export const AGE_GROUPS: readonly AgeGroup[] = ["6-10", "10-15", "15+"]

export type PuzzleDifficulty = "L1" | "L2" | "L3"

export const PUZZLE_DIFFICULTIES: readonly PuzzleDifficulty[] = ["L1", "L2", "L3"]
