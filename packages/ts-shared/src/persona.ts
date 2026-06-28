import type { EntityId } from "./core"

/**
 * 路线人格 / 角色引导者。
 *
 * 这个模型来自 swagger 里的 `PersonaResponse`，但这里只保留前端多处
 * 真正会共用的字段，用于：
 * - 路线卡片
 * - 开场剧情
 * - 章节过场
 * - 后台内容预览
 */
export interface PersonaProfile {
  /**
   * 归一化后的前端实体 id。
   */
  id: EntityId

  /**
   * 业务侧使用的角色编码。
   *
   * 常用于后台筛选、内容引用和 mock 数据标识。
   */
  code: string

  /**
   * 展示名称。
   */
  name: string

  /**
   * 角色头像。
   *
   * 主要出现在路线卡、开场页和章节过场里。
   */
  avatarUrl?: string | null

  /**
   * 角色简介。
   */
  intro?: string | null

  /**
   * 可选的语音风格描述。
   *
   * 这里先保留成轻量字段，不把 TTS 或音频实现细节放进共享层。
   */
  voiceStyle?: string | null

  /**
   * 角色是否可用。
   */
  isActive: boolean
}
