import type { DurationSeconds, EntityId, ScoreValue } from "./core"
import type { AgeBand, DifficultyLevel, ScaleTypeCode } from "./enums"
import type { PersonaProfile } from "./persona"

/**
 * 路线卡片模型。
 *
 * 来源参考 `RouteCardResponse`，但这里已经做了前端归一化：
 * - 年龄档、难度档不再保留后端整数
 * - 团队开关用 boolean
 * - 只保留前后端都稳定的展示字段
 */
export interface RouteCard {
  id: EntityId
  title: string
  theme?: string | null
  coverImageUrl?: string | null
  ageBand: AgeBand
  /** 产品键 L1/L2/L3，对应后端 difficultyLevel 1/2/3 */
  difficultyLevel: DifficultyLevel
  /** 后端 scaleType：1 小型 / 2 中型 / 3 大型 */
  scaleType?: ScaleTypeCode
  allowTeam: boolean
  estimatedMinutes?: number | null
  totalScore: ScoreValue
  puzzleCount: number
  persona?: PersonaProfile | null
}

/**
 * 路线中的剧情章节块。
 *
 * 既可以驱动小程序开场 / 过场，也可以给后台预览面板使用。
 */
export interface StoryChapter {
  id: EntityId
  routeId: EntityId
  chapterNo: number
  title: string
  content?: string | null
  imageUrl?: string | null
  audioUrl?: string | null
  sortOrder: number
}

/**
 * 路线节点模型。
 *
 * 主要服务于：
 * - 小程序章节地图
 * - 路线详情页
 * - 后台路线编排预览
 */
export interface RouteNode {
  routePuzzleId: EntityId
  puzzleId: EntityId
  title: string
  stageNo: number
  sortOrder: number
  score: ScoreValue
  difficultyLevel: DifficultyLevel
  exhibitName?: string | null
  galleryName?: string | null
  isRequired: boolean
}

/**
 * 路线详情模型。
 *
 * 任务详情页在真正开始前主要消费这类结构。
 */
export interface RouteDetail {
  route: RouteCard
  museumId?: EntityId | null
  intro?: string | null
  stories: StoryChapter[]
  nodes: RouteNode[]
}

/**
 * 路线结果摘要。
 *
 * 它和进行中的会话状态分开建模，因为结果页常常会被单独缓存、回看、
 * 分享，而不再依赖当前会话对象。
 */
export interface RouteResultSummary {
  routeId: EntityId
  routeTitle: string
  theme?: string | null
  rewardTitle?: string | null
  completed: boolean
  totalScore: ScoreValue
  solvedCount: number
  puzzleCount: number
  usedClueCount: number
  noCluePerfect: boolean
  durationSec?: DurationSeconds | null
}
