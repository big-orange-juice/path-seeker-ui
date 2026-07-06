import type {
  AgeBand,
  DifficultyLevel,
  PuzzleTemplateType,
  SchemaMappedOption,
  TaskKind,
} from "@/types/mission"

export const AGE_BAND_OPTIONS: SchemaMappedOption<AgeBand>[] = [
  {
    value: "6-10",
    label: "6-10 岁",
    schemaValue: 1,
    description: "短句、直接、鼓励感强，适合亲子线和基础教育线。",
  },
  {
    value: "10-15",
    label: "10-15 岁",
    schemaValue: 2,
    description: "允许轻推理和悬念表达，适合校园线与剧情线。",
  },
  {
    value: "15+",
    label: "15+",
    schemaValue: 3,
    description: "可承载更高知识密度和多线索推理。",
  },
]

export const DIFFICULTY_OPTIONS: SchemaMappedOption<DifficultyLevel>[] = [
  {
    value: "L1",
    label: "L1 观察型",
    schemaValue: 1,
    description: "1 个明显线索，1 步完成，默认就给观察提示。",
  },
  {
    value: "L2",
    label: "L2 关联型",
    schemaValue: 2,
    description: "2-3 条线索关联，保留完整三级提示。",
  },
  {
    value: "L3",
    label: "L3 推理型",
    schemaValue: 3,
    description: "多线索交叉验证，作为终局高峰挑战使用。",
  },
]

export const TASK_KIND_OPTIONS: SchemaMappedOption<TaskKind>[] = [
  {
    value: "family_adventure",
    label: "亲子冒险",
    schemaValue: 1,
    description: "轻量目标明确，强调陪伴观察和即时反馈。",
  },
  {
    value: "story_detective",
    label: "剧情推理",
    schemaValue: 2,
    description: "沿着人物、证据和剧情反转推进。",
  },
  {
    value: "deep_reasoning",
    label: "深度推理",
    schemaValue: 3,
    description: "知识密度更高，适合成人和高阶挑战。",
  },
]

export const PUZZLE_TEMPLATE_OPTIONS: Array<SchemaMappedOption<PuzzleTemplateType>> = [
  {
    value: "observe_choice",
    label: "观察选择",
    schemaValue: 1,
    description: "首屏与基础章节的高频题型。",
  },
  {
    value: "select",
    label: "颜色寻宝",
    schemaValue: 9,
    description: "按题面条件从候选展品中选择一个或多个目标。",
  },
  {
    value: "clue_find",
    label: "细节找线索",
    schemaValue: 2,
    description: "先观察细节，再命中真正线索。",
  },
  {
    value: "sort",
    label: "排序",
    schemaValue: 3,
    description: "适合工艺、时间和剧情顺序。",
  },
  {
    value: "match",
    label: "配对",
    schemaValue: 4,
    description: "用于作者、用途、纹样和时代关系。",
  },
  {
    value: "image_puzzle",
    label: "图像拼图",
    schemaValue: 5,
    description: "把线索碎片重新拼回完整结构。",
  },
  {
    value: "story_branch",
    label: "剧情判断",
    schemaValue: 6,
    description: "在剧情分歧里判断哪一步更接近真相。",
  },
  {
    value: "multi_step_reasoning",
    label: "多步推理",
    schemaValue: 7,
    description: "先串证据，再给出最终结论。",
  },
  {
    value: "code_break",
    label: "密码解锁",
    schemaValue: 8,
    description: "章节收束与终局高峰题。",
  },
]

export const AGE_BAND_MAP = Object.fromEntries(
  AGE_BAND_OPTIONS.map((item) => [item.value, item.schemaValue]),
) as Record<AgeBand, number>

export const DIFFICULTY_MAP = Object.fromEntries(
  DIFFICULTY_OPTIONS.map((item) => [item.value, item.schemaValue]),
) as Record<DifficultyLevel, number>

export const TASK_KIND_MAP = Object.fromEntries(
  TASK_KIND_OPTIONS.map((item) => [item.value, item.schemaValue]),
) as Record<TaskKind, number>

export const PUZZLE_TYPE_MAP = Object.fromEntries(
  PUZZLE_TEMPLATE_OPTIONS.map((item) => [item.value, item.schemaValue]),
) as Record<PuzzleTemplateType, number>
