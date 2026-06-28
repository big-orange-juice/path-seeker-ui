import type { DurationSeconds, EntityId, IsoDateTimeString, ScoreValue } from "./core"
import type { RewardRarity } from "./enums"

/**
 * 勋章摘要模型。
 *
 * 这个类型给玩家结果页、奖励弹层、后台摘要列表共用。
 * 故意不放审核、发放记录之类后台强相关字段，避免共享层被管理逻辑污染。
 */
export interface BadgeSummary {
  id: EntityId
  code: string
  name: string
  description?: string | null
  iconUrl?: string | null
  iconGrayUrl?: string | null
  rarity: RewardRarity
}

/**
 * 收藏物 / 碎片 / 图鉴条目摘要。
 */
export interface CollectibleSummary {
  id: EntityId
  code: string
  name: string
  description?: string | null
  iconUrl?: string | null
  iconGrayUrl?: string | null
  rarity: RewardRarity
}

/**
 * 分享卡摘要。
 *
 * 这个结构会同时被：
 * - 终局页
 * - 结果页
 * - 分享预览组件
 * 使用，所以适合下沉为共享类型。
 */
export interface ShareCardSummary {
  nickname?: string | null
  routeTitle: string
  theme?: string | null
  rewardTitle?: string | null
  totalScore: ScoreValue
  solvedCount: number
  puzzleCount: number
  durationSec?: DurationSeconds | null
  noCluePerfect: boolean
  completedAt?: IsoDateTimeString | null
  shareCode?: string | null
}
