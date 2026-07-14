import { getInteractionTypeMeta } from "@path-seeker/game-renderer"
import type { DifficultyLevel, PuzzleTemplateType } from "@/types/mission"

export function getDifficultyLabel(level: DifficultyLevel) {
  const labels: Record<DifficultyLevel, string> = {
    L1: "轻松",
    L2: "进阶",
    L3: "挑战",
  }

  return labels[level]
}

export function getPuzzleTypeLabel(type: PuzzleTemplateType, interactionType?: number | null) {
  const interactionMeta = getInteractionTypeMeta(interactionType)
  if (interactionMeta) {
    return interactionMeta.label
  }

  const labels: Record<PuzzleTemplateType, string> = {
    observe_choice: "观察选择",
    select: "颜色寻宝",
    clue_find: "找线索",
    sort: "排顺序",
    match: "配关系",
    image_puzzle: "拼图重构",
    story_branch: "剧情判断",
    multi_step_reasoning: "多步推理",
    code_break: "解密码",
  }

  return labels[type]
}

export function getPuzzleTypeAction(type: PuzzleTemplateType, interactionType?: number | null) {
  const interactionLabels: Record<number, string> = {
    1: "阅读题面，选出答案",
    2: "根据线索输入密符",
    3: "拖动卡片重构时序",
    4: "把左右档案配对",
    5: "选择符合条件的展品",
    6: "将纹样碎片拼回原位",
    7: "听声音，找对应图像",
    8: "找出图中的关键差异",
    9: "把剪影与原图配对",
    10: "把展品放进框里完成找一找",
    11: "收听本段文物解说",
  }

  if (interactionType && interactionLabels[interactionType]) {
    return interactionLabels[interactionType]
  }

  const labels: Record<PuzzleTemplateType, string> = {
    observe_choice: "看细节，选答案",
    select: "选择符合条件的展品",
    clue_find: "在图中点线索",
    sort: "用上下调整顺序",
    match: "先选左边，再配右边",
    image_puzzle: "把碎片拼回完整线索",
    story_branch: "判断哪条分支更接近真相",
    multi_step_reasoning: "先串证据，再下结论",
    code_break: "用碎片拼出密码",
  }

  return labels[type]
}

export function getPuzzleTypeGlyph(type: PuzzleTemplateType, interactionType?: number | null) {
  const interactionMeta = getInteractionTypeMeta(interactionType)
  if (interactionMeta) {
    return interactionMeta.label.slice(0, 1)
  }

  const labels: Record<PuzzleTemplateType, string> = {
    observe_choice: "看",
    select: "选",
    clue_find: "找",
    sort: "排",
    match: "配",
    image_puzzle: "拼",
    story_branch: "判",
    multi_step_reasoning: "推",
    code_break: "锁",
  }

  return labels[type]
}
