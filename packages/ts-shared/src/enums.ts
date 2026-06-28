/**
 * 这个文件放跨应用稳定共享的产品词汇。
 *
 * 要特别注意边界：
 * - 这里放的是前端选定的领域枚举
 * - 不是后端 swagger 整数枚举的原样拷贝
 * - 每个应用都应该在 API adapter 里把后端数值映射成这里的字面量
 */

/**
 * 年龄档。
 *
 * 这里直接使用产品文档里的展示值，原因是它们会同时出现在：
 * - 后台筛选项
 * - 小程序任务筛选
 * - mock 数据
 * - 埋点标签
 */
export type AgeBand = "6-10" | "10-15" | "15+"

/**
 * 固定顺序的年龄档列表。
 *
 * 用于筛选栏、下拉框和需要稳定排序的展示场景。
 */
export const AGE_BANDS: readonly AgeBand[] = ["6-10", "10-15", "15+"]

/**
 * 难度档。
 *
 * 对齐当前简化后的产品策略：
 * - L1：快速上手，重观察
 * - L2：需要关联多个线索，但不明显劝退
 * - L3：作为高峰挑战使用
 */
export type DifficultyLevel = "L1" | "L2" | "L3"

/**
 * 固定顺序的难度列表。
 */
export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ["L1", "L2", "L3"]

/**
 * 提示层级。
 *
 * 命名直接按玩家体验来定义，而不是按算法步骤来定义。这样在渲染器、
 * 埋点和后台配置里都能保持一致的可读性。
 */
export type HintLevel = "observe" | "relation" | "direct"

/**
 * 固定顺序的提示层级列表。
 */
export const HINT_LEVELS: readonly HintLevel[] = ["observe", "relation", "direct"]

/**
 * 游玩会话状态。
 *
 * 后端当前暴露的是数值状态，这里统一映射成前端可读字面量，避免
 * store 和组件里到处判断魔法数字。
 */
export type PlaySessionStatus = "not_started" | "in_progress" | "completed"

/**
 * 发布状态。
 *
 * 主要给后台列表和流程状态展示使用。
 */
export type PublishStatus = "draft" | "reviewing" | "published" | "archived"

/**
 * 奖励稀有度。
 *
 * 这个概念会同时出现在奖励页和后台配置页，足够稳定，适合下沉到共享层。
 */
export type RewardRarity = "common" | "rare" | "epic" | "legendary"
