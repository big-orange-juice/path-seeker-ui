import type { DurationSeconds, EntityId, IsoDateTimeString, ScoreValue } from "./core"
import type { AgeBand, DifficultyLevel, HintLevel, PlaySessionStatus } from "./enums"
import type { BadgeSummary, CollectibleSummary, ShareCardSummary } from "./reward"

/**
 * 进行中路线的进度摘要。
 *
 * 这个结构故意比后端传输模型更窄，只保留小程序恢复导航、展示进度、
 * 驱动章节推进真正需要的字段。
 */
export interface ProgressSummary {
  routeId?: EntityId | null
  teamId?: EntityId | null
  status: PlaySessionStatus
  currentPuzzleId?: EntityId | null
  solvedCount: number
  puzzleCount: number
  totalScore: ScoreValue
  usedClueCount: number
  startedAt: IsoDateTimeString
  completedAt?: IsoDateTimeString | null
  durationSec?: DurationSeconds | null
}

/**
 * 小程序运行时线索状态。
 *
 * 这不是后台完整线索模型。游玩态只关心：
 * - 顺序
 * - 内容
 * - 是否解锁
 * - 使用提示时的惩罚或层级信息
 */
export interface RuntimeClue {
  id: EntityId
  clueNo: number
  content?: string | null
  mediaUrl?: string | null
  penaltyScore: ScoreValue
  hintLevel: HintLevel
  unlocked: boolean
}

/**
 * 小程序运行时谜题摘要。
 *
 * 真正的题型 payload 不放在这个文件里，而是放在 `@path-seeker/game-renderer`。
 * 这里保留的是应用外壳需要的稳定元信息。
 */
export interface PuzzleRuntimeSummary {
  id: EntityId
  title: string
  content?: string | null
  difficultyLevel: DifficultyLevel
  baseScore: ScoreValue
  timeLimitSec?: DurationSeconds | null
  maxAttempts?: number | null
  attemptsUsed: number
  solved: boolean
  mediaUrl?: string | null
  clues: RuntimeClue[]
}

/**
 * 从渲染器层交给应用服务层的提交答案 payload。
 *
 * 当前后端提交接口仍以字符串 answer 为主，因此共享层先维持这个形状。
 * 如果某个题型内部答案结构更复杂，应该在应用 adapter 里先编码，再发给后端。
 */
export interface SubmitAnswerPayload {
  routeId: EntityId
  puzzleId: EntityId
  answer: string
  durationSec?: DurationSeconds | null
}

/**
 * 单次作答之后的结果。
 */
export interface SubmitAnswerResult {
  isCorrect: boolean
  attemptNo: number
  scoreGained: ScoreValue
  totalScore: ScoreValue
  solvedCount: number
  puzzleCount: number
  routeCompleted: boolean
  message?: string | null
  newBadges: BadgeSummary[]
  newCollectibles: CollectibleSummary[]
}

/**
 * 前端自有的会话快照。
 *
 * 这个结构主要用于本地缓存、恢复游玩和 store 持久化，因此它不会直接照搬
 * 后端会话 DTO，而是围绕前端恢复需求组织。
 */
export interface GameSessionSnapshot {
  sessionId: EntityId
  routeId: EntityId
  ageBand: AgeBand
  currentChapterId: EntityId
  completedPuzzleIds: EntityId[]
  unlockedClueIds: EntityId[]
  rewardIds: EntityId[]
  lastPuzzleState?: {
    puzzleId: EntityId
    usedHints: HintLevel[]
    answerDraft?: unknown
  }
}

/**
 * 终局结果详情。
 *
 * 相比 `RouteResultSummary`，这里额外带上奖励和分享卡内容，适合结果页和
 * 分享页直接消费。
 */
export interface RouteResultDetail {
  routeId: EntityId
  routeTitle: string
  theme?: string | null
  rewardTitle?: string | null
  status: PlaySessionStatus
  completed: boolean
  totalScore: ScoreValue
  solvedCount: number
  puzzleCount: number
  usedClueCount: number
  noCluePerfect: boolean
  durationSec?: DurationSeconds | null
  startedAt: IsoDateTimeString
  completedAt?: IsoDateTimeString | null
  badges: BadgeSummary[]
  shareCard?: ShareCardSummary | null
}
