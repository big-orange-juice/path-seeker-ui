import { v4 as uuidv4 } from "uuid"
import { getAccessToken } from "@/services/authSession"
import { request } from "@/services/http"
import type {
  CreateExhibitChatSessionRequest,
  ExhibitChatLocationGallery,
  ExhibitChatLocationItem,
  ExhibitChatLocationMap,
  ExhibitChatLocationPoint,
  ExhibitChatLocationStatus,
  ExhibitChatMessage,
  ExhibitChatSession,
  ExhibitChatSource,
} from "@/types/exhibitChat"

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeNumber(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function mapExhibitChatSource(
  item: Partial<ExhibitChatSource> | null | undefined,
): ExhibitChatSource {
  return {
    exhibitId: normalizeText(item?.exhibitId) || null,
    name: normalizeText(item?.name) || null,
    formalName: normalizeText(item?.formalName) || null,
    imageUrl: normalizeText(item?.imageUrl) || null,
  }
}

function mapLocationPoint(
  item: Partial<ExhibitChatLocationPoint> | null | undefined,
): ExhibitChatLocationPoint {
  return {
    pointId: normalizeText(item?.pointId) || null,
    title: normalizeText(item?.title) || null,
    xPercent: normalizeNumber(item?.xPercent),
    yPercent: normalizeNumber(item?.yPercent),
  }
}

function mapLocationMap(
  item: (Partial<ExhibitChatLocationMap> & { points?: unknown }) | null | undefined,
): ExhibitChatLocationMap {
  const pointsRaw = Array.isArray(item?.points) ? item.points : []
  return {
    mapId: normalizeText(item?.mapId) || null,
    mapImageUrl: normalizeText(item?.mapImageUrl) || null,
    imageWidth: item?.imageWidth == null ? null : normalizeNumber(item.imageWidth, 0) || null,
    imageHeight: item?.imageHeight == null ? null : normalizeNumber(item.imageHeight, 0) || null,
    coordinateType: item?.coordinateType == null ? null : normalizeNumber(item.coordinateType, 0),
    contentHash: normalizeText(item?.contentHash) || null,
    points: pointsRaw.map((point) =>
      mapLocationPoint(point as Partial<ExhibitChatLocationPoint>),
    ),
  }
}

function mapLocationGallery(
  item: Partial<ExhibitChatLocationGallery> | null | undefined,
): ExhibitChatLocationGallery | null {
  if (!item || typeof item !== "object") {
    return null
  }
  return {
    galleryId: normalizeText(item.galleryId) || null,
    galleryName: normalizeText(item.galleryName) || null,
    floorId: normalizeText(item.floorId) || null,
    floorName: normalizeText(item.floorName) || null,
    floorLevel: item.floorLevel == null ? null : normalizeNumber(item.floorLevel, 0),
  }
}

/** 规范化 SSE / 历史中的位置快照项 */
export function mapExhibitChatLocationItem(
  item: (Partial<ExhibitChatLocationItem> & {
    gallery?: unknown
    maps?: unknown
  }) | null | undefined,
): ExhibitChatLocationItem | null {
  if (!item || typeof item !== "object") {
    return null
  }

  const mapsRaw = Array.isArray(item.maps) ? item.maps : []
  const status = (normalizeText(item.status) || "unbound") as ExhibitChatLocationStatus

  return {
    exhibitId: normalizeText(item.exhibitId) || null,
    exhibitName: normalizeText(item.exhibitName) || null,
    showcaseNo: normalizeText(item.showcaseNo) || null,
    status,
    gallery: mapLocationGallery(item.gallery as Partial<ExhibitChatLocationGallery> | null),
    maps: mapsRaw.map((map) =>
      mapLocationMap(map as Partial<ExhibitChatLocationMap> & { points?: unknown }),
    ),
  }
}

export function mapExhibitChatLocationItems(raw: unknown): ExhibitChatLocationItem[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item) =>
      mapExhibitChatLocationItem(
        item as Partial<ExhibitChatLocationItem> & { gallery?: unknown; maps?: unknown },
      ),
    )
    .filter((item): item is ExhibitChatLocationItem => Boolean(item))
}

function mapSession(item: Record<string, unknown> | null | undefined): ExhibitChatSession | null {
  if (!item) {
    return null
  }

  const id = normalizeText(item.id)
  if (!id) {
    return null
  }

  return {
    id,
    museumId: normalizeText(item.museumId) || null,
    title: normalizeText(item.title),
    messageCount: Number(item.messageCount ?? 0) || 0,
    lastActiveAt: normalizeText(item.lastActiveAt) || null,
    status: Number(item.status ?? 0) || 0,
  }
}

function mapMessage(item: Record<string, unknown> | null | undefined): ExhibitChatMessage | null {
  if (!item) {
    return null
  }

  const id = normalizeText(item.id) || uuidv4()
  const role = normalizeText(item.role).toLowerCase() || "assistant"
  const sourcesRaw = Array.isArray(item.sources) ? item.sources : []
  const locations = mapExhibitChatLocationItems(item.locations)

  return {
    id,
    runId: normalizeText(item.runId) || null,
    sequenceNo: item.sequenceNo == null ? null : String(item.sequenceNo),
    role,
    content: normalizeText(item.content),
    status: Number(item.status ?? 0) || 0,
    sources: sourcesRaw.map((source) =>
      mapExhibitChatSource(source as Partial<ExhibitChatSource>),
    ),
    locations,
    createdAt: normalizeText(item.createdAt) || null,
  }
}

/** POST /ExhibitChat/sessions */
export async function createExhibitChatSession(payload: CreateExhibitChatSessionRequest = {}) {
  const data = await request<unknown>("/ExhibitChat/sessions", {
    method: "POST",
    data: {
      title: payload.title?.slice(0, 256) || null,
    },
  })

  // 兼容 data 为会话对象或纯 id 字符串
  if (typeof data === "string" || typeof data === "number") {
    const id = normalizeText(data)
    if (!id) {
      throw new Error("创建对话失败，请稍后再试。")
    }
    return {
      id,
      museumId: null,
      title: normalizeText(payload.title),
      messageCount: 0,
      lastActiveAt: null,
      status: 1,
    } satisfies ExhibitChatSession
  }

  const session = mapSession(data as Record<string, unknown>)
  if (!session) {
    throw new Error("创建对话失败，请稍后再试。")
  }
  return session
}

/** GET /ExhibitChat/sessions */
export async function listExhibitChatSessions() {
  const data = await request<unknown[] | null>("/ExhibitChat/sessions", {
    method: "GET",
  })
  const list = Array.isArray(data) ? data : []
  return list
    .map((item) => mapSession(item as Record<string, unknown>))
    .filter((item): item is ExhibitChatSession => Boolean(item))
}

/** GET /ExhibitChat/history?sessionId= */
export async function fetchExhibitChatHistory(sessionId: string) {
  const data = await request<unknown[] | null>("/ExhibitChat/history", {
    method: "GET",
    query: { sessionId },
  })
  const list = Array.isArray(data) ? data : []
  return list
    .map((item) => mapMessage(item as Record<string, unknown>))
    .filter((item): item is ExhibitChatMessage => Boolean(item))
}

/** POST /ExhibitChat/archive */
export async function archiveExhibitChatSession(sessionId: string) {
  await request("/ExhibitChat/archive", {
    method: "POST",
    data: { id: sessionId },
  })
}

export function buildExhibitChatSendUrl() {
  return `${API_BASE_URL}/ExhibitChat/send`
}

/** POST /ExhibitChat/send-with-audio — 文字 + 可选 MiniMax 合成音频同一条 SSE */
export function buildExhibitChatSendWithAudioUrl() {
  return `${API_BASE_URL}/ExhibitChat/send-with-audio`
}

export function buildExhibitChatSendHeaders(lastEventId?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  }

  const token = getAccessToken()
  if (token) {
    headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`
  }

  if (lastEventId) {
    headers["Last-Event-ID"] = lastEventId
  }

  return headers
}
