import type { DifficultyLevel, PuzzleTemplateType } from "@/types/mission"

export function getDifficultyLabel(level: DifficultyLevel) {
  const labels: Record<DifficultyLevel, string> = {
    L1: "轻松",
    L2: "进阶",
    L3: "挑战",
  }

  return labels[level]
}

export function getPuzzleTypeLabel(type: PuzzleTemplateType) {
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

export function getPuzzleTypeAction(type: PuzzleTemplateType) {
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

export function getPuzzleTypeGlyph(type: PuzzleTemplateType) {
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
