import { request } from "@/services/http"
import type { GuideClientItem, GuideTag } from "@/types/guide"

/** schema GuideResponse（client-list 条目） */
interface GuideResponseRaw {
  id?: string | null
  name?: string | null
  avatarUrl?: string | null
  description?: string | null
  tags?: Array<{
    id?: string | null
    name?: string | null
    color?: string | null
    sortOrder?: number
  }> | null
  voiceStyle?: string | null
  /** MiniMax 等 TTS 平台音色 ID */
  providerVoiceId?: string | null
  voiceSampleUrl?: string | null
  sortOrder?: number | null
  status?: number | null
  /** 已发布可探索路线数 */
  routeCount?: number | null
}

function mapTag(raw: NonNullable<GuideResponseRaw["tags"]>[number]): GuideTag | null {
  const name = String(raw?.name ?? "").trim()
  if (!name) return null
  return {
    id: String(raw?.id ?? name).trim() || name,
    name,
    color: String(raw?.color ?? "").trim() || undefined,
  }
}

function mapGuide(raw: GuideResponseRaw): GuideClientItem | null {
  const id = String(raw?.id ?? "").trim()
  if (!id) return null
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map(mapTag).filter((item): item is GuideTag => Boolean(item))
    : []
  const routeCountRaw = Number(raw.routeCount)
  return {
    id,
    name: String(raw.name ?? "").trim() || "未命名导游",
    avatarUrl: String(raw.avatarUrl ?? "").trim() || null,
    description: String(raw.description ?? "").trim() || null,
    tags,
    voiceStyle: String(raw.voiceStyle ?? "").trim() || null,
    providerVoiceId: String(raw.providerVoiceId ?? "").trim() || null,
    voiceSampleUrl: String(raw.voiceSampleUrl ?? "").trim() || null,
    sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : 0,
    routeCount: Number.isFinite(routeCountRaw) && routeCountRaw > 0
      ? Math.floor(routeCountRaw)
      : 0,
  }
}

/**
 * GET /Guide/client-list — C 端导游列表。
 * 基址已含 /api，path 勿再写 /api。
 */
export async function fetchGuideClientList(): Promise<GuideClientItem[]> {
  const data = await request<GuideResponseRaw[] | null>("/Guide/client-list", {
    method: "GET",
  })
  const list = Array.isArray(data) ? data : []
  return list
    .map(mapGuide)
    .filter((item): item is GuideClientItem => Boolean(item))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh"))
}
