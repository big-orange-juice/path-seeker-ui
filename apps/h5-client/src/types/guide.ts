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
  voiceSampleUrl: string | null
  sortOrder: number
}
