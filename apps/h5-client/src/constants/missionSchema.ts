import {
  AGE_BANDS,
  DIFFICULTY_LEVEL_OPTIONS,
  SCALE_TYPE_OPTIONS,
  type AgeBand,
  type DifficultyLevel,
  type ScaleTypeCode,
} from "@path-seeker/ts-shared"
import type { PuzzleTemplateType, SchemaMappedOption } from "@/types/mission"

export const AGE_BAND_OPTIONS: SchemaMappedOption<AgeBand>[] = [
  {
    value: "6-10",
    label: "6-10 岁",
    schemaValue: 2,
    description: "短句、直接、鼓励感强，适合亲子线和基础教育线。",
  },
  {
    value: "10-15",
    label: "10-15 岁",
    schemaValue: 3,
    description: "允许轻推理和悬念表达，适合校园线与剧情线。",
  },
  {
    value: "15+",
    label: "15+",
    schemaValue: 4,
    description: "可承载更高知识密度和多线索推理。",
  },
]

/** 难度：与后端 difficultyLevel 1-3 对齐，文案 简单/中等/困难 */
export const DIFFICULTY_OPTIONS: SchemaMappedOption<DifficultyLevel>[] =
  DIFFICULTY_LEVEL_OPTIONS.map((item) => ({
    value: item.key,
    label: item.label,
    schemaValue: item.value,
    description: item.label,
  }))

/** 规模：与后端 scaleType 1-3 对齐，文案 小型/中型/大型 */
export const SCALE_TYPE_FILTER_OPTIONS: SchemaMappedOption<`${ScaleTypeCode}`>[] =
  SCALE_TYPE_OPTIONS.map((item) => ({
    value: String(item.value) as `${ScaleTypeCode}`,
    label: item.label,
    schemaValue: item.value,
    description: item.label,
  }))

/** @deprecated 规模请用 SCALE_TYPE_FILTER_OPTIONS；保留避免旧引用报错 */
export const TASK_KIND_OPTIONS = SCALE_TYPE_FILTER_OPTIONS

export const PUZZLE_TEMPLATE_OPTIONS: Array<SchemaMappedOption<PuzzleTemplateType>> = [
  {
    value: "observe_choice",
    label: "观察选择",
    schemaValue: 1,
    description: "首屏与基础章节的高频题型。",
  },
  {
    value: "image_puzzle",
    label: "图像拼图",
    schemaValue: 6,
    description: "把线索碎片重新拼回完整结构。",
  },
]

export const AGE_BAND_MAP = Object.fromEntries(
  AGE_BAND_OPTIONS.map((item) => [item.value, item.schemaValue]),
) as Record<AgeBand, number>

export const DIFFICULTY_MAP = Object.fromEntries(
  DIFFICULTY_OPTIONS.map((item) => [item.value, item.schemaValue]),
) as Record<DifficultyLevel, number>

export const SCALE_TYPE_MAP = Object.fromEntries(
  SCALE_TYPE_OPTIONS.map((item) => [item.value, item.value]),
) as Record<ScaleTypeCode, ScaleTypeCode>

/** @deprecated 请用 SCALE_TYPE_MAP */
export const TASK_KIND_MAP = {
  family_adventure: 1,
  story_detective: 2,
  deep_reasoning: 3,
} as const

export const PUZZLE_TYPE_MAP = Object.fromEntries(
  PUZZLE_TEMPLATE_OPTIONS.map((item) => [item.value, item.schemaValue]),
) as Record<PuzzleTemplateType, number>

export { AGE_BANDS, DIFFICULTY_LEVEL_OPTIONS, SCALE_TYPE_OPTIONS }
