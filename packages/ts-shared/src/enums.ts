/**
 * 跨应用稳定共享的产品 / 后端对齐枚举。
 *
 * 约定：
 * - difficultyLevel / scaleType 等与后端 int 字段对齐，以 number code 为唯一真相
 * - 展示文案统一用 label，双端不得各写一套
 * - L1/L2/L3 仅作历史产品键兼容，新代码优先用 code
 */

/**
 * 年龄档（产品展示值）。
 */
export type AgeBand = "6-10" | "10-15" | "15+"

export const AGE_BANDS: readonly AgeBand[] = ["6-10", "10-15", "15+"]

// ---------------------------------------------------------------------------
// 难度 difficultyLevel：1=简单 2=中等 3=困难
// ---------------------------------------------------------------------------

export type DifficultyLevelCode = 1 | 2 | 3

/** 历史产品键，映射到 difficultyLevel code */
export type DifficultyLevel = "L1" | "L2" | "L3"

export const DIFFICULTY_LEVEL = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
} as const

export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ["L1", "L2", "L3"]

export const DIFFICULTY_LEVEL_CODES: readonly DifficultyLevelCode[] = [1, 2, 3]

export interface DifficultyLevelOption {
  value: DifficultyLevelCode
  key: DifficultyLevel
  label: string
}

/** 双端下拉 / 筛选用 */
export const DIFFICULTY_LEVEL_OPTIONS: readonly DifficultyLevelOption[] = [
  { value: 1, key: "L1", label: "简单" },
  { value: 2, key: "L2", label: "中等" },
  { value: 3, key: "L3", label: "困难" },
] as const

const DIFFICULTY_CODE_TO_KEY: Record<DifficultyLevelCode, DifficultyLevel> = {
  1: "L1",
  2: "L2",
  3: "L3",
}

const DIFFICULTY_KEY_TO_CODE: Record<DifficultyLevel, DifficultyLevelCode> = {
  L1: 1,
  L2: 2,
  L3: 3,
}

const DIFFICULTY_LABEL_BY_CODE: Record<DifficultyLevelCode, string> = {
  1: "简单",
  2: "中等",
  3: "困难",
}

export function isDifficultyLevelCode(value: unknown): value is DifficultyLevelCode {
  return value === 1 || value === 2 || value === 3
}

export function isDifficultyLevelKey(value: unknown): value is DifficultyLevel {
  return value === "L1" || value === "L2" || value === "L3"
}

/** 任意输入 → 合法 code，非法回落默认中等 */
export function toDifficultyLevelCode(
  value?: number | string | null,
  fallback: DifficultyLevelCode = 2,
): DifficultyLevelCode {
  if (isDifficultyLevelKey(value)) {
    return DIFFICULTY_KEY_TO_CODE[value]
  }

  const num = typeof value === "number" ? value : Number(value)
  if (isDifficultyLevelCode(num)) {
    return num
  }

  return fallback
}

export function difficultyLevelCodeToKey(code?: number | null): DifficultyLevel {
  return DIFFICULTY_CODE_TO_KEY[toDifficultyLevelCode(code)]
}

export function difficultyLevelKeyToCode(key: DifficultyLevel): DifficultyLevelCode {
  return DIFFICULTY_KEY_TO_CODE[key]
}

/** 展示文案：支持 code 或 L1/L2/L3 */
export function getDifficultyLevelLabel(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") {
    return "未设置"
  }

  if (isDifficultyLevelKey(value)) {
    return DIFFICULTY_LABEL_BY_CODE[DIFFICULTY_KEY_TO_CODE[value]]
  }

  const code = toDifficultyLevelCode(value)
  return DIFFICULTY_LABEL_BY_CODE[code] ?? "未设置"
}

// ---------------------------------------------------------------------------
// 规模 scaleType：1=小型 2=中型 3=大型
// ---------------------------------------------------------------------------

export type ScaleTypeCode = 1 | 2 | 3

export const SCALE_TYPE = {
  Small: 1,
  Medium: 2,
  Large: 3,
} as const

export const SCALE_TYPE_CODES: readonly ScaleTypeCode[] = [1, 2, 3]

export interface ScaleTypeOption {
  value: ScaleTypeCode
  label: string
}

export const SCALE_TYPE_OPTIONS: readonly ScaleTypeOption[] = [
  { value: 1, label: "小型" },
  { value: 2, label: "中型" },
  { value: 3, label: "大型" },
] as const

const SCALE_LABEL_BY_CODE: Record<ScaleTypeCode, string> = {
  1: "小型",
  2: "中型",
  3: "大型",
}

export function isScaleTypeCode(value: unknown): value is ScaleTypeCode {
  return value === 1 || value === 2 || value === 3
}

export function toScaleTypeCode(
  value?: number | string | null,
  fallback: ScaleTypeCode = 2,
): ScaleTypeCode {
  const num = typeof value === "number" ? value : Number(value)
  if (isScaleTypeCode(num)) {
    return num
  }

  return fallback
}

export function getScaleTypeLabel(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") {
    return "未设置"
  }

  const code = toScaleTypeCode(value)
  return SCALE_LABEL_BY_CODE[code] ?? "未设置"
}

// ---------------------------------------------------------------------------
// 其它既有枚举
// ---------------------------------------------------------------------------

/**
 * 提示层级。
 */
export type HintLevel = "observe" | "relation" | "direct"

export const HINT_LEVELS: readonly HintLevel[] = ["observe", "relation", "direct"]

/**
 * 游玩会话状态。
 */
export type PlaySessionStatus = "not_started" | "in_progress" | "completed"

/**
 * 发布状态。
 */
export type PublishStatus = "draft" | "reviewing" | "published" | "archived"

/**
 * 奖励稀有度。
 */
export type RewardRarity = "common" | "rare" | "epic" | "legendary"
