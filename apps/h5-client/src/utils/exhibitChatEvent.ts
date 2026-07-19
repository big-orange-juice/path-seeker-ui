import type { ExhibitChatEvent, ExhibitChatEventType } from "@/types/exhibitChat"

const normalizePayload = <T = unknown>(payload: unknown): T => {
  if (typeof payload !== "string") {
    return payload as T
  }

  const trimmed = payload.trim()
  if (!trimmed) {
    return payload as T
  }

  try {
    return JSON.parse(trimmed) as T
  } catch {
    return payload as T
  }
}

export function parseExhibitChatEventData(rawData: string): ExhibitChatEvent | null {
  if (!rawData.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(rawData) as ExhibitChatEvent
    return {
      ...parsed,
      eventId: String(parsed.eventId ?? ""),
      sessionId: String(parsed.sessionId ?? ""),
      runId: String(parsed.runId ?? ""),
      sequence: typeof parsed.sequence === "number" ? parsed.sequence : 0,
      type: String(parsed.type ?? "") as ExhibitChatEventType,
      occurredAt: String(parsed.occurredAt ?? ""),
      payload: normalizePayload(parsed.payload),
    }
  } catch {
    return null
  }
}
