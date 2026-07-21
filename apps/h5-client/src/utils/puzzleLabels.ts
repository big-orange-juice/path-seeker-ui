import { getInteractionTypeMeta } from "@path-seeker/game-renderer"
import { getDifficultyLevelLabel } from "@path-seeker/ts-shared"
import type { DifficultyLevel, PuzzleTemplateType } from "@/types/mission"

/** 难度展示：统一 简单 / 中等 / 困难 */
export function getDifficultyLabel(level: DifficultyLevel | number | null | undefined) {
  return getDifficultyLevelLabel(level)
}

const templateLabels: Partial<Record<PuzzleTemplateType, string>> = {
  observe_choice: "观察选择",
  image_puzzle: "拼图重构",
}

const interactionActions: Partial<Record<number, string>> = {
  1: "阅读题面，选出答案",
  6: "将纹样碎片拼回原位",
  10: "把展品放进框里完成找一找",
  11: "收听本段文物解说",
}

const templateActions: Partial<Record<PuzzleTemplateType, string>> = {
  observe_choice: "看细节，选答案",
  image_puzzle: "把碎片拼回完整线索",
}

const templateGlyphs: Partial<Record<PuzzleTemplateType, string>> = {
  observe_choice: "看",
  image_puzzle: "拼",
}

export function getPuzzleTypeLabel(type: PuzzleTemplateType, interactionType?: number | null) {
  return getInteractionTypeMeta(interactionType)?.label ?? templateLabels[type] ?? "未支持节点"
}

export function getPuzzleTypeAction(type: PuzzleTemplateType, interactionType?: number | null) {
  return (interactionType ? interactionActions[interactionType] : undefined)
    ?? templateActions[type]
    ?? "返回路线选择可用节点"
}

export function getPuzzleTypeGlyph(type: PuzzleTemplateType, interactionType?: number | null) {
  return getInteractionTypeMeta(interactionType)?.label.slice(0, 1)
    ?? templateGlyphs[type]
    ?? "?"
}
