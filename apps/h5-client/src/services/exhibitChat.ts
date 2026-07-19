import { getAccessToken } from "@/services/authSession"
import { request } from "@/services/http"
import type {
  CreateExhibitChatSessionRequest,
  ExhibitChatMessage,
  ExhibitChatSession,
  ExhibitChatSource,
} from "@/types/exhibitChat"

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function mapSource(item: Partial<ExhibitChatSource> | null | undefined): ExhibitChatSource {
  return {
    exhibitId: normalizeText(item?.exhibitId) || null,
    name: normalizeText(item?.name) || null,
    formalName: normalizeText(item?.formalName) || null,
    imageUrl: normalizeText(item?.imageUrl) || null,
  }
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

  const id = normalizeText(item.id) || crypto.randomUUID()
  const role = normalizeText(item.role).toLowerCase() || "assistant"
  const sourcesRaw = Array.isArray(item.sources) ? item.sources : []

  return {
    id,
    runId: normalizeText(item.runId) || null,
    sequenceNo: item.sequenceNo == null ? null : String(item.sequenceNo),
    role,
    content: normalizeText(item.content),
    status: Number(item.status ?? 0) || 0,
    sources: sourcesRaw.map((source) => mapSource(source as Partial<ExhibitChatSource>)),
    createdAt: normalizeText(item.createdAt) || null,
  }
}

/** POST /api/ExhibitChat/sessions */
export async function createExhibitChatSession(payload: CreateExhibitChatSessionRequest = {}) {
  const data = await request<unknown>("/api/ExhibitChat/sessions", {
    method: "POST",
    data: {
      title: payload.title?.slice(0, 256) || null,
    },
  })

  // 兼容 data 为会话对象或纯 id 字符串
  if (typeof data === "string" || typeof data === "number") {
    const id = normalizeText(data)
    if (!id) {
      throw new Error("创建会话失败，未返回会话 ID。")
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
    throw new Error("创建会话失败，未返回会话 ID。")
  }
  return session
}

/** GET /api/ExhibitChat/sessions */
export async function listExhibitChatSessions() {
  const data = await request<unknown[] | null>("/api/ExhibitChat/sessions", {
    method: "GET",
  })
  const list = Array.isArray(data) ? data : []
  return list
    .map((item) => mapSession(item as Record<string, unknown>))
    .filter((item): item is ExhibitChatSession => Boolean(item))
}

/** GET /api/ExhibitChat/history?sessionId= */
export async function fetchExhibitChatHistory(sessionId: string) {
  const data = await request<unknown[] | null>("/api/ExhibitChat/history", {
    method: "GET",
    query: { sessionId },
  })
  const list = Array.isArray(data) ? data : []
  return list
    .map((item) => mapMessage(item as Record<string, unknown>))
    .filter((item): item is ExhibitChatMessage => Boolean(item))
}

/** POST /api/ExhibitChat/archive */
export async function archiveExhibitChatSession(sessionId: string) {
  await request("/api/ExhibitChat/archive", {
    method: "POST",
    data: { id: sessionId },
  })
}

export function buildExhibitChatSendUrl() {
  return `${API_BASE_URL}/api/ExhibitChat/send`
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
