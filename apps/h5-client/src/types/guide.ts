/** C 端导游 — 对齐 schema GuideResponse / TagResponse */

export interface GuideTag {
  id: string
  name: string
  color?: string
}

export interface GuideClientItem {
  id: string
  name: string
  avatarUrl: string | null
  description: string | null
  tags: GuideTag[]
  voiceStyle: string | null
  /** MiniMax 等 TTS 平台音色 ID（GuideResponse.providerVoiceId） */
  providerVoiceId: string | null
  voiceSampleUrl: string | null
  sortOrder: number
  /** 该导游已发布、可探索的路线数（client-list 已返回） */
  routeCount: number
}
